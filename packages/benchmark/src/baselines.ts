import * as fs from 'fs';
import * as crypto from 'crypto';
import { generateUnifiedDiff } from '@igloo302/core';
import { readService, patchService } from '@igloo302/cli/services.js';
import { parseMarkdownToNodes, buildLogicalSections } from '@igloo302/markdown';

export interface BaselineResult {
  ok: boolean;
  status?: string;
  error?: string;
}

/**
 * B1: Full-File Rewrite
 * Overwrites the entire file blindly with the planned content from the original snapshot.
 */
export function runFullFileRewrite(
  filePath: string,
  initialContent: string,
  targetRange: { start: number; end: number },
  replacementContent: string
): BaselineResult {
  const before = initialContent.slice(0, targetRange.start);
  const after = initialContent.slice(targetRange.end);
  const newContent = before + replacementContent + after;
  fs.writeFileSync(filePath, newContent);
  return { ok: true, status: 'committed' };
}

/**
 * B2: Exact String Replacement
 * Finds the exact target original content in the current file.
 * Replaces it if uniquely found; rejects if missing or ambiguous.
 */
export function runExactStringReplace(
  filePath: string,
  targetNodeContent: string,
  replacementContent: string
): BaselineResult {
  const currentContent = fs.readFileSync(filePath, 'utf-8');
  
  // Find all occurrences
  let count = 0;
  let idx = currentContent.indexOf(targetNodeContent);
  const indices: number[] = [];
  while (idx !== -1) {
    indices.push(idx);
    count++;
    idx = currentContent.indexOf(targetNodeContent, idx + 1);
  }

  if (count === 0) {
    return { ok: false, error: 'TARGET_MISSING' };
  }
  if (count > 1) {
    return { ok: false, error: 'ANCHOR_AMBIGUOUS' };
  }

  const matchIdx = indices[0];
  const newContent = 
    currentContent.slice(0, matchIdx) + 
    replacementContent + 
    currentContent.slice(matchIdx + targetNodeContent.length);

  fs.writeFileSync(filePath, newContent);
  return { ok: true, status: 'committed' };
}

/**
 * B3: Unified Diff
 * Generates a unified diff from initialContent -> initialContentWithEdit.
 * Tries to apply this diff to the current file, allowing for line shifts.
 */
export function runUnifiedDiff(
  filePath: string,
  initialContent: string,
  targetRange: { start: number; end: number },
  replacementContent: string
): BaselineResult {
  const before = initialContent.slice(0, targetRange.start);
  const after = initialContent.slice(targetRange.end);
  const initialEdited = before + replacementContent + after;

  const diff = generateUnifiedDiff(initialContent, initialEdited, 'file.md');
  if (!diff) {
    return { ok: true, status: 'committed' };
  }

  const currentContent = fs.readFileSync(filePath, 'utf-8');
  const currentLines = currentContent.split(/\r?\n/);

  // Parse unified diff into hunks
  const lines = diff.split('\n');
  interface Hunk {
    oldStart: number;
    oldLength: number;
    newStart: number;
    newLength: number;
    lines: string[];
  }
  const hunks: Hunk[] = [];
  let currentHunk: Hunk | null = null;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      const match = line.match(/^@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
      if (match) {
        currentHunk = {
          oldStart: parseInt(match[1]),
          oldLength: parseInt(match[2]),
          newStart: parseInt(match[3]),
          newLength: parseInt(match[4]),
          lines: []
        };
        hunks.push(currentHunk);
      }
    } else if (currentHunk) {
      if (line.startsWith(' ') || line.startsWith('-') || line.startsWith('+')) {
        currentHunk.lines.push(line);
      }
    }
  }

  // Apply hunks sequentially
  let lineOffsetShift = 0;
  for (const hunk of hunks) {
    // We expect the hunk's old lines to match somewhere in currentLines
    const expectedOldLines: string[] = [];
    const replacementLines: string[] = [];

    hunk.lines.forEach(l => {
      const text = l.slice(1);
      if (l.startsWith(' ')) {
        expectedOldLines.push(text);
        replacementLines.push(text);
      } else if (l.startsWith('-')) {
        expectedOldLines.push(text);
      } else if (l.startsWith('+')) {
        replacementLines.push(text);
      }
    });

    // Search for matching block in currentLines
    const startSearchLine = Math.max(0, hunk.oldStart - 1 + lineOffsetShift);
    let matchedLineIdx = -1;
    let matchCount = 0;

    // Search outward from startSearchLine
    for (let offset = 0; offset < currentLines.length; offset++) {
      const checkUp = startSearchLine - offset;
      const checkDown = startSearchLine + offset;

      const candidatesToCheck: number[] = [];
      if (checkUp >= 0) candidatesToCheck.push(checkUp);
      if (checkDown < currentLines.length && checkDown !== checkUp) candidatesToCheck.push(checkDown);

      for (const idx of candidatesToCheck) {
        if (idx + expectedOldLines.length <= currentLines.length) {
          let match = true;
          for (let l = 0; l < expectedOldLines.length; l++) {
            if (currentLines[idx + l] !== expectedOldLines[l]) {
              match = false;
              break;
            }
          }
          if (match) {
            matchedLineIdx = idx;
            matchCount++;
          }
        }
      }

      if (matchCount > 0) {
        break; // Found matching block(s) at this distance
      }
    }

    if (matchCount === 0) {
      return { ok: false, error: 'TARGET_MISSING' };
    }
    if (matchCount > 1) {
      return { ok: false, error: 'ANCHOR_AMBIGUOUS' };
    }

    // Apply the replacement
    currentLines.splice(matchedLineIdx, expectedOldLines.length, ...replacementLines);
    lineOffsetShift += (replacementLines.length - expectedOldLines.length);
  }

  fs.writeFileSync(filePath, currentLines.join('\n'));
  return { ok: true, status: 'committed' };
}

/**
 * B4: Line-Range Hash Patch
 * Agent targets a specific line range and verifies its content hash.
 */
export function runLineHashPatch(
  filePath: string,
  initialContent: string,
  targetRange: { start: number; end: number },
  replacementContent: string
): BaselineResult {
  const initialLines = initialContent.split(/\r?\n/);
  
  // Calculate which lines the targetRange maps to in initialContent
  let byteOffset = 0;
  let startLine = 0;
  let endLine = 0;

  for (let i = 0; i < initialLines.length; i++) {
    const lineLen = initialLines[i].length + 1; // including newline
    if (byteOffset <= targetRange.start && targetRange.start < byteOffset + lineLen) {
      startLine = i;
    }
    if (byteOffset <= targetRange.end && targetRange.end <= byteOffset + lineLen) {
      endLine = i;
      break;
    }
    byteOffset += lineLen;
  }

  const targetLines = initialLines.slice(startLine, endLine + 1);
  const expectedHash = crypto.createHash('sha256').update(targetLines.join('\n')).digest('hex');

  // Apply to current file at the SAME line index
  const currentContent = fs.readFileSync(filePath, 'utf-8');
  const currentLines = currentContent.split(/\r?\n/);

  if (startLine >= currentLines.length || endLine >= currentLines.length) {
    return { ok: false, error: 'TARGET_MISSING' };
  }

  const currentTargetLines = currentLines.slice(startLine, endLine + 1);
  const currentHash = crypto.createHash('sha256').update(currentTargetLines.join('\n')).digest('hex');

  if (currentHash !== expectedHash) {
    return { ok: false, error: 'TARGET_CHANGED' };
  }

  const replacementLines = replacementContent.split(/\r?\n/);
  currentLines.splice(startLine, endLine - startLine + 1, ...replacementLines);

  fs.writeFileSync(filePath, currentLines.join('\n'));
  return { ok: true, status: 'committed' };
}

/**
 * B5: MD SafeEdit
 * Uses the safe read-patch protocol with relocation support.
 */
export function runMDSafeEdit(
  filePath: string,
  initialContent: string,
  currentContent: string,
  targetRuntimeId: string,
  replacementContent: string,
  allowedRoots: string[]
): BaselineResult {
  // 1. Write initial content to filePath
  fs.writeFileSync(filePath, initialContent);

  // 2. Read to obtain token
  const readRes = readService({
    file: { path: filePath },
    targets: [{ runtime_id: targetRuntimeId }]
  } as any, allowedRoots) as any;

  if (!readRes.ok) {
    return { ok: false, error: readRes.error.code };
  }

  const token = readRes.nodes[0].anchor_token;

  // 3. Overwrite with current content (concurrent changes)
  fs.writeFileSync(filePath, currentContent);

  // 4. Patch using the token
  const patchRes = patchService({
    file: { path: filePath },
    operations: [{
      op: 'replace',
      anchor_token: token,
      content: replacementContent
    }],
    options: { dry_run: false }
  } as any, allowedRoots) as any;

  if (!patchRes.ok) {
    return { ok: false, error: patchRes.error.code };
  }

  return { ok: true, status: 'committed' };
}
