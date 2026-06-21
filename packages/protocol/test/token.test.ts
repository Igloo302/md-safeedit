import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import {
  createToken,
  verifyToken,
  resetSessionSecretForTesting,
  getSessionSecret,
  AnchorPayloadV1
} from '../src/anchor/token.js';

let mockHome: string | null = null;
vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return {
    ...actual,
    homedir: () => mockHome || actual.homedir()
  };
});

describe('HMAC Signed Anchor Tokens', () => {
  const payload: AnchorPayloadV1 = {
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

  beforeEach(() => {
    vi.stubEnv('MDSE_SECRET', '');
    resetSessionSecretForTesting();
    mockHome = null;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetSessionSecretForTesting();
    mockHome = null;
  });

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
    const parts = token.split('.');
    const tamperedPayload = parts[0] + 'X.' + parts[1];
    const tamperedSig = parts[0] + '.' + parts[1] + 'X';

    expect(() => verifyToken(tamperedSig)).toThrow('ANCHOR_INVALID');
    expect(() => verifyToken(tamperedPayload)).toThrow('ANCHOR_INVALID');
  });

  it('rejects expired tokens', () => {
    const expiredPayload = {
      ...payload,
      expiresAt: Date.now() - 1000 // 1s ago
    } as AnchorPayloadV1;
    const token = createToken(expiredPayload);
    expect(() => verifyToken(token)).toThrow('ANCHOR_EXPIRED');
  });

  it('accepts tokens that do not have an expiresAt', () => {
    const noExpiryPayload = {
      ...payload,
      expiresAt: undefined
    } as any;
    const token = createToken(noExpiryPayload);
    expect(verifyToken(token)).toBeDefined();
  });

  it('rejects tokens signed with a different key', () => {
    const token = createToken(payload);
    // Changing the passphrase invalidates the token
    vi.stubEnv('MDSE_SECRET', 'different-passphrase');
    resetSessionSecretForTesting();
    expect(() => verifyToken(token)).toThrow('ANCHOR_INVALID');
  });

  it('rejects malformed token payloads (missing/invalid fields)', () => {
    const validToken = createToken(payload);
    const parts = validToken.split('.');
    const base64Payload = parts[0].slice('mdse_a1_'.length);
    const compressed = Buffer.from(base64Payload, 'base64url');
    const originalPayload = JSON.parse(zlib.inflateRawSync(compressed).toString('utf8'));

    const testMalformed = (mod: (p: any) => void) => {
      const p = { ...originalPayload };
      mod(p);
      const modBase64 = zlib.deflateRawSync(Buffer.from(JSON.stringify(p))).toString('base64url');
      // Sign the malformed payload with the correct key to isolate structural validation
      const hmac = crypto.createHmac('sha256', getSessionSecret());
      hmac.update(modBase64);
      const sig = hmac.digest('base64url');
      const malformedToken = `mdse_a1_${modBase64}.${sig}`;
      expect(() => verifyToken(malformedToken)).toThrow('ANCHOR_INVALID');
    };

    // Missing fileKey
    testMalformed(p => delete p.fileKey);
    // fileKey not string
    testMalformed(p => p.fileKey = 123);
    // range not object
    testMalformed(p => p.range = '10-50');
    // range start/end not numbers
    testMalformed(p => p.range = { start: '10', end: 50 });
    // missing rawHash
    testMalformed(p => delete p.rawHash);
    // structuralPath not array
    testMalformed(p => p.structuralPath = {});
    // version not 1
    testMalformed(p => p.version = 2);
  });

  it('loads and persists secret key in ~/.md-safeedit-secret.key when env is not set', () => {
    const tempDir = path.join(__dirname, 'temp-home-test');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir);

    mockHome = tempDir;
    vi.stubEnv('MDSE_SECRET', '');
    resetSessionSecretForTesting();

    const expectedKeyPath = path.join(tempDir, '.md-safeedit-secret.key');
    expect(fs.existsSync(expectedKeyPath)).toBe(false);

    // Creates the secret key file
    const token1 = createToken(payload);
    expect(fs.existsSync(expectedKeyPath)).toBe(true);
    const key1 = fs.readFileSync(expectedKeyPath, 'utf8').trim();
    expect(key1.length).toBe(64);

    if (process.platform !== 'win32') {
      const stats = fs.statSync(expectedKeyPath);
      expect(stats.mode & 0o077).toBe(0); // 0600 permissions check
    }

    // Reuse the existing key file upon "restart" (resetting secret state)
    resetSessionSecretForTesting();
    const verified = verifyToken(token1);
    expect(verified.fileKey).toBe(payload.fileKey);

    // If permissions are somehow open, they should be corrected on next start
    if (process.platform !== 'win32') {
      fs.chmodSync(expectedKeyPath, 0o644);
      resetSessionSecretForTesting();
      createToken(payload);
      const stats = fs.statSync(expectedKeyPath);
      expect(stats.mode & 0o077).toBe(0); // corrected back to 0600
    }

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
