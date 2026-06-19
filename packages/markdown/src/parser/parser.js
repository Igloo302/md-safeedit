import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfm } from 'micromark-extension-gfm';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { frontmatter } from 'micromark-extension-frontmatter';
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter';
import * as crypto from 'crypto';
import { OffsetMapper } from '@igloo302/core';
/**
 * Maps AST node type to internal NodeType.
 */
function mapNodeType(astType) {
    switch (astType) {
        case 'root':
            return 'document';
        case 'heading':
            return 'heading';
        case 'paragraph':
            return 'paragraph';
        case 'listItem':
            return 'list_item';
        case 'code':
            return 'code_block';
        case 'tableRow':
            return 'table_row';
        case 'yaml':
            return 'frontmatter';
        case 'blockquote':
            return 'blockquote';
        case 'list':
            return 'list';
        case 'table':
            return 'table';
        default:
            return 'raw';
    }
}
/**
 * Walk the mdast AST to extract supported block nodes and calculate exact byte ranges.
 */
export function parseMarkdownToNodes(bytes, content) {
    const mapper = new OffsetMapper(bytes, content);
    // Parse with micromark / mdast extensions
    const ast = fromMarkdown(content, {
        extensions: [gfm(), frontmatter(['yaml'])],
        mdastExtensions: [gfmFromMarkdown(), frontmatterFromMarkdown(['yaml'])]
    });
    const nodes = [];
    let idCounter = 0;
    function nextId() {
        return `n_${idCounter++}`;
    }
    // Recursive walk
    function walk(astNode, parentId) {
        // We only care about block-level nodes or specific table/list elements
        const isSupported = [
            'root',
            'heading',
            'paragraph',
            'listItem',
            'code',
            'tableRow',
            'yaml',
            'blockquote',
            'list',
            'table'
        ].includes(astNode.type);
        if (!isSupported && astNode.type !== 'html') {
            // For inline nodes or unsupported nodes, we do not create individual nodes,
            // but their contents are captured within their parent block nodes.
            return null;
        }
        const type = mapNodeType(astNode.type);
        const runtimeId = nextId();
        // Calculate byte range from position offsets
        let startChar = 0;
        let endChar = 0;
        if (astNode.position) {
            startChar = astNode.position.start.offset || 0;
            endChar = astNode.position.end.offset || 0;
        }
        // Ensure we do not exceed string boundaries
        startChar = Math.max(0, Math.min(startChar, content.length));
        endChar = Math.max(startChar, Math.min(endChar, content.length));
        const range = {
            start: mapper.toByteOffset(startChar),
            end: mapper.toByteOffset(endChar)
        };
        const nodeBytes = bytes.subarray(range.start, range.end);
        const hash = crypto.createHash('sha256').update(nodeBytes).digest('hex');
        const rawHash = `sha256:${hash}`;
        const nodeContent = content.slice(startChar, endChar);
        const node = {
            runtimeId,
            type,
            range,
            parentRuntimeId: parentId,
            childRuntimeIds: [],
            structuralPath: [],
            rawHash,
            content: nodeContent
        };
        if (type === 'heading') {
            node.level = astNode.depth;
        }
        // Parse Obsidian block IDs
        const blockIdMatch = nodeContent.match(/\s+\^([a-zA-Z0-9-]+)(?:\r?\n)?$/);
        if (blockIdMatch) {
            node.blockId = blockIdMatch[1];
        }
        // Parse Obsidian callouts
        if (type === 'blockquote') {
            const calloutMatch = nodeContent.match(/^>\s*\[!([a-zA-Z0-9-]+)\]/i);
            if (calloutMatch) {
                node.calloutType = calloutMatch[1].toLowerCase();
            }
        }
        if (type === 'code_block') {
            // Content inside code fence
            // A simple heuristic: find the first newline and the last newline
            const firstNL = nodeContent.indexOf('\n');
            const lastNL = nodeContent.lastIndexOf('\n');
            if (firstNL !== -1 && lastNL !== -1 && lastNL > firstNL) {
                node.contentRange = {
                    start: range.start + mapper.toByteOffset(startChar + firstNL + 1) - mapper.toByteOffset(startChar),
                    end: range.start + mapper.toByteOffset(startChar + lastNL) - mapper.toByteOffset(startChar)
                };
            }
        }
        nodes.push(node);
        if (type === 'frontmatter') {
            const fields = parseFrontmatterFields(nodeContent, startChar);
            for (const field of fields) {
                const fieldId = nextId();
                const fieldRange = {
                    start: mapper.toByteOffset(field.startChar),
                    end: mapper.toByteOffset(field.endChar)
                };
                const fieldBytes = bytes.subarray(fieldRange.start, fieldRange.end);
                const fieldHash = `sha256:${crypto.createHash('sha256').update(fieldBytes).digest('hex')}`;
                const fieldContent = content.slice(field.startChar, field.endChar);
                const fieldNode = {
                    runtimeId: fieldId,
                    type: 'frontmatter_field',
                    range: fieldRange,
                    parentRuntimeId: runtimeId,
                    childRuntimeIds: [],
                    structuralPath: [],
                    rawHash: fieldHash,
                    content: fieldContent
                };
                nodes.push(fieldNode);
                node.childRuntimeIds.push(fieldId);
            }
        }
        // Walk children
        if (astNode.children && Array.isArray(astNode.children)) {
            for (const childAstNode of astNode.children) {
                const childId = walk(childAstNode, runtimeId);
                if (childId) {
                    node.childRuntimeIds.push(childId);
                }
            }
        }
        return runtimeId;
    }
    walk(ast);
    return nodes;
}
function parseFrontmatterFields(content, startCharOffset) {
    if (!content.startsWith('---')) {
        return [];
    }
    const fields = [];
    const regex = /^([a-zA-Z0-9_-]+)\s*:/gm;
    const matches = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
        matches.push({
            key: match[1],
            index: match.index
        });
    }
    const closingIndex = content.lastIndexOf('---');
    if (closingIndex <= 0) {
        return [];
    }
    for (let i = 0; i < matches.length; i++) {
        const startIdx = matches[i].index;
        let endIdx = (i + 1 < matches.length) ? matches[i + 1].index : closingIndex;
        // Trim trailing whitespace/newlines from the end index
        while (endIdx > startIdx && /\s/.test(content[endIdx - 1])) {
            endIdx--;
        }
        fields.push({
            key: matches[i].key,
            startChar: startCharOffset + startIdx,
            endChar: startCharOffset + endIdx
        });
    }
    return fields;
}
//# sourceMappingURL=parser.js.map