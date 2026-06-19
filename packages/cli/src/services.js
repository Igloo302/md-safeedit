import * as crypto from 'crypto';
import { createSnapshot, applyEdits, atomicWriteFile, generateUnifiedDiff } from '@md-safeedit/core';
import { parseMarkdownToNodes, buildLogicalSections, relocateNode } from '@md-safeedit/markdown';
import { verifyToken, createToken } from '@md-safeedit/protocol';
export function formatError(code, message, details) {
    let retryable = false;
    let recommended_action = '';
    switch (code) {
        case 'DOCUMENT_CHANGED':
            retryable = true;
            recommended_action = 'The document has changed. Re-inspect or use the node-level retry flow.';
            break;
        case 'TARGET_CHANGED':
            retryable = true;
            recommended_action = 'The target content changed after it was read. Read the candidate again and create a new patch.';
            break;
        case 'TARGET_MISSING':
            retryable = false;
            recommended_action = 'The target could not be found. Search again or check the path.';
            break;
        case 'ANCHOR_AMBIGUOUS':
            retryable = false;
            recommended_action = 'Multiple identical candidates found. Refine your query or select a more specific section.';
            break;
        case 'ANCHOR_INVALID':
            retryable = false;
            recommended_action = 'The anchor token is invalid, forged, or incompatible. Obtain a new anchor.';
            break;
        case 'ANCHOR_EXPIRED':
            retryable = true;
            recommended_action = 'The anchor token has expired. Read the node again to get a fresh anchor.';
            break;
        case 'OVERLAPPING_OPERATIONS':
            retryable = false;
            recommended_action = 'Operations in this transaction intersect or overlap. Split them or edit different ranges.';
            break;
        case 'UNSUPPORTED_SYNTAX':
            retryable = false;
            recommended_action = 'Safe node boundary is unavailable. Use a larger supported node.';
            break;
        case 'INVALID_REPLACEMENT':
            retryable = false;
            recommended_action = 'The replacement content violates node formatting rules or is invalid.';
            break;
        case 'VALIDATION_FAILED':
            retryable = false;
            recommended_action = 'The resulting Markdown is invalid. Correct the replacement content.';
            break;
        case 'COMMIT_RACE':
            retryable = true;
            recommended_action = 'The file was modified concurrently during commit. Retry the entire transaction.';
            break;
        case 'IO_ERROR':
            retryable = true;
            recommended_action = 'A filesystem IO error occurred. Inspect system permissions or retry.';
            break;
        default:
            retryable = false;
            recommended_action = 'Check the request content or syntax.';
    }
    return {
        ok: false,
        error: {
            code,
            message,
            retryable,
            recommended_action,
            details
        }
    };
}
/**
 * Service: inspect
 */
export function inspectService(request, allowedRoots) {
    try {
        const snapshot = createSnapshot(request.file.path, allowedRoots);
        const parsed = parseMarkdownToNodes(snapshot.bytes, snapshot.content);
        const nodes = buildLogicalSections(parsed, snapshot.bytes, snapshot.content);
        const outline = nodes
            .filter(n => n.type === 'section')
            .map(n => {
            // Find heading child to get its title
            const headingChild = nodes.find(c => c.parentRuntimeId === n.runtimeId && c.type === 'heading');
            const title = headingChild ? headingChild.content.replace(/^#+\s+/, '').replace(/\s+#+$/, '').trim() : 'Document';
            const headingLevel = headingChild ? headingChild.level || 1 : 1;
            return {
                runtime_id: n.runtimeId,
                type: 'section',
                title,
                level: headingLevel,
                path: n.structuralPath.map(s => ({
                    heading: s.heading,
                    level: s.level,
                    occurrence: s.occurrence
                })),
                child_count: n.childRuntimeIds.length - 1 // Exclude heading child
            };
        });
        return {
            ok: true,
            protocol_version: '1.0',
            document: {
                display_path: request.file.path,
                revision: snapshot.revision,
                dialect: 'commonmark+gfm',
                size_bytes: snapshot.bytes.length,
                line_ending: snapshot.lineEnding
            },
            outline,
            warnings: []
        };
    }
    catch (err) {
        if (err.message.startsWith('Access Denied')) {
            return formatError('IO_ERROR', err.message);
        }
        return formatError('IO_ERROR', err.message || 'Failed to inspect file.');
    }
}
/**
 * Service: search
 */
export function searchService(request, allowedRoots) {
    try {
        const snapshot = createSnapshot(request.file.path, allowedRoots);
        const parsed = parseMarkdownToNodes(snapshot.bytes, snapshot.content);
        const nodes = buildLogicalSections(parsed, snapshot.bytes, snapshot.content);
        let filtered = nodes;
        // Filter by type
        if (request.filters?.include_types) {
            filtered = filtered.filter(n => request.filters.include_types.includes(n.type));
        }
        if (request.filters?.exclude_types) {
            filtered = filtered.filter(n => !request.filters.exclude_types.includes(n.type));
        }
        // Filter by heading path (under_path)
        if (request.filters?.under_path && request.filters.under_path.length > 0) {
            const up = request.filters.under_path;
            filtered = filtered.filter(n => {
                if (n.structuralPath.length < up.length)
                    return false;
                for (let i = 0; i < up.length; i++) {
                    if (n.structuralPath[i].heading !== up[i].heading ||
                        n.structuralPath[i].level !== up[i].level ||
                        n.structuralPath[i].occurrence !== up[i].occurrence) {
                        return false;
                    }
                }
                return true;
            });
        }
        // Text query match (case-insensitive)
        const query = request.query.toLowerCase();
        const matches = filtered
            .map(n => {
            const contentLower = n.content.toLowerCase();
            const matchIdx = contentLower.indexOf(query);
            if (matchIdx === -1)
                return null;
            const limit = request.options?.preview_chars || 160;
            const preview = n.content.length > limit ? n.content.slice(0, limit) + '...' : n.content;
            return {
                runtime_id: n.runtimeId,
                type: n.type,
                path: n.structuralPath.map(s => ({
                    heading: s.heading,
                    level: s.level,
                    occurrence: s.occurrence
                })),
                preview,
                match_ranges: [{
                        start: matchIdx,
                        end: matchIdx + query.length
                    }]
            };
        })
            .filter((m) => m !== null);
        const limit = request.options?.limit || 20;
        return {
            ok: true,
            document_revision: snapshot.revision,
            matches: matches.slice(0, limit)
        };
    }
    catch (err) {
        return formatError('IO_ERROR', err.message || 'Failed to search file.');
    }
}
/**
 * Service: read
 */
export function readService(request, allowedRoots) {
    try {
        const snapshot = createSnapshot(request.file.path, allowedRoots);
        const parsed = parseMarkdownToNodes(snapshot.bytes, snapshot.content);
        const nodes = buildLogicalSections(parsed, snapshot.bytes, snapshot.content);
        const matchedNodes = [];
        for (const target of request.targets) {
            const node = nodes.find(n => n.runtimeId === target.runtime_id);
            if (!node) {
                return formatError('TARGET_MISSING', `Target node with runtime_id "${target.runtime_id}" not found.`);
            }
            // Collect siblings for neighbors
            let previous = [];
            let next = [];
            if (node.parentRuntimeId) {
                const parentNode = nodes.find(n => n.runtimeId === node.parentRuntimeId);
                if (parentNode) {
                    const siblingIds = parentNode.childRuntimeIds;
                    const idx = siblingIds.indexOf(node.runtimeId);
                    const limit = request.options?.include_neighbors || 0;
                    for (let i = 1; i <= limit; i++) {
                        if (idx - i >= 0) {
                            const prevNode = nodes.find(n => n.runtimeId === siblingIds[idx - i]);
                            if (prevNode) {
                                previous.push({
                                    type: prevNode.type,
                                    content: prevNode.content
                                });
                            }
                        }
                        if (idx + i < siblingIds.length) {
                            const nextNode = nodes.find(n => n.runtimeId === siblingIds[idx + i]);
                            if (nextNode) {
                                next.push({
                                    type: nextNode.type,
                                    content: nextNode.content
                                });
                            }
                        }
                    }
                }
            }
            // Generate structuralEvidence
            const pathFingerprint = node.structuralPath.map(s => s.heading).join('/');
            let parentFingerprint;
            let previousFingerprint;
            let nextFingerprint;
            let siblingOccurrence;
            if (node.parentRuntimeId) {
                const parentNode = nodes.find(n => n.runtimeId === node.parentRuntimeId);
                if (parentNode) {
                    parentFingerprint = parentNode.rawHash;
                    const siblingIds = parentNode.childRuntimeIds;
                    const idx = siblingIds.indexOf(node.runtimeId);
                    if (idx - 1 >= 0) {
                        const prevNode = nodes.find(n => n.runtimeId === siblingIds[idx - 1]);
                        if (prevNode)
                            previousFingerprint = prevNode.rawHash;
                    }
                    if (idx + 1 < siblingIds.length) {
                        const nextNode = nodes.find(n => n.runtimeId === siblingIds[idx + 1]);
                        if (nextNode)
                            nextFingerprint = nextNode.rawHash;
                    }
                    let occurrenceCount = 1;
                    for (let i = 0; i < idx; i++) {
                        const sibling = nodes.find(n => n.runtimeId === siblingIds[i]);
                        if (sibling && sibling.type === node.type) {
                            occurrenceCount++;
                        }
                    }
                    siblingOccurrence = occurrenceCount;
                }
            }
            // Generate HMAC-signed anchor token
            const payload = {
                version: 1,
                fileKey: snapshot.canonicalPath,
                sourceRevision: snapshot.revision,
                range: node.range,
                rawHash: node.rawHash,
                nodeType: node.type,
                structuralPath: node.structuralPath.map(s => ({
                    heading: s.heading,
                    level: s.level,
                    occurrence: s.occurrence
                })),
                structuralEvidence: {
                    pathFingerprint,
                    parentFingerprint,
                    previousFingerprint,
                    nextFingerprint,
                    siblingOccurrence,
                    blockId: node.blockId
                },
                blockId: node.blockId,
                dialect: 'commonmark+gfm',
                issuedAt: Date.now(),
                expiresAt: Date.now() + 600000 // 10 minutes expiry
            };
            const token = createToken(payload);
            matchedNodes.push({
                type: node.type,
                content: node.content,
                path: node.structuralPath.map(s => ({
                    heading: s.heading,
                    level: s.level,
                    occurrence: s.occurrence
                })),
                anchor_token: token,
                neighbors: {
                    previous,
                    next
                }
            });
        }
        return {
            ok: true,
            document_revision: snapshot.revision,
            nodes: matchedNodes
        };
    }
    catch (err) {
        if (err.message.startsWith('Target node')) {
            return formatError('TARGET_MISSING', err.message);
        }
        return formatError('IO_ERROR', err.message || 'Failed to read file.');
    }
}
/**
 * Service: patch
 */
export function patchService(request, allowedRoots) {
    try {
        const snapshot = createSnapshot(request.file.path, allowedRoots);
        const byteEdits = [];
        const operationsSummary = [];
        let anyRelocated = false;
        // Verify all operations first
        for (let i = 0; i < request.operations.length; i++) {
            const op = request.operations[i];
            let payload;
            try {
                payload = verifyToken(op.anchor_token);
            }
            catch (err) {
                if (err.message === 'ANCHOR_EXPIRED') {
                    return formatError('ANCHOR_EXPIRED', 'Anchor token has expired.', { operation_index: i });
                }
                return formatError('ANCHOR_INVALID', 'Anchor token is invalid or has been modified.', { operation_index: i });
            }
            // Ensure path matches
            if (payload.fileKey !== snapshot.canonicalPath) {
                return formatError('ANCHOR_INVALID', 'Anchor token does not belong to the target file.', { operation_index: i });
            }
            let startOffset = payload.range.start;
            let endOffset = payload.range.end;
            let isRelocated = false;
            // Revision check and relocation
            if (payload.sourceRevision !== snapshot.revision) {
                const parsed = parseMarkdownToNodes(snapshot.bytes, snapshot.content);
                const nodes = buildLogicalSections(parsed, snapshot.bytes, snapshot.content);
                const relocated = relocateNode(payload, nodes, snapshot.bytes.length);
                if (!relocated) {
                    const sameTypeNodes = nodes.filter(n => n.type === payload.nodeType);
                    const candidates = sameTypeNodes.filter(n => n.rawHash === payload.rawHash);
                    if (candidates.length === 0) {
                        const pathFP = payload.structuralEvidence?.pathFingerprint;
                        const changedNode = sameTypeNodes.find(n => n.structuralPath.map(s => s.heading).join('/') === pathFP);
                        if (changedNode) {
                            return formatError('TARGET_CHANGED', 'Target content has been modified.', { operation_index: i });
                        }
                        return formatError('TARGET_MISSING', 'Target node could not be found.', { operation_index: i });
                    }
                    else {
                        return formatError('ANCHOR_AMBIGUOUS', 'Multiple candidates match the target description. Relocation is ambiguous.', { operation_index: i });
                    }
                }
                startOffset = relocated.range.start;
                endOffset = relocated.range.end;
                isRelocated = true;
                anyRelocated = true;
            }
            else {
                // Fast path: raw target hash check at range
                if (startOffset < 0 || endOffset > snapshot.bytes.length) {
                    return formatError('TARGET_CHANGED', 'Target byte range is out of bounds in current document.', { operation_index: i });
                }
                const currentBytes = snapshot.bytes.subarray(startOffset, endOffset);
                const currentHash = `sha256:${crypto.createHash('sha256').update(currentBytes).digest('hex')}`;
                if (currentHash !== payload.rawHash) {
                    return formatError('TARGET_CHANGED', 'Target content has been modified.', { operation_index: i });
                }
            }
            // Map operation to byte edits
            let replacement;
            let editOffset = startOffset;
            let editLength = endOffset - startOffset;
            if (op.op === 'replace') {
                replacement = new TextEncoder().encode(op.content);
            }
            else if (op.op === 'delete') {
                replacement = new Uint8Array(0);
            }
            else if (op.op === 'insert_before') {
                replacement = new TextEncoder().encode(op.content);
                editOffset = startOffset;
                editLength = 0;
            }
            else { // insert_after
                replacement = new TextEncoder().encode(op.content);
                editOffset = endOffset;
                editLength = 0;
            }
            byteEdits.push({
                offset: editOffset,
                length: editLength,
                replacement,
                index: i
            });
            operationsSummary.push({
                index: i,
                status: isRelocated ? 'verified_relocated' : 'verified',
                node_type: payload.nodeType
            });
        }
        // Plan transaction
        let nextBytes;
        try {
            nextBytes = applyEdits(snapshot.bytes, byteEdits);
        }
        catch (err) {
            if (err.message === 'OVERLAPPING_OPERATIONS') {
                return formatError('OVERLAPPING_OPERATIONS', 'Patch operations overlap inside the transaction.');
            }
            return formatError('INVALID_REPLACEMENT', err.message);
        }
        const nextContent = new TextDecoder('utf-8').decode(nextBytes);
        // Validation level check
        const validationLevel = request.options?.validation_level || 'normal';
        if (validationLevel !== 'permissive') {
            try {
                // Parse the resulting markdown string to ensure it is structurally valid
                const nextNodes = parseMarkdownToNodes(nextBytes, nextContent);
                buildLogicalSections(nextNodes, nextBytes, nextContent);
            }
            catch (err) {
                return formatError('VALIDATION_FAILED', `Resulting document is invalid: ${err.message}`);
            }
        }
        // Generate diff preview
        const diff = generateUnifiedDiff(snapshot.content, nextContent, request.file.path);
        if (request.options?.dry_run !== false) {
            const resultHash = crypto.createHash('sha256').update(nextBytes).digest('hex');
            return {
                ok: true,
                status: 'preview',
                source_revision: snapshot.revision,
                result_revision: `sha256:${resultHash}`,
                relocated: anyRelocated,
                diff,
                operations: operationsSummary,
                warnings: []
            };
        }
        // Commit changes atomically
        let newRevision;
        try {
            newRevision = atomicWriteFile(snapshot.canonicalPath, nextBytes, snapshot.revision);
        }
        catch (err) {
            if (err.message === 'COMMIT_RACE') {
                return formatError('COMMIT_RACE', 'File changed during final commit window.');
            }
            return formatError('IO_ERROR', err.message || 'Atomic write failed.');
        }
        return {
            ok: true,
            status: 'committed',
            source_revision: snapshot.revision,
            new_revision: newRevision,
            relocated: anyRelocated,
            diff,
            operations: operationsSummary
        };
    }
    catch (err) {
        if (err.message === 'COMMIT_RACE') {
            return formatError('COMMIT_RACE', 'File changed concurrently.');
        }
        return formatError('IO_ERROR', err.message || 'Failed to patch file.');
    }
}
//# sourceMappingURL=services.js.map