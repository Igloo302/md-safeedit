# Instructions for Coding Agents

This file defines mandatory implementation rules for any AI coding agent working on MD SafeEdit.

## 1. Project objective

Build a reference implementation of a Markdown-aware guarded patch protocol for AI agents.

The system must prevent silent overwrites and must distinguish:

- a target that is unchanged but moved;
- a target changed only in formatting;
- a target changed semantically;
- a target that is missing;
- multiple indistinguishable candidates.

The project is successful only if this behavior is verified by automated tests and compared with simpler editing approaches.

## 2. Safety invariants

These rules are non-negotiable:

1. A write operation must not accept a bare `node_id`.
2. Every mutation must carry an opaque anchor token produced by a prior read or search operation.
3. A changed target must never be overwritten automatically.
4. Fuzzy similarity must never authorize a write.
5. Normalized hashes may help diagnose or rank candidates, but only raw-byte identity may authorize automatic relocation in V1.
6. Ambiguous relocation must return a conflict.
7. Any intersecting mutation ranges in one transaction must reject the entire transaction.
8. All transaction ranges must originate from one document snapshot.
9. Validation and disk-state checks must happen again immediately before commit.
10. A failed transaction must leave the original file unchanged.
11. Untouched byte ranges must remain byte-for-byte identical.
12. The implementation must not silently normalize line endings, indentation, table alignment, or trailing spaces.

Do not weaken these rules to make a test pass. If a rule is impractical, document the issue in an ADR and stop for review.

## 3. Scope discipline

### Phase 1 supported structures

- document;
- ATX and Setext headings;
- logical sections;
- paragraphs for reading and anchoring;
- list items;
- fenced code blocks;
- GFM tables and table rows;
- YAML frontmatter as a raw top-level block.

### Phase 1 mutation targets

- section;
- list item;
- table row;
- paragraph.

### Explicitly deferred

- arbitrary inline-span editing;
- MDX JSX mutation;
- semantic merging of changed content;
- persistent IDs written into source files;
- multi-file transactions;
- collaborative real-time editing;
- automatic fuzzy rebasing;
- GUI applications.

Do not add deferred capabilities unless the current milestone is complete and the roadmap is updated.

## 4. Preferred implementation approach

The recommended initial stack is TypeScript on current Node.js LTS.

Suggested libraries:

- `micromark` / `mdast-util-from-markdown`;
- GFM and frontmatter extensions;
- `zod` or JSON Schema for protocol validation;
- `vitest` for tests;
- `fast-check` for property-based tests.

The parser choice is provisional. Before building the full protocol, create a parser spike proving accurate source ranges for the supported fixtures.

## 5. Required package boundaries

Keep these concerns separate:

### `core`

Owns:

- snapshot revisions;
- byte ranges;
- raw hashing;
- overlap detection;
- compare-and-swap checks;
- transaction planning;
- atomic file replacement;
- diff generation;
- generic conflict types.

It must not depend on Markdown parsing.

### `markdown`

Owns:

- Markdown parsing;
- logical section construction;
- node types;
- structural fingerprints;
- outline and search;
- exact relocation;
- dialect validation.

It may depend on `core`, but `core` must not depend on it.

### `protocol`

Owns:

- public request and response schemas;
- opaque anchor envelope;
- protocol versioning;
- stable error codes.

### `cli` and `mcp`

Thin adapters only. They must not duplicate core business logic.

## 6. Development workflow

For each task:

1. Read the PRD, architecture, protocol, and relevant ADRs.
2. Restate the acceptance criteria in the task or pull request.
3. Add or update tests before finalizing implementation.
4. Run unit, integration, fixture, and type checks.
5. Show the resulting diff.
6. Record any behavior change in the changelog or ADR.

Do not refactor unrelated code. Do not introduce a database, daemon, or background index in Phase 1.

## 7. Definition of done

A task is complete only when:

- acceptance criteria are met;
- public schemas are documented;
- error paths are tested;
- malformed input cannot bypass anchor validation;
- Windows, macOS, and Linux path behavior is considered;
- LF and CRLF fixtures pass;
- Unicode and emoji fixtures pass;
- no unrelated bytes change in golden tests;
- benchmark compatibility is preserved.

## 8. Error handling

Use stable machine-readable codes:

- `DOCUMENT_CHANGED`
- `TARGET_CHANGED`
- `TARGET_MISSING`
- `ANCHOR_AMBIGUOUS`
- `ANCHOR_INVALID`
- `ANCHOR_EXPIRED`
- `OVERLAPPING_OPERATIONS`
- `UNSUPPORTED_SYNTAX`
- `INVALID_REPLACEMENT`
- `VALIDATION_FAILED`
- `COMMIT_RACE`
- `IO_ERROR`

Errors should include remediation guidance but must not expose secret signing keys or unsafe filesystem details.

## 9. Security requirements

- Restrict file access to configured roots.
- Resolve symlinks before authorization checks.
- Reject path traversal.
- Sign or authenticate opaque anchor tokens.
- Bind tokens to canonical file identity, revision, node evidence, and protocol version.
- Do not deserialize executable payloads.
- Treat Markdown and replacement content as untrusted data.
- Never execute code blocks, HTML, links, or embedded commands.

## 10. Benchmark-first rule

Every new relocation heuristic must add:

- at least one positive fixture;
- at least one ambiguity fixture;
- at least one changed-target fixture;
- a measurement of false-accept behavior.

An increase in successful automatic edits is not an improvement if false acceptance also increases.

