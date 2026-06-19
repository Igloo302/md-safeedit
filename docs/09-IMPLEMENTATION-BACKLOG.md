# MD SafeEdit Implementation Backlog

## 1. How to use this backlog

Each item is intended to become one issue or a small group of tightly related issues. Coding agents must not start an item until its dependencies are complete.

Priority:

- P0: required for the next phase gate;
- P1: required before public alpha;
- P2: post-alpha.

## Epic 0: Repository foundation

### E0.1 Workspace scaffold

**Priority:** P0  
**Dependencies:** none

Deliver:

- pnpm workspace;
- TypeScript strict configuration;
- package skeletons;
- Vitest;
- lint and formatting;
- Linux, macOS, Windows CI;
- conventional build and test scripts.

Acceptance:

- clean checkout installs and tests with documented commands;
- each package can build independently;
- no production implementation is added to adapters.

### E0.2 Fixture harness

**Priority:** P0  
**Dependencies:** E0.1

Deliver:

- fixture loader;
- expected-output convention;
- golden-update command;
- fixture metadata schema.

Acceptance:

- one fixture can assert byte ranges, outline, patch output, and unchanged bytes.

## Epic 1: Parser feasibility

### E1.1 Parser comparison spike

**Priority:** P0  
**Dependencies:** E0.2

Compare:

- micromark/mdast;
- tree-sitter Markdown or another credible alternative.

Acceptance:

- written ADR;
- exact byte-range results for representative fixtures;
- documented malformed-Markdown behavior;
- selected parser justified.

### E1.2 Source range extractor

**Priority:** P0  
**Dependencies:** E1.1

Deliver exact byte ranges for:

- headings;
- paragraphs;
- list items;
- fenced code;
- tables and rows;
- frontmatter.

Acceptance:

- at least 100 fixtures;
- LF/CRLF/Unicode coverage;
- expected source slices match bytes exactly.

### E1.3 Logical section builder

**Priority:** P0  
**Dependencies:** E1.2

Deliver:

- heading hierarchy;
- direct body range;
- full-section range;
- duplicate-heading occurrence metadata.

Acceptance:

- nested and repeated-heading fixtures pass;
- section end boundaries are deterministic.

## Epic 2: Guarded patch core

### E2.1 Snapshot and revision

**Priority:** P0  
**Dependencies:** E0.1

Deliver:

- canonical authorized file load;
- document snapshot;
- SHA-256 revision;
- encoding and line-ending detection.

Acceptance:

- byte changes always change revision;
- unauthorized and symlink-escaped paths reject.

### E2.2 Byte edit planner

**Priority:** P0  
**Dependencies:** E2.1

Deliver:

- replace;
- delete;
- insert;
- sorting;
- overlap detection;
- deterministic same-offset insertion behavior.

Acceptance:

- property tests pass;
- intersecting and nested ranges reject;
- untouched-byte assertions pass.

### E2.3 Transaction result and diff

**Priority:** P0  
**Dependencies:** E2.2

Deliver:

- planned result bytes;
- operation statuses;
- unified diff;
- dry-run result.

Acceptance:

- dry run never changes disk;
- output revision is deterministic.

### E2.4 Atomic writer

**Priority:** P0  
**Dependencies:** E2.3

Deliver:

- same-directory temporary write;
- flush/fsync strategy;
- permission preservation;
- final revision check;
- atomic replace;
- cleanup.

Acceptance:

- fault injection leaves original unchanged;
- concurrent change returns `COMMIT_RACE`;
- cross-platform integration tests pass or limitations are documented.

## Epic 3: Protocol and anchors

### E3.1 Public schemas

**Priority:** P0  
**Dependencies:** E0.1

Deliver schemas for:

- inspect;
- search;
- read;
- patch;
- common errors.

Acceptance:

- examples in protocol document validate;
- unknown required semantics are rejected clearly.

### E3.2 Anchor payload

**Priority:** P0  
**Dependencies:** E1.3, E2.1

Deliver:

- internal payload V1;
- token encoding;
- HMAC signing;
- verification;
- expiry policy;
- protocol/parser version binding.

Acceptance:

- any token modification fails;
- token cannot be replayed against another file;
- expired and incompatible tokens return stable errors.

### E3.3 Same-revision verification

**Priority:** P0  
**Dependencies:** E2.2, E3.2

Deliver:

- revision comparison;
- byte range verification;
- raw target hash;
- node-type validation.

Acceptance:

- changed target always rejects;
- bare node ID mutation is impossible at schema and service layers.

## Epic 4: Markdown navigation

### E4.1 Inspect service

**Priority:** P0  
**Dependencies:** E1.3, E2.1, E3.1

Deliver:

- outline;
- document metadata;
- warnings;
- runtime navigation IDs.

### E4.2 Search service

**Priority:** P0  
**Dependencies:** E1.2, E4.1

Deliver:

- text search;
- node-type filters;
- section scoping;
- previews;
- result limits.

### E4.3 Read service

**Priority:** P0  
**Dependencies:** E3.2, E4.2

Deliver:

- exact content;
- neighbors;
- children option;
- mutation-capable anchor tokens.

Acceptance:

- returned token is sufficient for patch;
- response does not require model to reconstruct anchor fields.

## Epic 5: Patch service

### E5.1 Same-snapshot patch

**Priority:** P0  
**Dependencies:** E2.4, E3.3, E4.3

Deliver:

- patch orchestration;
- dry run;
- commit;
- validation levels;
- atomic batch.

Acceptance:

- all Phase 1 task families pass;
- one stale operation rejects an atomic batch;
- malformed replacement cannot bypass validation.

### E5.2 CLI JSON adapter

**Priority:** P0  
**Dependencies:** E5.1

Deliver:

- commands or JSON-RPC-like stdin/stdout;
- stable exit codes;
- no duplicate business logic.

## Epic 6: Exact relocation

### E6.1 Structural fingerprints

**Priority:** P1  
**Dependencies:** E1.3

Deliver:

- path fingerprint;
- parent fingerprint;
- sibling occurrence;
- previous/next fingerprints.

Acceptance:

- repeated-heading fixtures produce distinguishable evidence when structure permits;
- truly indistinguishable nodes remain ambiguous.

### E6.2 Raw-identical candidate search

**Priority:** P1  
**Dependencies:** E3.2, E6.1

Deliver:

- same-node-type candidate indexing;
- raw-hash candidate set;
- structural ranking.

### E6.3 Relocation decision engine

**Priority:** P1  
**Dependencies:** E6.2

Deliver:

- exact relocation;
- confidence threshold;
- ambiguity rejection;
- diagnostics for changed candidates.

Acceptance:

- no raw-hash mismatch authorizes a write;
- benchmark exact-relocation target is met;
- all ambiguity fixtures reject.

## Epic 7: Agent integrations

### E7.1 MCP server

**Priority:** P1  
**Dependencies:** E5.1

Expose exactly:

- inspect;
- search;
- read;
- patch.

Acceptance:

- tool schemas match protocol;
- roots restrict filesystem access;
- server contains no duplicated editing logic.

### E7.2 Human-friendly CLI

**Priority:** P1  
**Dependencies:** E5.2, E6.3

Deliver:

- outline display;
- search;
- read;
- preview;
- apply.

### E7.3 Model tool-use evaluation

**Priority:** P1  
**Dependencies:** E7.1, benchmark core

Deliver:

- prompt/tool descriptions;
- scripted tasks;
- three model-family report;
- error-recovery evaluation.

## Epic 8: Benchmark

### E8.1 Baseline runners

**Priority:** P1  
**Dependencies:** E0.2

Implement comparable runners for:

- full rewrite;
- exact replace;
- unified diff;
- line-hash patch;
- MD SafeEdit.

### E8.2 First 100 tasks

**Priority:** P1  
**Dependencies:** E8.1

Focus:

- local edits;
- repetition;
- changed targets;
- moved targets;
- ambiguity.

### E8.3 Public 200+ task suite

**Priority:** P1  
**Dependencies:** E6.3, E8.2

Add:

- encoding;
- malformed syntax;
- transactions;
- platform races;
- model-in-the-loop tasks.

### E8.4 Report generator

**Priority:** P1  
**Dependencies:** E8.3

Report:

- false accepts;
- valid completion;
- wrong target;
- relocation;
- ambiguity;
- tokens;
- latency;
- tool calls;
- byte preservation.

## Epic 9: Public release

### E9.1 Packaging

**Priority:** P1  
**Dependencies:** Phase 2 gates

- npm packages;
- `mdsafe` binary;
- `md-safeedit-mcp`;
- versioned schemas.

### E9.2 Documentation verification

**Priority:** P1  
**Dependencies:** E9.1

- clean install test;
- README commands tested;
- examples tested;
- limitations synchronized.

### E9.3 Security review

**Priority:** P1  
**Dependencies:** E9.1

- path and symlink review;
- token review;
- race review;
- malicious fixture tests;
- dependency audit.

## 2. Critical dependency path

```text
E0.1
  → E0.2
  → E1.1
  → E1.2
  → E1.3
  → E3.2
  → E4.3
  → E3.3
  → E5.1
  → E6.1
  → E6.2
  → E6.3
  → E7.1 / E8.3
  → Public Alpha
```

The atomic writer track can proceed in parallel after E2.1.

## 3. First five issues to create

1. Scaffold monorepo, strict TypeScript, tests, and CI.
2. Build fixture harness with byte-range golden assertions.
3. Compare Markdown parsers and write ADR-001.
4. Implement generic document snapshots and SHA-256 revisions.
5. Implement byte edit planner with overlap property tests.

Do not begin MCP implementation among the first issues.

