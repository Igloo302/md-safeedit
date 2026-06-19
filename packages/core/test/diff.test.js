import { describe, it, expect } from 'vitest';
import { generateUnifiedDiff } from '../src/diff/diff.js';
describe('Unified Diff Generator', () => {
    it('returns empty string if content is unchanged', () => {
        const content = 'line 1\nline 2\n';
        const diff = generateUnifiedDiff(content, content, 'file.txt');
        expect(diff).toBe('');
    });
    it('generates a simple unified diff for added and removed lines', () => {
        const oldStr = 'line 1\nline 2\nline 3\n';
        const newStr = 'line 1\nline 2 updated\nline 3\nline 4\n';
        const diff = generateUnifiedDiff(oldStr, newStr, 'file.txt');
        expect(diff).toContain('--- a/file.txt');
        expect(diff).toContain('+++ b/file.txt');
        expect(diff).toContain('-line 2');
        expect(diff).toContain('+line 2 updated');
        expect(diff).toContain('+line 4');
    });
});
//# sourceMappingURL=diff.test.js.map