import * as crypto from 'crypto';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

export interface StructuralEvidence {
  pathFingerprint: string;
  parentFingerprint?: string;
  previousFingerprint?: string;
  nextFingerprint?: string;
  siblingOccurrence?: number;
  blockId?: string;
}

export interface AnchorPayloadV1 {
  version: 1;
  fileKey: string; // Resolved canonical file path
  sourceRevision: string;
  range: {
    start: number;
    end: number;
  };
  rawHash: string;
  nodeType: string;
  structuralPath: {
    heading: string;
    level: number;
    occurrence: number;
  }[];
  structuralEvidence?: StructuralEvidence;
  blockId?: string;
  dialect: string;
  issuedAt: number;
  expiresAt?: number;
}

let sessionSecret: Buffer | null = null;

export function getSessionSecret(): Buffer {
  if (!sessionSecret) {
    sessionSecret = getOrCreateSecret();
  }
  return sessionSecret;
}

// For testing purposes
export function resetSessionSecretForTesting(): void {
  sessionSecret = null;
}

function getOrCreateSecret(): Buffer {
  if (process.env.MDSE_SECRET) {
    const envVal = process.env.MDSE_SECRET.trim();
    if (envVal.length === 64 && /^[0-9a-fA-F]+$/.test(envVal)) {
      return Buffer.from(envVal, 'hex');
    }
    return crypto.createHash('sha256').update(envVal).digest();
  }

  const secretPath = path.join(os.homedir(), '.md-safeedit-secret.key');
  try {
    if (fs.existsSync(secretPath)) {
      if (process.platform !== 'win32') {
        const stats = fs.statSync(secretPath);
        const mode = stats.mode & 0o777;
        if ((mode & 0o077) !== 0) {
          fs.chmodSync(secretPath, 0o600);
        }
      }
      const secretHex = fs.readFileSync(secretPath, 'utf8').trim();
      if (secretHex.length === 64 && /^[0-9a-fA-F]+$/.test(secretHex)) {
        return Buffer.from(secretHex, 'hex');
      }
    }
  } catch {}

  const newSecret = crypto.randomBytes(32);
  try {
    fs.mkdirSync(path.dirname(secretPath), { recursive: true });
    fs.writeFileSync(secretPath, newSecret.toString('hex'), { mode: 0o600 });
  } catch {}
  return newSecret;
}

function getTokensDir(): string {
  if (process.env.MDSE_TOKENS_DIR) {
    return path.resolve(process.env.MDSE_TOKENS_DIR);
  }
  return path.join(os.homedir(), '.md-safeedit', 'tokens');
}

function getLocalTokensDir(): string {
  return path.join(process.cwd(), '.md-safeedit', 'tokens');
}

function pruneExpiredTokens(): void {
  const dirs = [getTokensDir(), getLocalTokensDir()];
  const now = Date.now();
  const oneDayMs = 24 * 3600 * 1000;
  for (const dir of dirs) {
    try {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        try {
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > oneDayMs) {
            fs.unlinkSync(filePath);
          }
        } catch {}
      }
    } catch {}
  }
}

/**
 * Creates a signed, tamper-proof, opaque anchor token.
 */
export function createToken(payload: AnchorPayloadV1): string {
  pruneExpiredTokens();

  // Generate a secure 9-byte ID (12 characters in base64url)
  const tokenId = crypto.randomBytes(9).toString('base64url');

  // Compute signature (first 8 characters of HMAC-SHA256)
  const hmac = crypto.createHmac('sha256', getSessionSecret());
  hmac.update(tokenId);
  const signature = hmac.digest('base64url').slice(0, 8);

  // Save payload in configured directory, fallback to local workspace if EPERM/EACCES
  const tokensDir = getTokensDir();
  try {
    fs.mkdirSync(tokensDir, { recursive: true });
    const tokenFile = path.join(tokensDir, tokenId);
    fs.writeFileSync(tokenFile, JSON.stringify(payload), 'utf8');
  } catch (err: any) {
    if (err.code === 'EPERM' || err.code === 'EACCES') {
      const localDir = getLocalTokensDir();
      try {
        fs.mkdirSync(localDir, { recursive: true });
        const localFile = path.join(localDir, tokenId);
        fs.writeFileSync(localFile, JSON.stringify(payload), 'utf8');
      } catch {
        throw err;
      }
    } else {
      throw err;
    }
  }

  return `mdse_a1_${tokenId}.${signature}`;
}

/**
 * Verifies a token's signature and expiry, returning the decoded payload on success.
 * Throws errors with stable codes: ANCHOR_INVALID, ANCHOR_EXPIRED.
 */
export function verifyToken(token: string): AnchorPayloadV1 {
  if (!token || !token.startsWith('mdse_a1_')) {
    throw new Error('ANCHOR_INVALID');
  }

  const parts = token.slice('mdse_a1_'.length).split('.');
  if (parts.length !== 2) {
    throw new Error('ANCHOR_INVALID');
  }

  const [tokenId, signature] = parts;

  // Verify signature
  const hmac = crypto.createHmac('sha256', getSessionSecret());
  hmac.update(tokenId);
  const expectedSignature = hmac.digest('base64url').slice(0, 8);

  if (signature !== expectedSignature) {
    throw new Error('ANCHOR_INVALID');
  }

  // Find the token file in either default or local dir
  let tokenFile = path.join(getTokensDir(), tokenId);
  if (!fs.existsSync(tokenFile)) {
    tokenFile = path.join(getLocalTokensDir(), tokenId);
  }

  if (!fs.existsSync(tokenFile)) {
    throw new Error('ANCHOR_INVALID');
  }

  try {
    const payloadStr = fs.readFileSync(tokenFile, 'utf8');
    const payload = JSON.parse(payloadStr) as AnchorPayloadV1;

    if (payload.version !== 1) {
      throw new Error('ANCHOR_INVALID');
    }

    if (
      typeof payload.fileKey !== 'string' ||
      typeof payload.sourceRevision !== 'string' ||
      !payload.range ||
      typeof payload.range.start !== 'number' ||
      typeof payload.range.end !== 'number' ||
      typeof payload.rawHash !== 'string' ||
      typeof payload.nodeType !== 'string' ||
      !Array.isArray(payload.structuralPath) ||
      typeof payload.issuedAt !== 'number'
    ) {
      throw new Error('ANCHOR_INVALID');
    }

    if (payload.expiresAt && Date.now() > payload.expiresAt) {
      // Auto-delete expired token file
      try { fs.unlinkSync(tokenFile); } catch {}
      throw new Error('ANCHOR_EXPIRED');
    }

    return payload;
  } catch (err: any) {
    if (err.message === 'ANCHOR_EXPIRED') {
      throw err;
    }
    throw new Error('ANCHOR_INVALID');
  }
}
