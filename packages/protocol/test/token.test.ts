import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
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

let mockFsWriteError: ((filePath: string) => boolean) | null = null;
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    writeFileSync: (file: any, data: any, options: any) => {
      if (mockFsWriteError) {
        const filePath = typeof file === 'string' ? file : file.toString();
        if (mockFsWriteError(filePath)) {
          const err = new Error('EPERM: operation not permitted');
          (err as any).code = 'EPERM';
          throw err;
        }
      }
      return actual.writeFileSync(file, data, options);
    }
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

  const testHomeDir = path.join(__dirname, 'temp-home-all-tests');

  beforeEach(() => {
    vi.stubEnv('MDSE_SECRET', '');
    resetSessionSecretForTesting();
    if (!fs.existsSync(testHomeDir)) {
      fs.mkdirSync(testHomeDir, { recursive: true });
    }
    mockHome = testHomeDir;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetSessionSecretForTesting();
    mockHome = null;
    if (fs.existsSync(testHomeDir)) {
      fs.rmSync(testHomeDir, { recursive: true, force: true });
    }
  });

  it('performs successful create and verify round trip', () => {
    const token = createToken(payload);
    expect(token).toMatch(/^mdse_a1_/);
    expect(token.length).toBe(29); // mdse_a1_ (8) + tokenId (12) + . (1) + signature (8)

    const verified = verifyToken(token);
    expect(verified.fileKey).toBe(payload.fileKey);
    expect(verified.sourceRevision).toBe(payload.sourceRevision);
    expect(verified.range.start).toBe(payload.range.start);
  });

  it('rejects tampered tokens (signature or ID mismatch)', () => {
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
    const tokenId = parts[0].slice('mdse_a1_'.length);
    const tokenFile = path.join(testHomeDir, '.md-safeedit', 'tokens', tokenId);
    const originalPayload = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));

    const testMalformed = (mod: (p: any) => void) => {
      const p = { ...originalPayload };
      mod(p);
      
      const malformedId = crypto.randomBytes(9).toString('base64url');
      const malformedFile = path.join(testHomeDir, '.md-safeedit', 'tokens', malformedId);
      fs.writeFileSync(malformedFile, JSON.stringify(p), 'utf8');

      const hmac = crypto.createHmac('sha256', getSessionSecret());
      hmac.update(malformedId);
      const sig = hmac.digest('base64url').slice(0, 8);
      const malformedToken = `mdse_a1_${malformedId}.${sig}`;
      expect(() => verifyToken(malformedToken)).toThrow('ANCHOR_INVALID');
      
      // cleanup
      try { fs.unlinkSync(malformedFile); } catch {}
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

    // Reuse the existing key file upon restart
    resetSessionSecretForTesting();
    const verified = verifyToken(token1);
    expect(verified.fileKey).toBe(payload.fileKey);

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('respects MDSE_TOKENS_DIR environment variable override', () => {
    const customDir = path.join(testHomeDir, 'custom-tokens-dir');
    vi.stubEnv('MDSE_TOKENS_DIR', customDir);

    const token = createToken(payload);
    const parts = token.split('.');
    const tokenId = parts[0].slice('mdse_a1_'.length);

    const expectedFile = path.join(customDir, tokenId);
    expect(fs.existsSync(expectedFile)).toBe(true);

    const verified = verifyToken(token);
    expect(verified.fileKey).toBe(payload.fileKey);
  });

  it('falls back to local workspace directory on EPERM/EACCES sandbox errors', () => {
    // Setup fs mock trigger for write operations to mock home dir
    mockFsWriteError = (filePath: string) => {
      return filePath.includes('.md-safeedit') && filePath.includes(testHomeDir);
    };

    const token = createToken(payload);
    const parts = token.split('.');
    const tokenId = parts[0].slice('mdse_a1_'.length);

    // Verify it wrote to the local workspace dir
    const localDir = path.join(process.cwd(), '.md-safeedit', 'tokens');
    const localFile = path.join(localDir, tokenId);
    expect(fs.existsSync(localFile)).toBe(true);

    // Verify token validation still succeeds by checking fallback
    const verified = verifyToken(token);
    expect(verified.fileKey).toBe(payload.fileKey);

    // Restore fs mock trigger and cleanup
    mockFsWriteError = null;
    if (fs.existsSync(path.join(process.cwd(), '.md-safeedit'))) {
      fs.rmSync(path.join(process.cwd(), '.md-safeedit'), { recursive: true, force: true });
    }
  });
});
