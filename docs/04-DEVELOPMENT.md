# MD SafeEdit Development Guide

## 1. Intended audience

This document is for coding agents and human maintainers implementing the project.

## 2. Recommended stack

- TypeScript;
- current Node.js LTS;
- pnpm workspace;
- ESM modules;
- strict TypeScript;
- Vitest;
- JSON Schema or Zod;
- micromark/mdast ecosystem for the first parser spike.

The parser is not locked until source-range verification passes.

## 3. Repository plan

```text
packages/
├── protocol/
│   ├── src/schemas/
│   ├── src/errors/
│   └── src/version.ts
├── core/
│   ├── src/snapshot/
│   ├── src/hash/
│   ├── src/anchor/
│   ├── src/transaction/
│   ├── src/writer/
│   └── src/diff/
├── markdown/
│   ├── src/parser/
│   ├── src/nodes/
│   ├── src/sections/
│   ├── src/search/
│   ├── src/fingerprint/
│   └── src/relocation/
├── cli/
└── mcp/
```

## 4. Implementation sequence

### Step 1: Source-range parser spike

Before protocol or MCP work:

1. parse fixture documents;
2. enumerate nodes and source ranges;
3. slice original bytes using those ranges;
4. verify slices equal expected source text;
5. cover LF, CRLF, Unicode, nested lists, tables, code blocks, and duplicate headings.

Exit condition:

- supported fixture ranges are exact;
- known unsupported syntax is documented;
- parser choice is confirmed or rejected.

### Step 2: Generic snapshots and byte edits

Implement:

- file loading;
- canonical path handling;
- revision hashing;
- byte range type;
- non-overlapping edit application;
- untouched-byte golden assertions.

No Markdown logic in this step.

### Step 3: Node model and outline

Implement:

- block nodes;
- logical sections;
- structural paths;
- duplicate-heading occurrence metadata;
- inspect response.

### Step 4: Search and read

Implement:

- node filtering;
- scoped search;
- previews;
- neighbor retrieval;
- anchor payload construction;
- opaque token signing and verification.

### Step 5: Same-revision guarded patch

Implement:

- replace/delete/insert;
- raw hash verification;
- operation validation;
- dry run;
- diff output.

### Step 6: Atomic commit

Implement:

- temporary-file output;
- final revision check;
- atomic replacement;
- commit-race errors;
- permission handling.

### Step 7: Exact relocation

Implement only after same-revision safety is complete:

- raw-hash candidate search;
- structural scoring;
- ambiguity rejection;
- moved-target fixtures.

### Step 8: MCP and CLI adapters

Adapters should call public library functions and remain thin.

## 5. Parser acceptance tests

Required fixture categories:

- ATX headings;
- Setext headings;
- repeated heading names;
- heading jumps;
- paragraphs with trailing spaces;
- nested ordered and unordered lists;
- task lists;
- multiline list items;
- blockquotes;
- fenced code with Markdown-like content;
- GFM tables;
- escaped pipes;
- YAML frontmatter;
- HTML blocks;
- mixed Unicode and emoji;
- LF, CRLF, mixed endings;
- empty document;
- document without headings.

## 6. Anchor design notes

Do not expose raw payload fields as individually editable agent parameters. The public token should be opaque.

Internal payload example:

```ts
interface AnchorPayloadV1 {
  version: 1;
  fileKey: string;
  sourceRevision: string;
  range: {
    start: number;
    end: number;
  };
  rawHash: string;
  nodeType: string;
  structuralEvidence: {
    pathFingerprint: string;
    parentFingerprint?: string;
    previousFingerprint?: string;
    nextFingerprint?: string;
    siblingOccurrence?: number;
  };
  dialect: string;
  parserEvidenceVersion: string;
  issuedAt: number;
  expiresAt?: number;
}
```

## 7. Relocation scoring

Automatic relocation requires:

- exact raw hash;
- same node type;
- exactly one accepted candidate after structural filtering.

A proposed score may help rank exact candidates:

```text
same parent path fingerprint       +40
same full heading path             +25
same previous sibling fingerprint  +15
same next sibling fingerprint      +15
same sibling occurrence             +5
near original range                 +0..5
```

The numeric values are provisional and must be calibrated with benchmark fixtures.

Important:

- score does not compensate for raw-hash mismatch;
- a low-confidence unique candidate may still be rejected;
- two similarly scored candidates must return ambiguity.

## 8. Byte editing rules

- Offsets are byte offsets in the original snapshot.
- All operation ranges resolve before any edit is applied.
- Any non-empty range intersection is forbidden.
- An insert at the boundary of a replace needs an explicit deterministic rule.
- Multiple inserts at one offset must preserve request order or be rejected; choose and document one.
- Apply resolved edits from highest offset to lowest.
- Preserve BOM and original line endings unless replacement content explicitly contains new endings.

## 9. Atomicity notes

Portable atomic compare-and-swap on arbitrary local filesystems is imperfect.

Implementation should:

- minimize the interval between final check and rename;
- detect common races;
- document platform limitations honestly;
- add fault-injection tests;
- never claim distributed transaction guarantees.

If stronger correctness requires a platform-specific primitive, isolate it behind a writer interface.

## 10. Coding quality

- No `any` in public APIs.
- Public behavior requires tests.
- Errors are typed and stable.
- Avoid global mutable document state.
- Prefer stateless operations on explicit snapshots.
- Avoid background caching in V1.
- Keep parser output internal.
- Document all behavior that differs by platform.

## 11. Pull request template

Each implementation PR should state:

```text
Problem:
Scope:
Acceptance criteria:
Safety invariants affected:
Tests added:
Benchmark cases added:
Known limitations:
```

## 12. Release gates

No public alpha until:

- protocol schemas are versioned;
- anchor forgery tests pass;
- changed-target false acceptance is zero in the current benchmark;
- byte-preservation golden suite passes;
- Linux, macOS, and Windows CI passes;
- README limitations match implementation.

