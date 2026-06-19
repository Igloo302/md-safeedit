import * as crypto from 'crypto';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

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

function getOrCreateSecret(): Buffer {
  const secretPath = path.join(os.homedir(), '.md-safeedit-secret.key');
  try {
    if (fs.existsSync(secretPath)) {
      const secretHex = fs.readFileSync(secretPath, 'utf8').trim();
      if (secretHex.length === 64) {
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

const sessionSecret = getOrCreateSecret();

/**
 * Creates a signed, tamper-proof, opaque anchor token.
 */
export function createToken(payload: AnchorPayloadV1): string {
  const payloadStr = JSON.stringify(payload);
  const base64Payload = Buffer.from(payloadStr).toString('base64url');
  
  const hmac = crypto.createHmac('sha256', sessionSecret);
  hmac.update(base64Payload);
  const signature = hmac.digest('base64url');
  
  return `mdse_a1_${base64Payload}.${signature}`;
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

  const [base64Payload, signature] = parts;

  const hmac = crypto.createHmac('sha256', sessionSecret);
  hmac.update(base64Payload);
  const expectedSignature = hmac.digest('base64url');

  // Time-constant comparison to mitigate timing attacks
  let isValid = false;
  try {
    isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'base64url'),
      Buffer.from(expectedSignature, 'base64url')
    );
  } catch {
    isValid = false;
  }

  if (!isValid) {
    throw new Error('ANCHOR_INVALID');
  }

  try {
    const payloadStr = Buffer.from(base64Payload, 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadStr) as AnchorPayloadV1;

    if (payload.version !== 1) {
      throw new Error('ANCHOR_INVALID');
    }

    if (payload.expiresAt && Date.now() > payload.expiresAt) {
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
