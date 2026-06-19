# ADR-001: Markdown Parser Selection for MD SafeEdit

## Status

Accepted

## Context

MD SafeEdit needs a Markdown parser that:
1. Provides exact source byte ranges (`offset` and `length`) for parsed AST nodes, covering paragraphs, lists, sections, headings, fenced code blocks, tables, and frontmatter.
2. Supports CommonMark, GitHub Flavored Markdown (GFM) tables, and YAML frontmatter.
3. Integrates well with TypeScript and works reliably across platforms (Linux, macOS, Windows) without requiring native compilation (no C/C++ node-gyp compilation issues).
4. Handles malformed Markdown input deterministically and gracefully without throwing unexpected errors.

## Options

### Option 1: unified / remark-parse / mdast-util-from-markdown (micromark-based)
- **Pros:** 
  - Written in pure JavaScript/TypeScript. Extremely stable and cross-platform.
  - Generates a rich Abstract Syntax Tree (AST) matching the `mdast` spec.
  - The AST nodes contain precise position objects: `{ start: { line, column, offset }, end: { line, column, offset } }`.
  - Excellent extensions for GFM (`mdast-util-gfm`) and frontmatter (`mdast-util-frontmatter`).
  - Actively maintained with a massive ecosystem.
- **Cons:**
  - Standard offsets are JS string character offsets (UTF-16 code units), which need mapping to UTF-8 byte offsets for files with non-ASCII characters.

### Option 2: tree-sitter / tree-sitter-markdown
- **Pros:**
  - Highly performant.
  - Precise byte-offset mapping out-of-the-box.
- **Cons:**
  - Requires native C/C++ compilation. Often runs into installation issues on Windows or different Node/macOS architectures without prebuilt binaries. This violates our strict cross-platform requirement.
  - The AST is a generic tree of syntax nodes rather than a semantic markdown tree, making AST traversal and logical section building more verbose.

## Decision

We select **Option 1: mdast-util-from-markdown (micromark-based)**.

We will write a lightweight `OffsetMapper` inside the core safety engine to translate between standard UTF-16 JS string offsets returned by the parser and raw UTF-8 byte offsets for file modification.

## Consequences

- **Easier:** Monorepo setup is straightforward; package installation is fast and reliable across Windows, macOS, and Linux. No native compilation is needed.
- **Harder:** We must maintain a character-to-byte offset mapping class, but this is simple to implement and test.
- **Deferred:** Obsidian-specific parsing or dialect expansions can be added in V2/Phase 4 using mdast plugins/micromark extensions.

## Validation

Automated tests will parse various markdown fixtures (including UTF-8 BOM, Emoji, CRLF/LF line endings, and nested blocks) and verify that slicing the raw bytes using mapped parser offsets returns the exact source text of the nodes.
