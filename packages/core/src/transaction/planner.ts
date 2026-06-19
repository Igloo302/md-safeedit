export interface ByteEdit {
  offset: number; // raw byte offset in the original snapshot
  length: number; // length of bytes to remove (0 for insert)
  replacement: Uint8Array; // replacement bytes
  index: number; // original index in the requested batch (used for stable sorting)
}

/**
 * Checks if any edits overlap.
 * Intersecting ranges are forbidden.
 * An insert is allowed at the boundary of a replace, but not strictly inside it.
 */
export function hasOverlaps(edits: ByteEdit[]): boolean {
  for (let i = 0; i < edits.length; i++) {
    const a = edits[i];
    const startA = a.offset;
    const endA = a.offset + a.length;

    for (let j = i + 1; j < edits.length; j++) {
      const b = edits[j];
      const startB = b.offset;
      const endB = b.offset + b.length;

      // Check standard range overlap: max(startA, startB) < min(endA, endB)
      // This detects if two non-empty ranges intersect, or if an insert is inside a replace.
      const hasOverlap = Math.max(startA, startB) < Math.min(endA, endB);
      if (hasOverlap) return true;

      // Check if one is insert (length 0) and strictly inside another's non-empty range
      if (a.length > 0 && b.length === 0 && startB > startA && startB < endA) return true;
      if (b.length > 0 && a.length === 0 && startA > startB && startA < endB) return true;
    }
  }
  return false;
}

/**
 * Sorts edits from highest offset to lowest offset for safe application.
 * Deterministic rules for same-offset edits:
 * - Replaces (length > 0) are applied first (sorted before inserts).
 * - Inserts at the same offset are applied in request order (sorted by index descending for right-to-left application).
 */
export function sortEdits(edits: ByteEdit[]): ByteEdit[] {
  return [...edits].sort((a, b) => {
    if (a.offset !== b.offset) {
      return b.offset - a.offset; // Higher offsets first
    }
    // Same offset: Replace before insert
    if (a.length !== b.length) {
      return b.length - a.length; // Replaces (longer lengths) first
    }
    // Same offset and same length (e.g. multiple inserts): preserve request order
    // Since we apply right-to-left, higher request index must be applied first
    return b.index - a.index;
  });
}

/**
 * Applies a list of byte edits to a source Uint8Array.
 * Throws an error if overlaps are detected.
 */
export function applyEdits(source: Uint8Array, edits: ByteEdit[]): Uint8Array {
  if (hasOverlaps(edits)) {
    throw new Error('OVERLAPPING_OPERATIONS');
  }

  const sorted = sortEdits(edits);
  
  // To avoid multiple allocations, we can rebuild the buffer by slicing and concatenating
  // since we process from right to left.
  let currentBytes = source;

  for (const edit of sorted) {
    if (edit.offset < 0 || edit.offset + edit.length > currentBytes.length) {
      throw new Error(`INVALID_REPLACEMENT: Edit offset ${edit.offset} or length ${edit.length} is out of bounds for content size ${currentBytes.length}.`);
    }

    const before = currentBytes.subarray(0, edit.offset);
    const after = currentBytes.subarray(edit.offset + edit.length);

    const nextBytes = new Uint8Array(before.length + edit.replacement.length + after.length);
    nextBytes.set(before, 0);
    nextBytes.set(edit.replacement, before.length);
    nextBytes.set(after, before.length + edit.replacement.length);

    currentBytes = nextBytes;
  }

  return currentBytes;
}
