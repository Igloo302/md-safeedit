import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface LockInfo {
  pid: number;
  transaction_id: string;
  created_at: number;
}

/**
 * Computes the lock file path for a target file.
 */
function getLockFilePath(filePath: string): string {
  const dir = path.dirname(filePath);
  const name = path.basename(filePath);
  return path.join(dir, `.${name}.mdse.lock`);
}

/**
 * Acquires a cooperative lock on the target file.
 */
export function acquireLock(filePath: string, transactionId: string): void {
  const lockPath = getLockFilePath(filePath);
  let fd: number;

  try {
    fd = fs.openSync(lockPath, 'wx');
  } catch (err: any) {
    if (err.code === 'EEXIST') {
      try {
        const content = fs.readFileSync(lockPath, 'utf8');
        const info = JSON.parse(content) as LockInfo;

        let isAlive = false;
        try {
          process.kill(info.pid, 0);
          isAlive = true;
        } catch (e: any) {
          isAlive = e.code !== 'ESRCH';
        }

        const isExpired = Date.now() - info.created_at > 300000; // 5 minutes

        if (!isAlive || isExpired) {
          fs.unlinkSync(lockPath);
          fd = fs.openSync(lockPath, 'wx');
        } else {
          throw new Error(`LOCK_ACQUISITION_FAILED: File is locked by transaction "${info.transaction_id}" (PID ${info.pid}).`);
        }
      } catch (readErr: any) {
        if (readErr.message.includes('LOCK_ACQUISITION_FAILED')) {
          throw readErr;
        }
        try {
          fs.unlinkSync(lockPath);
          fd = fs.openSync(lockPath, 'wx');
        } catch {
          throw new Error(`LOCK_ACQUISITION_FAILED: File is locked and lock metadata is unreadable.`);
        }
      }
    } else {
      throw new Error(`IO_ERROR: Failed to create lock file: ${err.message}`);
    }
  }

  try {
    const info: LockInfo = {
      pid: process.pid,
      transaction_id: transactionId,
      created_at: Date.now()
    };
    fs.writeFileSync(fd, JSON.stringify(info));
    fs.closeSync(fd);
  } catch (err: any) {
    try {
      fs.closeSync(fd);
      fs.unlinkSync(lockPath);
    } catch {}
    throw new Error(`IO_ERROR: Failed to write lock file: ${err.message}`);
  }
}

/**
 * Releases a cooperative lock on the target file.
 */
export function releaseLock(filePath: string): void {
  const lockPath = getLockFilePath(filePath);
  try {
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
    }
  } catch {}
}

/**
 * Computes the SHA-256 revision hash of a file's bytes.
 */
function getFileRevision(filePath: string): string {
  const bytes = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  return `sha256:${hash}`;
}

/**
 * Safely and atomically replaces targetFilePath with newBytes.
 */
export function atomicWriteFile(
  targetFilePath: string,
  newBytes: Uint8Array,
  expectedRevision: string,
  transactionId: string = `tx_${crypto.randomBytes(6).toString('hex')}`
): string {
  // Acquire lock before writing or checking revision
  acquireLock(targetFilePath, transactionId);

  const targetDir = path.dirname(targetFilePath);
  const targetName = path.basename(targetFilePath);
  const tempFilePath = path.join(targetDir, `.tmp-${targetName}-${crypto.randomBytes(6).toString('hex')}`);

  let originalMode: number | undefined;
  let exists = false;

  try {
    const stat = fs.statSync(targetFilePath);
    originalMode = stat.mode;
    exists = true;
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      releaseLock(targetFilePath);
      throw new Error(`IO_ERROR: Failed to stat target file: ${err.message}`);
    }
  }

  // Write new content to temporary file and fsync it
  let tempFd: number = -1;
  try {
    tempFd = fs.openSync(tempFilePath, 'w', originalMode);
    fs.writeSync(tempFd, newBytes);
    fs.fsyncSync(tempFd);
    fs.closeSync(tempFd);
    tempFd = -1;
  } catch (err: any) {
    // Always close the fd before attempting to delete on Windows
    if (tempFd !== -1) {
      try { fs.closeSync(tempFd); } catch {}
      tempFd = -1;
    }
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch {}
    releaseLock(targetFilePath);
    throw new Error(`IO_ERROR: Failed to write temporary file: ${err.message}`);
  }

  // Commit phase
  try {
    if (exists) {
      // CAS check
      let currentRevision: string;
      try {
        currentRevision = getFileRevision(targetFilePath);
      } catch (err: any) {
        throw new Error(`IO_ERROR: Failed to read target file for revision check: ${err.message}`);
      }

      if (currentRevision !== expectedRevision) {
        throw new Error('COMMIT_RACE');
      }
    }

    // Atomic rename
    fs.renameSync(tempFilePath, targetFilePath);

    // Fsync parent directory (POSIX only)
    if (process.platform !== 'win32') {
      try {
        const dirFd = fs.openSync(targetDir, 'r');
        fs.fsyncSync(dirFd);
        fs.closeSync(dirFd);
      } catch {}
    }
  } catch (err: any) {
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch {}
    releaseLock(targetFilePath);

    if (err.message === 'COMMIT_RACE') {
      throw err;
    }
    throw new Error(`IO_ERROR: Failed to rename temporary file: ${err.message}`);
  }

  // Calculate new revision
  let finalRevision: string;
  try {
    finalRevision = getFileRevision(targetFilePath);
  } catch (err: any) {
    releaseLock(targetFilePath);
    throw new Error(`IO_ERROR: Failed to read final file revision: ${err.message}`);
  }

  // Release lock
  releaseLock(targetFilePath);

  return finalRevision;
}
