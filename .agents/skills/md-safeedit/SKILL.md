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
   - **Prefer local CLI** (`npx mdse`) for edits. MCP tools are also supported when available.
5. **Version Check**:
   - Run the helper script `.agents/skills/md-safeedit/scripts/md-safeedit check` to ensure compatibility.

---

## ⚡ Core Workflow Summary

```text
Inspect / Search (Locate Target ID)
       ↓
Read (Acquire Content & Signed Anchor Token)
       ↓
Edit (Compute replacement locally)
       ↓
Dry-run Patch (Verify preview diff)
       ↓
Commit Patch (Apply mutation to disk)
```

### 1. Version Compatibility Check
Before starting any edit, check version compatibility:
```bash
node .agents/skills/md-safeedit/scripts/md-safeedit check
```

### 2. Locate and Read
Find the node `runtime_id` and acquire the signed `anchor_token`:
```bash
# Outline structure
npx mdse inspect path/to/document.md --json

# Read node content & token
npx mdse read path/to/document.md "section_runtime_id" --json
```

### 3. Dry-run and Commit
Apply the replacement. The patch defaults to dry-run (preview). Add `--commit` to write to disk:
```bash
# Dry-run patch (Preview)
npx mdse patch path/to/document.md replace "anchor_token_here" "New content" --json

# Commit patch
npx mdse patch path/to/document.md replace "anchor_token_here" "New content" --commit --json
```

---

## 📖 Progressive Disclosure References

For deep dives and exact commands, read the reference files:
* **Workflow Guide**: [workflow.md](file:///.agents/skills/md-safeedit/references/workflow.md)
* **Error Recovery & Bypasses**: [error-recovery.md](file:///.agents/skills/md-safeedit/references/error-recovery.md)
* **Supported Markdown & Targets**: [supported-markdown.md](file:///.agents/skills/md-safeedit/references/supported-markdown.md)
