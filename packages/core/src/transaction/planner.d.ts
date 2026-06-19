export interface ByteEdit {
    offset: number;
    length: number;
    replacement: Uint8Array;
    index: number;
}
/**
 * Checks if any edits overlap.
 * Intersecting ranges are forbidden.
 * An insert is allowed at the boundary of a replace, but not strictly inside it.
 */
export declare function hasOverlaps(edits: ByteEdit[]): boolean;
/**
 * Sorts edits from highest offset to lowest offset for safe application.
 * Deterministic rules for same-offset edits:
 * - Replaces (length > 0) are applied first (sorted before inserts).
 * - Inserts at the same offset are applied in request order (sorted by index descending for right-to-left application).
 */
export declare function sortEdits(edits: ByteEdit[]): ByteEdit[];
/**
 * Applies a list of byte edits to a source Uint8Array.
 * Throws an error if overlaps are detected.
 */
export declare function applyEdits(source: Uint8Array, edits: ByteEdit[]): Uint8Array;
