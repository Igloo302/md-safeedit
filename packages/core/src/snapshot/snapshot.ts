import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export type LineEnding = 'lf' | 'crlf' | 'mixed';
export type Encoding = 'utf-8' | 'utf-8-bom';

export interface ByteRange {
  start: number;
  end: number;
}


export interface FileIdentity {
  device: number;
  inode: number;
}

export interface DocumentSnapshot {
  canonicalPath: string;
  fileIdentity?: FileIdentity;
  bytes: Uint8Array;
  content: string; // The decoded string
  revision: string; // SHA-256 hash
  encoding: Encoding;
  lineEnding: LineEnding;
  createdAt: string;
}

/**
 * Resolves symlinks and ensures the path is canonical and resides within the configured allowed roots.
 * Throws an error if path traversal is detected.
 */
export function authorizeAndCanonicalizePath(targetPath: string, allowedRoots: string[]): string {
  if (allowedRoots.length === 0) {
    throw new Error('No allowed roots configured for path authorization.');
  }

  let canonical: string;
  try {
    canonical = fs.realpathSync(targetPath);
  } catch (err) {
    // If the file doesn't exist yet (e.g. for creation), canonicalize the parent directory
    const resolvedParent = fs.realpathSync(path.dirname(targetPath));
    canonical = path.join(resolvedParent, path.basename(targetPath));
  }

  const isAllowed = allowedRoots.some(root => {
    try {
      const canonicalRoot = fs.realpathSync(root);
      const relative = path.relative(canonicalRoot, canonical);
      // If relative starts with '..' or is absolute, it's outside the root
      return !relative.startsWith('..') && !path.isAbsolute(relative);
    } catch {
      return false;
    }
  });

  if (!isAllowed) {
    throw new Error(`Access Denied: Path "${targetPath}" resolves to "${canonical}" which is outside the authorized roots.`);
  }

  return canonical;
}

/**
 * Detects encoding (UTF-8 vs UTF-8-BOM) and line endings (LF vs CRLF vs mixed) from content bytes.
 */
export function detectFileMetadata(bytes: Uint8Array): { encoding: Encoding; lineEnding: LineEnding; cleanContent: string } {
  let encoding: Encoding = 'utf-8';
  let startOffset = 0;

  // Detect UTF-8 BOM: EF BB BF
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    encoding = 'utf-8-bom';
    startOffset = 3;
  }

  const decoder = new TextDecoder('utf-8');
  const cleanContent = decoder.decode(bytes.subarray(startOffset));

  let lineEnding: LineEnding = 'lf';
  const hasLF = cleanContent.includes('\n');
  const hasCRLF = cleanContent.includes('\r\n');

  if (hasCRLF) {
    // Check if there are also standalone LF endings (i.e. LF not preceded by CR)
    // Replace CRLF with empty, then check if there is still LF
    const withoutCRLF = cleanContent.replace(/\r\n/g, '');
    if (withoutCRLF.includes('\n')) {
      lineEnding = 'mixed';
    } else {
      lineEnding = 'crlf';
    }
  } else if (hasLF) {
    lineEnding = 'lf';
  } else {
    // No line endings, default to lf
    lineEnding = 'lf';
  }

  return { encoding, lineEnding, cleanContent };
}

/**
 * Creates a DocumentSnapshot from a file path.
 */
export function createSnapshot(targetPath: string, allowedRoots: string[]): DocumentSnapshot {
  const canonicalPath = authorizeAndCanonicalizePath(targetPath, allowedRoots);
  
  const stat = fs.statSync(canonicalPath);
  const fileIdentity: FileIdentity = {
    device: stat.dev,
    inode: stat.ino
  };

  const bytes = fs.readFileSync(canonicalPath);
  const { encoding, lineEnding, cleanContent } = detectFileMetadata(bytes);

  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  const revision = `sha256:${hash}`;

  return {
    canonicalPath,
    fileIdentity,
    bytes,
    content: cleanContent,
    revision,
    encoding,
    lineEnding,
    createdAt: new Date().toISOString()
  };
}

/**
 * Helper class to map between JS character offsets and UTF-8 byte offsets.
 */
export class OffsetMapper {
  private charToByte: Float64Array;
  private byteToChar: Float64Array;

  constructor(bytes: Uint8Array, str: string) {
    // Account for potential BOM offset in raw bytes relative to decoded string
    const bomOffset = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
    
    // Float64Array is used instead of Int32Array to avoid silent integer overflow
    // on very large files (Int32Array max ~2.1 GB). Float64 safely handles up to 2^53 bytes.
    this.charToByte = new Float64Array(str.length + 1);
    this.byteToChar = new Float64Array(bytes.length + 1 - bomOffset);

    let charIdx = 0;
    let byteIdx = 0;

    while (charIdx < str.length) {
      this.charToByte[charIdx] = byteIdx;
      this.byteToChar[byteIdx] = charIdx;

      const codePoint = str.codePointAt(charIdx);
      if (codePoint === undefined) break;

      let utf8Len = 0;
      if (codePoint <= 0x7f) utf8Len = 1;
      else if (codePoint <= 0x7ff) utf8Len = 2;
      else if (codePoint <= 0xffff) utf8Len = 3;
      else utf8Len = 4;

      const utf16Len = codePoint > 0xffff ? 2 : 1;

      for (let b = 0; b < utf8Len; b++) {
        this.byteToChar[byteIdx + b] = charIdx;
      }
      for (let c = 0; c < utf16Len; c++) {
        this.charToByte[charIdx + c] = byteIdx;
      }

      byteIdx += utf8Len;
      charIdx += utf16Len;
    }
    this.charToByte[str.length] = byteIdx;
    this.byteToChar[byteIdx] = str.length;

    // Shift everything in charToByte by BOM offset to match raw byte offsets
    if (bomOffset > 0) {
      for (let i = 0; i < this.charToByte.length; i++) {
        this.charToByte[i] += bomOffset;
      }
      // Re-initialize byteToChar to include BOM
      const newByteToChar = new Float64Array(bytes.length + 1);
      for (let b = 0; b < bomOffset; b++) {
        newByteToChar[b] = 0;
      }
      for (let b = 0; b < this.byteToChar.length; b++) {
        newByteToChar[b + bomOffset] = this.byteToChar[b];
      }
      this.byteToChar = newByteToChar;
    }
  }

  toByteOffset(charOffset: number): number {
    if (charOffset < 0) return this.charToByte[0];
    if (charOffset >= this.charToByte.length) return this.charToByte[this.charToByte.length - 1];
    return this.charToByte[charOffset];
  }

  toCharOffset(byteOffset: number): number {
    if (byteOffset < 0) return 0;
    if (byteOffset >= this.byteToChar.length) return this.byteToChar[this.byteToChar.length - 1];
    return this.byteToChar[byteOffset];
  }
}
