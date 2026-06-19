import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { detectFileMetadata, OffsetMapper, authorizeAndCanonicalizePath } from '../src/snapshot/snapshot.js';
describe('snapshot metadata detection', () => {
    it('detects UTF-8 without BOM and LF endings', () => {
        const content = 'hello\nworld\n';
        const bytes = new TextEncoder().encode(content);
        const meta = detectFileMetadata(bytes);
        expect(meta.encoding).toBe('utf-8');
        expect(meta.lineEnding).toBe('lf');
        expect(meta.cleanContent).toBe(content);
    });
    it('detects UTF-8 with BOM and CRLF endings', () => {
        const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
        const content = 'hello\r\nworld\r\n';
        const contentBytes = new TextEncoder().encode(content);
        const bytes = new Uint8Array(bom.length + contentBytes.length);
        bytes.set(bom, 0);
        bytes.set(contentBytes, bom.length);
        const meta = detectFileMetadata(bytes);
        expect(meta.encoding).toBe('utf-8-bom');
        expect(meta.lineEnding).toBe('crlf');
        expect(meta.cleanContent).toBe(content);
    });
    it('detects mixed line endings', () => {
        const content = 'hello\r\nworld\n';
        const bytes = new TextEncoder().encode(content);
        const meta = detectFileMetadata(bytes);
        expect(meta.lineEnding).toBe('mixed');
    });
});
describe('OffsetMapper', () => {
    it('correctly maps ASCII character and byte offsets', () => {
        const str = 'abc';
        const bytes = new TextEncoder().encode(str);
        const mapper = new OffsetMapper(bytes, str);
        expect(mapper.toByteOffset(0)).toBe(0);
        expect(mapper.toByteOffset(1)).toBe(1);
        expect(mapper.toByteOffset(3)).toBe(3);
        expect(mapper.toCharOffset(0)).toBe(0);
        expect(mapper.toCharOffset(1)).toBe(1);
        expect(mapper.toCharOffset(3)).toBe(3);
    });
    it('correctly maps multi-byte UTF-8 character offsets', () => {
        const str = 'a😂c'; // 😂 is 4 bytes in UTF-8, 2 chars (surrogate pair) in UTF-16
        const bytes = new TextEncoder().encode(str);
        const mapper = new OffsetMapper(bytes, str);
        // Bytes: [97 ('a'), 240, 159, 152, 130 (emoji), 99 ('c')] - total 6 bytes
        // String length: 4 (surrogate pair counts as 2 chars)
        expect(bytes.length).toBe(6);
        expect(str.length).toBe(4);
        expect(mapper.toByteOffset(0)).toBe(0); // 'a'
        expect(mapper.toByteOffset(1)).toBe(1); // high surrogate
        expect(mapper.toByteOffset(2)).toBe(1); // low surrogate (both map to start of emoji bytes)
        expect(mapper.toByteOffset(3)).toBe(5); // 'c'
        expect(mapper.toByteOffset(4)).toBe(6); // end
        expect(mapper.toCharOffset(0)).toBe(0); // 'a'
        expect(mapper.toCharOffset(1)).toBe(1); // emoji byte 1
        expect(mapper.toCharOffset(2)).toBe(1); // emoji byte 2
        expect(mapper.toCharOffset(3)).toBe(1); // emoji byte 3
        expect(mapper.toCharOffset(4)).toBe(1); // emoji byte 4
        expect(mapper.toCharOffset(5)).toBe(3); // 'c'
        expect(mapper.toCharOffset(6)).toBe(4); // end
    });
    it('correctly accounts for UTF-8 BOM', () => {
        const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
        const str = 'ab';
        const strBytes = new TextEncoder().encode(str);
        const bytes = new Uint8Array(bom.length + strBytes.length);
        bytes.set(bom, 0);
        bytes.set(strBytes, bom.length);
        const mapper = new OffsetMapper(bytes, str);
        expect(mapper.toByteOffset(0)).toBe(3);
        expect(mapper.toByteOffset(1)).toBe(4);
        expect(mapper.toByteOffset(2)).toBe(5);
        expect(mapper.toCharOffset(0)).toBe(0);
        expect(mapper.toCharOffset(3)).toBe(0);
        expect(mapper.toCharOffset(4)).toBe(1);
        expect(mapper.toCharOffset(5)).toBe(2);
    });
});
describe('path authorization', () => {
    it('authorizes valid paths inside allowed roots', () => {
        const root = process.cwd();
        const target = path.join(root, 'package.json');
        const canonical = authorizeAndCanonicalizePath(target, [root]);
        expect(canonical).toBe(fs.realpathSync(target));
    });
    it('rejects path traversal outside allowed roots', () => {
        const root = path.join(process.cwd(), 'packages');
        const target = path.join(process.cwd(), 'package.json'); // outside packages/
        expect(() => authorizeAndCanonicalizePath(target, [root])).toThrow(/outside the authorized roots/);
    });
});
//# sourceMappingURL=snapshot.test.js.map