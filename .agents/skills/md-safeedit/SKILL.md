---
name: md-safeedit
description: Safe, structure-aware Markdown editing using the Compare-and-Swap (CAS) signature-guarded protocol via CLI or MCP.
---

# MD SafeEdit Skill

Use this Skill to safely read and edit Markdown documents (`.md` or `.markdown`) without causing formatting loss, fuzzy-match corruption, or silent concurrent overrides.

---

## ⚡ Core Workflow

When asked to inspect, find, or modify any Markdown file, follow this structured, node-level edit cycle:

```text
Inspect / Search (Locate Target ID)
       ↓
Read (Acquire Content & Signed Anchor Token)
       ↓
Edit (Compute replacement locally)
       ↓
Patch (Apply mutation atomically)
```

### 1. Locate the Target
First, do not read the entire file. Use the local CLI tool to get the document structure or search for content:

```bash
# Get the outline structure and section headers
npx -y @md-safeedit/cli@dev inspect path/to/document.md

# Search for specific sections, list items, or tables
npx -y @md-safeedit/cli@dev search path/to/document.md "your query"
```

Find the `runtime_id` of the logical node (e.g., `section:Installation` or `table_row:3`) you wish to read or modify.

### 2. Read the Node and Acquire Token
Read the target node's content and acquire the cryptographically signed `anchor_token` representing that exact state:

```bash
npx -y @md-safeedit/cli@dev read path/to/document.md "list_item:5"
```
*Output is JSON. Extract the `content` and the `anchor.token` string.*

### 3. Reason & Modify
Edit the content locally in memory.

### 4. Patch (Preview & Commit)
Apply the patch using the token. By default, `patch` performs a **dry run** (preview diff). Add `--commit` to actually write the change:

```bash
# Preview the patch (Dry Run)
npx -y @md-safeedit/cli@dev patch path/to/document.md replace "anchor_token_here" "New content block"

# Commit the patch to disk
npx -y @md-safeedit/cli@dev patch path/to/document.md replace "anchor_token_here" "New content block" --commit
```

---

## 🛡️ Error Handling & Conflict Recovery

The CLI outputs machine-readable JSON and exits with specific status codes. Use them to recover dynamically:

| Exit Code | Error Code | Root Cause | Agent Action |
| :---: | :--- | :--- | :--- |
| **0** | - | Success | Continue workflow. |
| **2** | `TARGET_CHANGED` / `DOCUMENT_CHANGED` | File or target modified by someone else since read. | **Conflict recovery required.** Call `inspect`/`search` and `read` again to obtain the latest content/token, merge the edits, and retry. *See reference below.* |
| **3** | `ANCHOR_EXPIRED` | Signed token expired (default TTL is 1 hour). | Call `read` again to fetch a fresh token, and retry the patch. |
| **4** | `ANCHOR_INVALID` / `ANCHOR_AMBIGUOUS` | Token signature mismatch or multiple matching nodes found. | Relocation is ambiguous or token is corrupted. Stop and ask the user for clarification. |
| **5** | `VALIDATION_FAILED` / `INVALID_REPLACEMENT` | Syntax validation failed or operations overlap. | Check replacement content structure or operation boundaries. |
| **6** | `IO_ERROR` / `COMMIT_RACE` | File I/O issue or disk commit race. | Retry after a short delay or report write permissions issue. |

---

## 🛠️ MCP Alternative

If you are running in a host environment (like Cursor, Claude Desktop, or custom IDEs) where the `md-safeedit` MCP server is registered, you should **prefer calling the native MCP tools** (`inspect`, `search`, `read`, `patch`) instead of executing shell commands. The logical workflow remains identical.

---

## 📖 Progressive Disclosure References

For deep dives and troubleshooting templates:
* **Conflict Resolution**: Read [.agents/skills/md-safeedit/references/conflict-resolution.md](file:///.agents/skills/md-safeedit/references/conflict-resolution.md) to learn how to merge concurrent changes when encountering exit code `2`.
