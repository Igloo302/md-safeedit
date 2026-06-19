import { ByteRange } from '@md-safeedit/core';
import { AnchorPayloadV1 } from '@md-safeedit/protocol';
import { MarkdownNode } from '../parser/parser.js';

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
    // Fallback: If there's exactly 1 raw-identical candidate, we can relocate it safely
    if (candidates.length === 1) {
      return candidates[0];
    }
    return null;
  }

  const evidence = token.structuralEvidence;

  const scoredCandidates = candidates.map(candidate => {
    let score = 0;

    // A. Path fingerprint match (+25)
    const pathFP = candidate.structuralPath.map(s => s.heading).join('/');
    if (pathFP === evidence.pathFingerprint) {
      score += 25;
    }

    // B. Parent and sibling context matching
    let candidateParentFP: string | undefined;
    let prevFP: string | undefined;
    let nextFP: string | undefined;
    let sibOccurrence = 1;

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

        // Sibling occurrence count of the same type
        let occurrenceCount = 1;
        for (let i = 0; i < idx; i++) {
          const sibling = currentNodes.find(n => n.runtimeId === siblingIds[i]);
          if (sibling && sibling.type === candidate.type) {
            occurrenceCount++;
          }
        }
        sibOccurrence = occurrenceCount;
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

    // Sibling occurrence match (+5)
    if (sibOccurrence === evidence.siblingOccurrence) {
      score += 5;
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

  // Sort candidates by structuralScore descending first, and use total score (which includes distance) only as a tie-breaker
  scoredCandidates.sort((a, b) => {
    if (Math.abs(b.structuralScore - a.structuralScore) >= 0.001) {
      return b.structuralScore - a.structuralScore;
    }
    return b.score - a.score;
  });

  // Confidence threshold: at least heading path or parent must match (+25 minimum)
  const threshold = 25;
  const best = scoredCandidates[0];

  if (best.structuralScore < threshold) {
    return null;
  }

  // Reject on structural tie (two candidates sharing the same highest structural score)
  const hasStructuralTie = scoredCandidates.slice(1).some(c => Math.abs(c.structuralScore - best.structuralScore) < 0.001);
  if (hasStructuralTie) {
    return null;
  }

  return best.node;
}
