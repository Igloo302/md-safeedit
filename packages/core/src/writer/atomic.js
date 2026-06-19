import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
/**
 * Computes the SHA-256 revision hash of a file's bytes.
 */
function getFileRevision(filePath) {
    const bytes = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    return `sha256:${hash}`;
}
/**
 * Safely and atomically replaces targetFilePath with newBytes.
 *
 * Flow:
 * 1. Checks if original file exists. If it does, record its permissions.
 * 2. Writes newBytes to a temporary file in the same directory.
 * 3. Applies the original file permissions to the temporary file.
 * 4. Checks the current revision of the target file. If it doesn't match expectedRevision, aborts with COMMIT_RACE.
 * 5. Renames the temporary file to the target path (atomic replace).
 * 6. Cleans up temporary files on error.
 */
export function atomicWriteFile(targetFilePath, newBytes, expectedRevision) {
    const targetDir = path.dirname(targetFilePath);
    const targetName = path.basename(targetFilePath);
    const tempFilePath = path.join(targetDir, `.tmp-${targetName}-${crypto.randomBytes(6).toString('hex')}`);
    let originalMode;
    let exists = false;
    try {
        const stat = fs.statSync(targetFilePath);
        originalMode = stat.mode;
        exists = true;
    }
    catch (err) {
        if (err.code !== 'ENOENT') {
            throw new Error(`IO_ERROR: Failed to stat target file: ${err.message}`);
        }
    }
    // Write new content to temporary file
    try {
        fs.writeFileSync(tempFilePath, newBytes);
        if (originalMode !== undefined) {
            fs.chmodSync(tempFilePath, originalMode);
        }
    }
    catch (err) {
        // Cleanup temporary file
        try {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }
        catch { }
        throw new Error(`IO_ERROR: Failed to write temporary file: ${err.message}`);
    }
    // Commit phase
    try {
        if (exists) {
            // Re-read current file to verify no concurrent modification occurred (CAS check)
            let currentRevision;
            try {
                currentRevision = getFileRevision(targetFilePath);
            }
            catch (err) {
                throw new Error(`IO_ERROR: Failed to read target file for revision check: ${err.message}`);
            }
            if (currentRevision !== expectedRevision) {
                throw new Error('COMMIT_RACE');
            }
        }
        // Atomic rename
        fs.renameSync(tempFilePath, targetFilePath);
    }
    catch (err) {
        // Cleanup
        try {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }
        catch { }
        if (err.message === 'COMMIT_RACE') {
            throw err;
        }
        throw new Error(`IO_ERROR: Failed to rename temporary file: ${err.message}`);
    }
    // Calculate new revision
    return getFileRevision(targetFilePath);
}
//# sourceMappingURL=atomic.js.map