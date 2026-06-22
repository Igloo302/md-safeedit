# MD SafeEdit Core Workflow

This document details the standard operation sequence for reading and mutating Markdown files using MD SafeEdit.

## Workflow Options

### Option A: Combined Atomic Replace/Patch (Recommended)
When the target block contains unique text that allows direct relocation, use the high-level `safe-replace`/`safe-patch` (CLI) or `safe_replace`/`safe_patch` (MCP) command. This executes search, read, CAS verification, relocation, and patch in a single round-trip:

```mermaid
graph TD
    A[Start] --> B{Is MD file?};
    B -- No --> C[Use standard fs tools];
    B -- Yes --> D[Run safe-replace/safe-patch CLI or safe_replace/safe_patch MCP];
    D --> E{Ambiguous / Missing?};
    E -- Yes --> F[Fallback to Option B];
    E -- No --> G[Preview / Commit complete];
    G --> H[End];
```

- **Using CLI (Single-op Dry-run)**:
  ```bash
  mdse safe-replace path/to/file.md "Target unique text" "Replacement content" --json
  mdse safe-patch path/to/file.md delete "Target unique text" --json
  ```
- **Using CLI (Single-op Commit)**:
  ```bash
  mdse safe-replace path/to/file.md "Target unique text" "Replacement content" --commit --json
  mdse safe-patch path/to/file.md delete "Target unique text" --commit --json
  ```
- **Using CLI (Multi-op Commit via JSON file)**:
  ```bash
  mdse safe-patch path/to/file.md path/to/payload.json --commit --json
  ```
- **Using MCP**:
  - For single replacement: call `safe_replace` tool.
  - For deletion, insertions, or multi-op transactions: call `safe_patch` tool. Set `options.dry_run = false` to commit to disk.

---

### Option B: Multi-Step Sequential Workflow
Use this option for complex merges or when the search text is ambiguous:

```mermaid
graph TD
    A[Start] --> B{Is MD file?};
    B -- No --> C[Use standard fs tools];
    B -- Yes --> D[Inspect Outline / Search];
    D --> E[Read Target Node & Get Token];
    E --> F[Reason & Make Edit Locally];
    F --> G[Dry Run Patch];
    G -- Success --> H[Commit with --commit / dry_run:false];
    G -- Failure / Conflict --> I[Error Recovery Workflow];
    H --> J[End];
```

### Step 1: Inspect or Search (Locate Target ID)
Never read the entire file if you only need to modify a small portion. First, inspect the document layout to find the logical block runtime ID:
- **Using CLI**:
  ```bash
  mdse inspect path/to/file.md --json
  ```
- **Using MCP**:
  Call the `inspect` tool with the file path.

If looking for specific text:
- **Using CLI**:
  ```bash
  mdse search path/to/file.md "search query" --json
  ```
- **Using MCP**:
  Call the `search` tool with the file path and query.

### Step 2: Read the Node (Acquire Anchor Token)
Read the exact node you want to modify to get the content and the signed anchor token.
- **Using CLI**:
  ```bash
  mdse read path/to/file.md "section_runtime_id" --json
  ```
- **Using MCP**:
  Call the `read` tool with the runtime ID.

### Step 3: Modify & Dry-run (Preview Changes)
Compute the edits in memory, then execute a **dry-run** patch to verify there are no overlaps or structural violations:
- **Using CLI**:
  ```bash
  mdse patch path/to/file.md replace "anchor_token" "New content string" --json
  ```
- **Using MCP**:
  Call the `patch` tool with `dry_run: true`.

### Step 4: Commit
Once the dry-run diff is verified, execute the write:
- **Using CLI**:
  ```bash
  mdse patch path/to/file.md replace "anchor_token" "New content string" --commit --json
  ```
- **Using MCP**:
  Call the `patch` tool with `dry_run: false`.
