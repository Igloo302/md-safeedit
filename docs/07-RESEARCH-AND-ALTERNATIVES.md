# Research and Alternatives

## 1. Why this document exists

MD SafeEdit should not present itself as the first tool that safely edits Markdown. Several projects solve overlapping parts of the problem. This document defines the project's actual boundary.

## 2. Existing editing approaches

## 2.1 Full-file rewrite

Best for:

- creating files;
- small documents;
- comprehensive rewrites.

Weakness:

- stale writes may replace unrelated changes;
- large output;
- formatting drift;
- poor fit for local edits.

## 2.2 Exact string replacement

Best for:

- short unique targets;
- simple local changes.

Strength:

- the old string is an implicit precondition;
- easy to understand and review.

Weakness:

- repeated strings require larger context;
- target identity is not explicit;
- moved or reformatted targets can fail;
- conflict semantics are limited.

## 2.3 Unified diff

Best for:

- multiple text edits;
- Git-oriented review.

Weakness:

- model formatting errors;
- contextual application behavior varies;
- semantic target is indirect.

## 2.4 Line-hash patching

Best for:

- generic files;
- partial reads;
- guarded edits without parsing.

This is the most important alternative. MD SafeEdit must prove that Markdown structure improves target selection or relocation enough to justify extra complexity.

## 3. Related projects

## 3.1 SafeMarkdownEditor MCP

Overlap:

- MCP interface;
- section-level operations;
- transaction history;
- validation;
- in-process thread safety.

Different emphasis:

- operates primarily on a loaded in-memory document;
- public API focuses on complete sections;
- does not publicly expose revision/hash preconditions for external disk changes;
- does not provide fine-grained structural relocation semantics.

MD SafeEdit should treat it as a useful predecessor, not dismiss it.

## 3.2 MCP Text Editor

Overlap:

- partial file reads;
- hash-based validation;
- conflict handling;
- atomic operations;
- token efficiency.

Difference:

- line-oriented rather than Markdown-aware.

This is a direct benchmark baseline.

## 3.3 markdown-patch

Overlap:

- structure-aware targeted Markdown edits;
- headings;
- block references;
- frontmatter;
- CLI/library use.

Difference:

- target is structural editing convenience rather than a full version-aware agent conflict protocol.

Its existence is evidence that structure-aware Markdown patching is useful, while also showing that structure alone is not MD SafeEdit's unique contribution.

## 3.4 Obsidian block IDs

Strength:

- explicit stable references inside a vault.

Tradeoff:

- IDs are written into source content;
- behavior is ecosystem-specific;
- does not define guarded writes or external concurrency.

MD SafeEdit should reuse existing IDs when present in a future adapter, but not require them.

## 3.5 Markform and structured document formats

These formats design documents for programmatic mutation from the beginning.

They are preferable when:

- schema is known;
- fields are explicit;
- validation is central.

MD SafeEdit serves existing ordinary Markdown that was not authored as a form or database.

## 3.6 LSP-style document versions

Language servers demonstrate a useful model:

- versioned document snapshots;
- range edits;
- editor-maintained state.

MD SafeEdit borrows the version-precondition idea but applies it to agent-accessed local Markdown without requiring a live editor host.

## 4. Why MD SafeEdit may still be needed

The unresolved combination is:

1. ordinary local Markdown;
2. explicit stale-write protection;
3. semantic navigation;
4. exact relocation of unchanged targets;
5. machine-readable conflict states;
6. an agent-friendly small tool interface;
7. public comparative evaluation.

The project does not need to be permanently independent. Adoption of these ideas by mainstream agents is a successful outcome.

## 5. When users should not use MD SafeEdit

- creating a new file;
- rewriting the whole document intentionally;
- editing a tiny unique string;
- working inside a platform with stable native block IDs and transactions;
- editing a structured format better represented as JSON, YAML, or a form schema;
- using an editor that already provides equivalent versioned document operations.

## 6. Research questions

1. Does structural scope improve target accuracy over longer exact strings?
2. Is raw-identical relocation common enough to matter?
3. How often do users encounter changed-target conflicts?
4. Do agents understand four tools more reliably than many specialized tools?
5. Does an opaque anchor token improve or hurt model behavior?
6. Is paragraph-level structure useful, or are section/list/table nodes sufficient?
7. Does parser cost matter at realistic document sizes?
8. Can cross-platform commit races be handled well enough for honest “safe edit” positioning?

## 7. Desired ecosystem outcome

The project should produce:

- a protocol others can implement;
- a reference engine;
- an MCP integration;
- a public benchmark;
- documented failure cases.

If agent platforms later add versioned, Markdown-aware guarded edits natively, MD SafeEdit has achieved its purpose.

