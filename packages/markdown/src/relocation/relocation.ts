import { ByteRange } from '@md-safeedit/core';
import { AnchorPayloadV1 } from '@md-safeedit/protocol';
import { MarkdownNode } from '../parser/parser.js';

/**
 * Returns a deterministic serialized string for the structural path segments
 */
export function getPathFingerprint(path: { heading: string; level: number; occurrence: number }[]): string {
  return JSON.stringify(path.map(s => [s.heading, s.level, s.occurrence]));
}

function matchPathIgnoringOccurrence(
  pathA: { heading: string; level: number; occurrence: number }[],
  pathB: { heading: string; level: number; occurrence: number }[]
): boolean {
  if (pathA.length !== pathB.length) return false;
  for (let i = 0; i < pathA.length; i++) {
    if (pathA[i].heading !== pathB[i].heading || pathA[i].level !== pathB[i].level) {
      return false;
    }
  }
  return true;
}

interface ScoredCandidate {
  node: MarkdownNode;
  structuralScore: number;
  score: number;
}

/**
 * Helper to compute structural score for candidate nodes
 */
function scoreCandidates(
  token: AnchorPayloadV1,
  candidates: MarkdownNode[],
  currentNodes: MarkdownNode[],
  docLength: number
): ScoredCandidate[] {
  if (!token.structuralEvidence) {
    return [];
  }

  const evidence = token.structuralEvidence;

  return candidates.map(candidate => {
    let score = 0;

    // A. Path fingerprint match (+25) - comparing headings and levels only
    if (matchPathIgnoringOccurrence(candidate.structuralPath, token.structuralPath)) {
      score += 25;
    }

    // B. Parent and sibling context matching
    let candidateParentFP: string | undefined;
    let prevFP: string | undefined;
    let nextFP: string | undefined;

    if (candidate.parentRuntimeId) {
      const parentNode = currentNodes.find(n => n.runtimeId === candidate.parentRuntimeId);
      if (parentNode) {
        candidateParentFP = parentNode.rawHash;

        const siblingIds = parentNode.childRuntimeIds;
        const idx = siblingIds.indexOf(candidate.runtimeId);
        
        // Previous sibling raw hash
        if (idx - 1 >= 0) {
          const prevNode = currentNodes.find(n => n.runtimeId === siblingIds[idx - 1]);
          if (prevNode) prevFP = prevNode.rawHash;
        }
        
        // Next sibling raw hash
        if (idx + 1 < siblingIds.length) {
          const nextNode = currentNodes.find(n => n.runtimeId === siblingIds[idx + 1]);
          if (nextNode) nextFP = nextNode.rawHash;
        }
      }
    }

    // Parent fingerprint match (+40)
    if (candidateParentFP && candidateParentFP === evidence.parentFingerprint) {
      score += 40;
    }

    // Previous sibling match (+15)
    if (prevFP && prevFP === evidence.previousFingerprint) {
      score += 15;
    }

    // Next sibling match (+15)
    if (nextFP && nextFP === evidence.nextFingerprint) {
      score += 15;
    }

    // D. Obsidian Block ID match (+50)
    if (candidate.blockId && candidate.blockId === evidence.blockId) {
      score += 50;
    }

    const structuralScore = score;

    // C. Distance from original byte range (+0..5)
    const distance = Math.abs(candidate.range.start - token.range.start);
    const distanceScore = Math.max(0, 5 * (1 - distance / (docLength || 1)));
    score += distanceScore;

    return {
      node: candidate,
      structuralScore,
      score
    };
  });
}

/**
 * Searches for raw-identical candidates in the parsed node tree and ranks them using structural scoring.
 * Returns the relocated node on a high-confidence unique match, or null on mismatch/ambiguity.
 */
export function relocateNode(
  token: AnchorPayloadV1,
  currentNodes: MarkdownNode[],
  docLength: number
): MarkdownNode | null {
  // 1. Filter nodes of the same type
  const sameTypeNodes = currentNodes.filter(n => n.type === token.nodeType);

  // 2. Keep only nodes with the same raw content hash
  const candidates = sameTypeNodes.filter(n => n.rawHash === token.rawHash);

  if (candidates.length === 0) {
    return null;
  }

  // Relocation requires Phase 2 structuralEvidence to be present in token
  if (!token.structuralEvidence) {
    return null;
  }

  // 3. Handle multiple candidates (length >= 2) - default to ambiguous unless resolved by Block ID
  if (candidates.length >= 2) {
    if (token.blockId) {
      const matchingBlockIdCandidates = candidates.filter(
        c => c.blockId === token.blockId
      );
      if (matchingBlockIdCandidates.length === 1) {
        return matchingBlockIdCandidates[0];
      }
    }
    return null;
  }

  // 4. Handle exactly 1 candidate
  const scoredCandidates = scoreCandidates(token, candidates, currentNodes, docLength);
  const threshold = 25;
  const best = scoredCandidates[0];

  if (!best || best.structuralScore < threshold) {
    return null;
  }

  return best.node;
}

/**
 * Explains why relocation failed for candidates, returns stable error code
 */
export function explainRelocationFailure(
  token: AnchorPayloadV1,
  candidates: MarkdownNode[],
  currentNodes: MarkdownNode[],
  docLength: number
): 'ANCHOR_AMBIGUOUS' | 'ANCHOR_INSUFFICIENT_EVIDENCE' {
  if (!token.structuralEvidence) {
    return 'ANCHOR_INSUFFICIENT_EVIDENCE';
  }

  if (candidates.length === 0) {
    return 'ANCHOR_INSUFFICIENT_EVIDENCE';
  }

  if (candidates.length >= 2) {
    if (token.blockId) {
      const matchingBlockIdCandidates = candidates.filter(
        c => c.blockId === token.blockId
      );
      if (matchingBlockIdCandidates.length === 1) {
        // Unique block ID would succeed in relocateNode
      }
    }
    return 'ANCHOR_AMBIGUOUS';
  }

  const scoredCandidates = scoreCandidates(token, candidates, currentNodes, docLength);
  const threshold = 25;
  const best = scoredCandidates[0];

  if (!best || best.structuralScore < threshold) {
    return 'ANCHOR_INSUFFICIENT_EVIDENCE';
  }

  return 'ANCHOR_AMBIGUOUS';
}

