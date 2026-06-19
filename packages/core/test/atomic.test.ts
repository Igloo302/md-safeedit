import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { atomicWriteFile } from '../src/writer/atomic.js';

const tempDir = path.join(process.cwd(), 'packages/core/test-temp');

describe('Atomic File Writer', () => {
  beforeEach(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('atomically writes a new file and returns new revision', () => {
    const targetFile = path.join(tempDir, 'test1.txt');
    const bytes = new TextEncoder().encode('Hello World');

    // For new files, expectedRevision is empty string or ignored since file doesn't exist
    const newRev = atomicWriteFile(targetFile, bytes, '');
    expect(fs.readFileSync(targetFile, 'utf-8')).toBe('Hello World');
    expect(newRev).toMatch(/^sha256:/);
  });

  it('replaces an existing file only if revision matches (CAS check)', () => {
    const targetFile = path.join(tempDir, 'test2.txt');
    fs.writeFileSync(targetFile, 'Initial Content');

    const initHash = crypto.createHash('sha256').update('Initial Content').digest('hex');
    const expectedRevision = `sha256:${initHash}`;

    // Successful CAS write
    const nextBytes = new TextEncoder().encode('Updated Content');
    const nextRev = atomicWriteFile(targetFile, nextBytes, expectedRevision);
    
    expect(fs.readFileSync(targetFile, 'utf-8')).toBe('Updated Content');
    expect(nextRev).not.toBe(expectedRevision);
  });

  it('throws COMMIT_RACE if the file changed concurrently', () => {
    const targetFile = path.join(tempDir, 'test3.txt');
    fs.writeFileSync(targetFile, 'Initial Content');

    const expectedRevision = 'sha256:oldhashgoeshere'; // Mismatched revision

    const nextBytes = new TextEncoder().encode('Updated Content');
    expect(() => {
      atomicWriteFile(targetFile, nextBytes, expectedRevision);
    }).toThrow('COMMIT_RACE');

    // Verify original content remains intact
    expect(fs.readFileSync(targetFile, 'utf-8')).toBe('Initial Content');
  });
});
