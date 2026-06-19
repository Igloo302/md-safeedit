import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { atomicWriteFile } from '../src/writer/atomic.js';

vi.mock('fs', async () => {
  const actual = await vi.importActual<any>('fs');
  return {
    ...actual,
    renameSync: (...args: any[]) => {
      const src = args[0] as string;
      if (src && src.includes('renamefail')) {
        throw new Error('Simulated rename failure');
      }
      return actual.renameSync(...args);
    }
  };
});

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

  // --- FAULT INJECTION TESTS ---

  it('throws lock acquisition error if a valid lock file exists', () => {
    const targetFile = path.join(tempDir, 'lockfile.md');
    fs.writeFileSync(targetFile, 'Target Content');
    const initHash = crypto.createHash('sha256').update('Target Content').digest('hex');
    const expectedRevision = `sha256:${initHash}`;

    const lockPath = path.join(tempDir, '.lockfile.md.mdse.lock');
    const lockInfo = {
      pid: process.pid,
      transaction_id: 'tx_other',
      created_at: Date.now()
    };
    fs.writeFileSync(lockPath, JSON.stringify(lockInfo));

    const nextBytes = new TextEncoder().encode('New Content');
    expect(() => {
      atomicWriteFile(targetFile, nextBytes, expectedRevision);
    }).toThrow(/LOCK_ACQUISITION_FAILED/);

    expect(fs.readFileSync(targetFile, 'utf-8')).toBe('Target Content');
    expect(fs.existsSync(lockPath)).toBe(true);

    fs.unlinkSync(lockPath);
  });

  it('breaks lock and succeeds if the lock file PID is dead', () => {
    const targetFile = path.join(tempDir, 'deadlock.md');
    fs.writeFileSync(targetFile, 'Target Content');
    const initHash = crypto.createHash('sha256').update('Target Content').digest('hex');
    const expectedRevision = `sha256:${initHash}`;

    let deadPid = 99999;
    while (true) {
      try {
        process.kill(deadPid, 0);
        deadPid++;
      } catch (e: any) {
        if (e.code === 'ESRCH') break;
        deadPid++;
      }
    }

    const lockPath = path.join(tempDir, '.deadlock.md.mdse.lock');
    const lockInfo = {
      pid: deadPid,
      transaction_id: 'tx_dead',
      created_at: Date.now()
    };
    fs.writeFileSync(lockPath, JSON.stringify(lockInfo));

    const nextBytes = new TextEncoder().encode('New Content');
    const nextRev = atomicWriteFile(targetFile, nextBytes, expectedRevision);
    expect(fs.readFileSync(targetFile, 'utf-8')).toBe('New Content');
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it('breaks lock and succeeds if the lock has expired (> 5 mins)', () => {
    const targetFile = path.join(tempDir, 'expiredlock.md');
    fs.writeFileSync(targetFile, 'Target Content');
    const initHash = crypto.createHash('sha256').update('Target Content').digest('hex');
    const expectedRevision = `sha256:${initHash}`;

    const lockPath = path.join(tempDir, '.expiredlock.md.mdse.lock');
    const lockInfo = {
      pid: process.pid,
      transaction_id: 'tx_expired',
      created_at: Date.now() - 360000 // 6 minutes ago
    };
    fs.writeFileSync(lockPath, JSON.stringify(lockInfo));

    const nextBytes = new TextEncoder().encode('New Content');
    const nextRev = atomicWriteFile(targetFile, nextBytes, expectedRevision);
    expect(fs.readFileSync(targetFile, 'utf-8')).toBe('New Content');
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it('cleans up temp files and releases lock if writeSync throws an error', () => {
    const targetFile = path.join(tempDir, 'writefail.md');
    fs.writeFileSync(targetFile, 'Target Content');
    const initHash = crypto.createHash('sha256').update('Target Content').digest('hex');
    const expectedRevision = `sha256:${initHash}`;

    const lockPath = path.join(tempDir, '.writefail.md.mdse.lock');

    expect(() => {
      // Pass null as newBytes to naturally trigger TypeError in writeSync
      atomicWriteFile(targetFile, null as any, expectedRevision);
    }).toThrow();

    expect(fs.readFileSync(targetFile, 'utf-8')).toBe('Target Content');
    expect(fs.existsSync(lockPath)).toBe(false);
    const files = fs.readdirSync(tempDir);
    expect(files.filter(f => f.startsWith('.tmp-'))).toEqual([]);
  });

  it('cleans up temp files and releases lock if renameSync throws an error', () => {
    const targetFile = path.join(tempDir, 'renamefail.md');
    fs.writeFileSync(targetFile, 'Target Content');
    const initHash = crypto.createHash('sha256').update('Target Content').digest('hex');
    const expectedRevision = `sha256:${initHash}`;

    const lockPath = path.join(tempDir, '.renamefail.md.mdse.lock');

    expect(() => {
      const nextBytes = new TextEncoder().encode('New Content');
      atomicWriteFile(targetFile, nextBytes, expectedRevision);
    }).toThrow('Simulated rename failure');

    expect(fs.readFileSync(targetFile, 'utf-8')).toBe('Target Content');
    expect(fs.existsSync(lockPath)).toBe(false);
    const files = fs.readdirSync(tempDir);
    expect(files.filter(f => f.startsWith('.tmp-'))).toEqual([]);
  });
});
