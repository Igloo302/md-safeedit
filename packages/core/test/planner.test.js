import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { hasOverlaps, sortEdits, applyEdits } from '../src/transaction/planner.js';
describe('Byte Edit Planner', () => {
    it('detects overlapping ranges correctly', () => {
        const edits = [
            { offset: 10, length: 5, replacement: new Uint8Array(0), index: 0 },
            { offset: 12, length: 2, replacement: new Uint8Array(0), index: 1 } // Overlaps
        ];
        expect(hasOverlaps(edits)).toBe(true);
        const nonOverlapping = [
            { offset: 10, length: 5, replacement: new Uint8Array(0), index: 0 },
            { offset: 15, length: 2, replacement: new Uint8Array(0), index: 1 } // Boundary touching is fine
        ];
        expect(hasOverlaps(nonOverlapping)).toBe(false);
    });
    it('detects insert strictly inside a replace range', () => {
        const edits = [
            { offset: 10, length: 5, replacement: new Uint8Array(0), index: 0 },
            { offset: 12, length: 0, replacement: new Uint8Array(0), index: 1 } // Inside 10-15
        ];
        expect(hasOverlaps(edits)).toBe(true);
    });
    it('allows insert exactly at boundaries of a replace range', () => {
        const edits = [
            { offset: 10, length: 5, replacement: new Uint8Array(0), index: 0 },
            { offset: 10, length: 0, replacement: new Uint8Array(0), index: 1 }, // Start boundary
            { offset: 15, length: 0, replacement: new Uint8Array(0), index: 2 } // End boundary
        ];
        expect(hasOverlaps(edits)).toBe(false);
    });
    it('sorts edits deterministically', () => {
        const edits = [
            { offset: 5, length: 0, replacement: new Uint8Array([1]), index: 0 },
            { offset: 10, length: 2, replacement: new Uint8Array([2]), index: 1 },
            { offset: 5, length: 2, replacement: new Uint8Array([3]), index: 2 },
            { offset: 5, length: 0, replacement: new Uint8Array([4]), index: 3 }
        ];
        const sorted = sortEdits(edits);
        // Expected order:
        // 1. Offset 10 comes first (highest offset)
        // 2. Offset 5: replace (length 2) comes before inserts (length 0)
        // 3. Offset 5: inserts are sorted by index descending (index 3 before index 0)
        expect(sorted[0].offset).toBe(10);
        expect(sorted[1].offset).toBe(5);
        expect(sorted[1].length).toBe(2); // Replace
        expect(sorted[2].offset).toBe(5);
        expect(sorted[2].length).toBe(0);
        expect(sorted[2].index).toBe(3); // Higher index first
        expect(sorted[3].offset).toBe(5);
        expect(sorted[3].length).toBe(0);
        expect(sorted[3].index).toBe(0);
    });
    it('applies edits cleanly and preserves request order for inserts', () => {
        const source = new TextEncoder().encode('012345');
        // Edits:
        // Replace '23' (range 2-4) with 'X'
        // Insert 'Y' at 2 (index 1)
        // Insert 'Z' at 2 (index 2)
        const edits = [
            { offset: 2, length: 2, replacement: new TextEncoder().encode('X'), index: 0 },
            { offset: 2, length: 0, replacement: new TextEncoder().encode('Y'), index: 1 },
            { offset: 2, length: 0, replacement: new TextEncoder().encode('Z'), index: 2 }
        ];
        const result = applyEdits(source, edits);
        const resultStr = new TextDecoder().decode(result);
        // Expected output:
        // Replace 2-4 with 'X' -> '01X45'
        // Insert 'Z' (index 2) then 'Y' (index 1) right-to-left:
        // 'Z' at 2 -> '01ZX45'
        // 'Y' at 2 -> '01YZX45'
        expect(resultStr).toBe('01YZX45');
    });
    it('property test: non-overlapping edits preserve untouched parts', () => {
        fc.assert(fc.property(fc.string(), fc.array(fc.record({
            offset: fc.nat(),
            length: fc.nat(),
            replacement: fc.string()
        })), (sourceStr, rawEdits) => {
            const source = new TextEncoder().encode(sourceStr);
            const sortedRaw = [...rawEdits].sort((a, b) => a.offset - b.offset);
            const validEdits = [];
            let lastEnd = 0;
            for (let i = 0; i < sortedRaw.length; i++) {
                const e = sortedRaw[i];
                if (e.offset >= lastEnd && e.offset + e.length <= source.length) {
                    validEdits.push({
                        offset: e.offset,
                        length: e.length,
                        replacement: new TextEncoder().encode(e.replacement),
                        index: i
                    });
                    lastEnd = e.offset + e.length;
                }
            }
            if (validEdits.length === 0)
                return true;
            const result = applyEdits(source, validEdits);
            const resultStr = new TextDecoder().decode(result);
            const firstOffset = validEdits[0].offset;
            expect(resultStr.substring(0, firstOffset)).toBe(sourceStr.substring(0, firstOffset));
            return true;
        }));
    });
});
//# sourceMappingURL=planner.test.js.map