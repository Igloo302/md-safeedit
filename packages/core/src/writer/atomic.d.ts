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
export declare function atomicWriteFile(targetFilePath: string, newBytes: Uint8Array, expectedRevision: string): string;
