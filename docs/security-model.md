# MD SafeEdit Security Model

This document outlines the threat model, security controls, and safety invariants of MD SafeEdit version `0.1.0-alpha.1`.

---

## 1. Overview

MD SafeEdit is designed to protect Markdown source files from silent edits, corruption, and race conditions when modified by autonomous AI agents or local IDE tools. The tool acts as a structural gatekeeper: it ensures that all edits are signed, verified, and applied only if the target content remains exactly as the agent observed it.

---

## 2. Threat Model & Mitigation Strategy

### A. Directory Traversal & Unauthorized Access
* **Threat**: An agent or external actor requests to read or write a file outside the authorized workspace (e.g. `/etc/passwd`).
* **Mitigation**: 
  * Strict path resolution using canonical absolute paths (`fs.realpathSync`).
  * Check that the canonical path resides within a configured list of allowed directories (`MDSE_ALLOWED_ROOTS`).
  * Rejection of symlinks to prevent symlink-based escape out of the allowed roots.
  * Validation of file extensions to target only Markdown (`.md`, `.markdown`, `.mdown`, `.mkd`). Directories, devices, sockets, and other non-regular file types are explicitly rejected.

### B. Opaque Token Tampering & Forgeability
* **Threat**: An agent modifies the target byte range, file key, or revision hash within a token to bypass validation and force a write to an arbitrary location.
* **Mitigation**:
  * Tokens are cryptographically signed using an HMAC-SHA256 signature.
  * The signature covers the entire base64-encoded JSON representation of the payload metadata, including:
    * `fileKey` (canonical path)
    * `sourceRevision` (file content hash)
    * `range` (exact target byte offsets)
    * `rawHash` (target node content hash)
    * `nodeType`
    * `structuralPath` (path fingerprint)
    * `issuedAt` and `expiresAt` timestamps.
  * The signing key is retrieved from `process.env.MDSE_SECRET` or loaded from `~/.md-safeedit-secret.key` with restricted POSIX permissions (`0600`).
  * Verification utilizes a constant-time comparison (`crypto.timingSafeEqual`) to prevent timing attacks.
  * Strict structural validation is performed on the decoded token payload to ensure no fields are missing or malformed.

### C. Concurrent Modifiers & Race Conditions (TOCTOU)
* **Threat**: A human developer or a concurrent agent process modifies the file after the token is issued but before the patch is committed, leading to lost updates or incorrect relocations.
* **Mitigation**:
  * **Cooperative Lockfile**: Prior to reading and patching, an atomic cooperative lockfile is created (`.${filename}.mdse.lock`) containing the PID, transaction ID, and timestamp. Lock files of dead processes or older than 5 minutes are broken automatically.
  * **Double Revision Verification**: The file's revision hash is checked during the initial read and verified again *immediately* before renaming the temporary patch file onto the original file. If the hash does not match, the transaction is rejected, leaving the original file completely untouched.
  * **All-or-Nothing Transactions**: Multiple operations in a single patch request are validated together. If any individual operation fails validation (e.g. overlapping edits, stale token), the entire transaction aborts.

---

## 3. Strict Atomic Write Sequence

To minimize the race window and ensure zero disk corruption on failure, the following write sequence is strictly enforced:

1. **Acquire Lock**: Atomically open `.${filename}.mdse.lock` using the exclusive write flag (`wx`).
2. **Read Revision**: Verify the current disk file's hash against the expected pre-commit revision.
3. **Write Temp File**: Write the patched document bytes to `.${filename}.mdse.tmp` in the same directory.
4. **Flush Temp File**: Call `fs.fsyncSync` on the temp file descriptor to ensure all bytes are flushed to physical storage.
5. **Close Temp File**: Close the file descriptor.
6. **Double-Check Revision**: Read the original file's hash once more.
7. **Atomic Rename**: Swap the temporary file over the target file using `fs.renameSync`.
8. **Flush Directory (POSIX)**: Open the parent directory and call `fs.fsyncSync` to commit the directory entry modification to disk.
9. **Release Lock**: Delete the cooperative lock file.

---

## 4. Residual Risks & Limitations

Because standard operating systems (macOS, Linux, Windows) do not expose user-space API calls for atomic transactional multi-process compare-and-swap, a micro-second Time-of-Check to Time-of-Use (TOCTOU) race window exists between step 6 (double-check revision) and step 7 (rename) if an external non-cooperative process (such as a standard text editor) bypasses the cooperative lockfile and writes directly to the file. 

This window is kept as small as possible (typically a single system call) and is mitigated in shared environments by using cooperative agents and locking.
