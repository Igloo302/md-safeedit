---
name: md-safeedit
description: Safe, structure-aware Markdown editing using the Compare-and-Swap (CAS) signature-guarded protocol via CLI or MCP.
---

# MD SafeEdit Customization Skill

Use this Skill to safely read and edit existing Markdown documents (`.md` or `.markdown`) without causing formatting loss, fuzzy-match corruption, or silent concurrent overrides.

## 🛡️ Core Rules & Safety Invariants

1. **Applicability Constraint**: 
   - **USE ONLY** for modifying existing `.md` or `.markdown` files.
   - **DO NOT USE** for creating new files or editing non-Markdown formats (like code files or plain `.txt` files).
2. **Sequential Edit Cycle**:
   - Every mutation MUST follow the exact sequence: `inspect`/`search` -> `read` -> `dry-run` -> `commit`.
3. **No Overwrite Bypasses**:
   - **NEVER bypass a conflict** (such as `TARGET_CHANGED` or `DOCUMENT_CHANGED`) by doing a full-file rewrite. Re-read the target node to obtain the latest state and retry the merge.
4. **Tool Preference**:
   - **Prefer local CLI** (`mdse` or `npx mdse` as fallback) for edits. MCP tools are also supported when available.
5. **Version Check**:
   - Run `mdse --version` (or `npx mdse --version`) to ensure the engine is installed and responsive.

---

## ⚡ Core Workflows

### Option A: Combined Atomic Replace/Patch (Recommended - 1 Step)
Use this option when the target block contains unique text that allows direct relocation. It reduces agent turns and token consumption:

- **Single node replacement**:
```bash
# Dry-run patch (Preview)
mdse safe-replace path/to/document.md "Exact unique target text" "New content" --json

# Commit patch
mdse safe-replace path/to/document.md "Exact unique target text" "New content" --commit --json
```
If using MCP, invoke the `safe_replace` tool directly with `file`, `search`, and `replace` arguments.

- **General operations (replace, delete, insert_before, insert_after) or multi-op transactions**:
```bash
# Dry-run single-op
mdse safe-patch path/to/document.md replace "Exact unique target text" "New content" --json
mdse safe-patch path/to/document.md delete "Exact unique target text" --json

# Commit multi-op transaction using payload JSON
mdse safe-patch path/to/document.md path/to/payload.json --commit --json
```
If using MCP, invoke the `safe_patch` tool directly with `file` and `operations` array.

---

### Option B: Sequential Edit Cycle (Multi-Step fallback)
Use this option for complex merges or when the search text is ambiguous:
```text
Inspect / Search (Locate Target ID) -> Read (Acquire Token) -> Edit -> Dry-run Patch -> Commit Patch
```

#### 1. Version Compatibility Check
Before starting any edit, check version compatibility:
```bash
mdse --version
```

#### 2. Locate and Read
Find the node `runtime_id` and acquire the signed `anchor_token`:
```bash
# Outline structure
mdse inspect path/to/document.md --json

# Read node content & token
mdse read path/to/document.md "section_runtime_id" --json
```

#### 3. Dry-run and Commit
Apply the replacement:
```bash
# Dry-run patch (Preview)
mdse patch path/to/document.md replace "anchor_token_here" "New content" --json

# Commit patch
mdse patch path/to/document.md replace "anchor_token_here" "New content" --commit --json
```

---

## 📖 Progressive Disclosure References

For deep dives and exact commands, read the reference files:
* **Workflow Guide**: [workflow.md](file:///.agents/skills/md-safeedit/references/workflow.md)
* **Error Recovery & Bypasses**: [error-recovery.md](file:///.agents/skills/md-safeedit/references/error-recovery.md)
* **Supported Markdown & Targets**: [supported-markdown.md](file:///.agents/skills/md-safeedit/references/supported-markdown.md)
