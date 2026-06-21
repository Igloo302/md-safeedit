# MD SafeEdit Supported Syntax and Applicability

This document details when to apply the MD SafeEdit protocol and what Markdown structures are supported.

## 🔍 Applicability Decision Matrix

| Task Type | Target Format | Recommendation | Reason |
| :--- | :--- | :--- | :--- |
| **New File Creation** | Any | **DO NOT USE** | No existing structure or revision exists. Use standard file creation tools. |
| **Editing Non-Markdown** | `.txt`, `.ts`, `.json`, etc. | **DO NOT USE** | SafeEdit relies on Markdown structural boundaries. Use standard edit/write tools. |
| **Reading Existing Markdown** | `.md`, `.markdown` | **USE SAFEEDIT** | Avoids reading unnecessary bulk bytes and prepares mutation-capable tokens. |
| **Editing Existing Markdown** | `.md`, `.markdown` | **MANDATORY USE** | Prevents silent overwrites, solves relocations, and tracks revisions. |

## Supported Markdown Structures

The system supports the following structures for navigation and parsing:
- **ATX & Setext Headings**: `# Header` or underlines.
- **Logical Sections**: A heading and all its children/body blocks up to the next heading of equal or higher level.
- **Paragraphs**: Text blocks.
- **List Items**: Items inside bulleted or numbered lists.
- **Fenced Code Blocks**: ```lang ... ``` blocks.
- **GFM Tables & Rows**: Table headers and individual data rows.
- **YAML Frontmatter**: Raw top-level metadata block.

## Supported Mutation Targets

You can target and mutate only the following node types:
1. `section` (replaces heading + body + children, or inserts sections)
2. `list_item` (replaces, deletes, or inserts items in lists)
3. `table_row` (replaces, deletes, or inserts rows in tables)
4. `paragraph` (replaces or deletes text blocks)

## Deferred Capabilities

The following operations are **not supported** in the current protocol phase. Attempting them will result in validation or syntax errors:
- **Arbitrary Inline-Span Editing**: You cannot replace words *inside* a paragraph node without replacing the entire paragraph node.
- **MDX / JSX Component Mutation**: Direct modification of JSX elements embedded inside MDX.
- **Multi-File Transactions**: All operations in a single transaction must target ranges within the *same* document snapshot.
- **Automatic Semantic Merging**: MD SafeEdit does not automatically merge changes if the target text has changed; it rejects with a conflict.
