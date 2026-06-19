import { describe, it, expect } from 'vitest';
import { createToken, verifyToken } from '../src/anchor/token.js';
describe('HMAC Signed Anchor Tokens', () => {
    const payload = {
        version: 1,
        fileKey: '/path/to/file.md',
        sourceRevision: 'sha256:abc123hash',
        range: { start: 10, end: 50 },
        rawHash: 'sha256:targethash',
        nodeType: 'paragraph',
        structuralPath: [{ heading: 'Header', level: 1, occurrence: 1 }],
        dialect: 'commonmark+gfm',
        issuedAt: Date.now(),
        expiresAt: Date.now() + 10000 // 10s expiry
    };
    it('performs successful create and verify round trip', () => {
        const token = createToken(payload);
        expect(token).toMatch(/^mdse_a1_/);
        const verified = verifyToken(token);
        expect(verified.fileKey).toBe(payload.fileKey);
        expect(verified.sourceRevision).toBe(payload.sourceRevision);
        expect(verified.range.start).toBe(payload.range.start);
    });
    it('rejects tampered tokens', () => {
        const token = createToken(payload);
        // Modify signature part
        const tamperedSig = token.substring(0, token.length - 4) + 'aaaa';
        expect(() => verifyToken(tamperedSig)).toThrow('ANCHOR_INVALID');
        // Modify payload part (change base64 content)
        const parts = token.split('.');
        const base64Payload = parts[0].slice('mdse_a1_'.length);
        const tamperedPayload = 'mdse_a1_' + base64Payload.substring(0, base64Payload.length - 4) + 'aaaa.' + parts[1];
        expect(() => verifyToken(tamperedPayload)).toThrow('ANCHOR_INVALID');
    });
    it('rejects expired tokens', () => {
        const expiredPayload = {
            ...payload,
            expiresAt: Date.now() - 1000 // Expired 1 second ago
        };
        const token = createToken(expiredPayload);
        expect(() => verifyToken(token)).toThrow('ANCHOR_EXPIRED');
    });
});
//# sourceMappingURL=token.test.js.map