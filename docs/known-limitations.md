# MD SafeEdit Known Limitations

This document lists the known limitations, deferred capabilities, and design constraints of MD SafeEdit version `0.1.0-alpha.1`.

---

## 1. Supported Syntax & Mutation Targets

MD SafeEdit operates strictly on block-level AST nodes. The following limitations apply to mutations:

### A. Mutation Targets (Phase 1)
Only the following structural blocks can be targets of a mutation (`replace`, `delete`, `insert_before`, `insert_after`):
* `section` (a heading and all of its sub-content up to the next heading of same or higher level)
* `list_item`
* `table_row`
* `paragraph`

### B. Unsupported Mutation Targets
The following block types can be read and inspected, but cannot be direct targets of a mutation:
* Fenced code blocks (`code_block`)
* Tables as a whole (`table`)
* Blockquotes (`blockquote`)
* HTML blocks (`html`)
* YAML frontmatter as a whole (`frontmatter`)

### C. Inline Span Editing
* Arbitrary inline editing (e.g., changing a single word inside a paragraph, or changing a link URL) is **not supported** as a direct target. The entire paragraph or section containing the inline element must be replaced.

---

## 2. Relocation & Verification Constraints

To prevent unsafe and incorrect writes, the relocation engine is extremely strict:

### A. Raw-Byte Identity Relocation
* Automatic relocation of a target node (when the surrounding file has changed) is authorized **only** if the target node's content matches the original token's raw-byte hash (`rawHash`) exactly.
* MD SafeEdit **never** uses fuzzy similarity or semantic merging to authorize a write. If the target node has been modified in any way (even formatting, spacing, or casing), automatic relocation will fail with `TARGET_CHANGED`.

### B. Ambiguous Candidates
* If a document contains multiple nodes with the exact same content and structure (e.g., two identical list items `- Item A` under the same heading with no other distinguishing context), and the document is modified such that their offsets shift, MD SafeEdit will reject the write with `ANCHOR_AMBIGUOUS` to prevent silent mis-editing.

---

## 3. Formatting & Line Endings

### A. Untouched Byte Ranges
* MD SafeEdit guarantees that all untouched regions of the Markdown file remain byte-for-byte identical. 
* The system will **never** normalize line endings (LF vs CRLF), indentations, table alignments, or trailing whitespace outside the mutated node.

### B. Mutated Node Formatting
* The replacement content provided by the agent is parsed and inserted exactly. It is the agent's responsibility to match the document's indentation style and line-ending scheme for the new content block.

---

## 4. Multi-File and Process Operations

### A. Single-File Scope
* All transactions are strictly limited to a single Markdown file. Multi-file atomic commits or directory-wide rollback transactions are deferred to V2.

### B. Cooperative Locking Limit
* The lockfile mechanism (`.mdse.lock`) is cooperative. It prevents concurrent instances of MD SafeEdit from colliding. 
* It **does not** prevent non-cooperative tools (like standard text editors, git checkouts, or generic shell scripts) from writing directly to the target file.
