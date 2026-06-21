# MD SafeEdit Error Recovery and Conflict Resolution

When editing files in parallel or during ongoing agent operations, changes to the target file may cause edit conflicts. This document guides you on how to handle these errors safely and reconstruct patches without compromising file safety.

## ⚠️ The Golden Rule: No Bypasses

> [!DANGER]
> **NEVER bypass a safety conflict by executing a full-file rewrite or fallback exact-string replacement.**
> If MD SafeEdit rejects a patch (e.g., due to target mismatch or document change), it means the file state has drifted. Overwriting the file directly bypasses these protections and risks reverting concurrent work or corrupting structure. You must resolve the conflict cleanly through the retry protocol.

## Conflict Error Codes & Exit Statuses

| Exit Code | Error Code | Description | Correct Recovery Flow |
| :---: | :--- | :--- | :--- |
| **2** | `TARGET_CHANGED` / `DOCUMENT_CHANGED` | The file has changed or the target section content has drifted since it was read. | **Read latest state and merge**. See flow below. |
| **3** | `ANCHOR_EXPIRED` | The anchor token is older than the configured TTL (default 1 hour). | Re-read node to get a fresh token, and re-apply. |
| **4** | `ANCHOR_INVALID` / `ANCHOR_AMBIGUOUS` | Relocation cannot be solved safely due to matching ambiguity or corrupt token. | **Stop and report**. Do not attempt automatic relocation. |
| **5** | `VALIDATION_FAILED` | Resulting document violates markdown constraints or overlapping ranges occurred. | Correct replacement format or split operations. |
| **6** | `COMMIT_RACE` | Concurrent write lock collision occurred at commit time. | Wait 100ms and retry the write phase. |

## Detailed Conflict Recovery Protocol (Exit Code 2 / 6)

When encountering `TARGET_CHANGED`, `DOCUMENT_CHANGED`, or `COMMIT_RACE`, execute these recovery steps:

1. **Re-Inspect the Document**:
   Obtain the latest outline structure and document revision.
   ```bash
   npx mdse inspect path/to/file.md --json
   ```

2. **Re-Read the Target Node**:
   Retrieve the updated content and a fresh `anchor_token` for the target node.
   ```bash
   npx mdse read path/to/file.md "node_runtime_id" --json
   ```

3. **Merge Edits Locally**:
   Compare the fresh content against your planned replacement. If the changes do not overlap semantically, apply your edits on top of the new node content. If there is a semantic conflict, ask the user for guidance.

4. **Dry-Run & Commit**:
   Perform a dry-run first to verify the new token and revision, then write to disk.
   ```bash
   # Dry-run
   npx mdse patch path/to/file.md replace "new_anchor_token" "Merged content" --json
   
   # Commit
   npx mdse patch path/to/file.md replace "new_anchor_token" "Merged content" --commit --json
   ```
