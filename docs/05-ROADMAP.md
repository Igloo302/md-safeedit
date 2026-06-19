# MD SafeEdit Roadmap

## 1. Planning assumptions

The development work will primarily be performed by coding agents under human review.

The schedule assumes:

- one technical owner who reviews architecture and merges;
- one primary coding agent at a time per package, or isolated branches/worktrees;
- automated CI from the first week;
- no GUI in the initial program;
- TypeScript implementation;
- six to eight effective development weeks for a credible public alpha.

Agent speed does not remove review, test, and integration time. The schedule is organized around evidence gates rather than raw code volume.

## 2. Phase 0: Repository and feasibility

**Duration:** 3–5 working days  
**Goal:** Prove that exact source ranges and byte-preserving edits are feasible.

### Deliverables

- repository scaffold;
- CI;
- parser comparison spike;
- initial fixture corpus;
- exact node-range extraction;
- simple byte-range replacement;
- architecture decision record for parser choice.

### Supported syntax

- headings;
- paragraphs;
- lists;
- fenced code;
- GFM tables;
- YAML frontmatter detection.

### Exit criteria

- at least 100 parser fixtures pass;
- source slices match original bytes;
- no full-document reserialization is used;
- parser limitations are documented.

### Stop condition

If exact source boundaries cannot be produced reliably for the target dialect, pause protocol development and change parser strategy.

## 3. Phase 1: Guarded patch MVP

**Duration:** 2–3 weeks  
**Goal:** Deliver safe same-snapshot structural editing.

### Scope

- `inspect`;
- `search`;
- `read`;
- `patch`;
- document revision;
- opaque signed anchors;
- raw target hash;
- replace/delete/insert;
- atomic non-overlapping batch;
- dry-run diff;
- same-revision conflict checks;
- atomic file writer;
- CLI JSON mode.

### Mutation targets

- section;
- paragraph;
- list item;
- table row.

### Not included

- relocation after document changes;
- MCP;
- normalized fingerprints;
- Obsidian-specific syntax;
- multi-file patching.

### Exit criteria

- changed targets are rejected in all Phase 1 fixtures;
- bare node IDs cannot authorize writes;
- 100% untouched-byte preservation;
- fault-injected failed commits preserve source files;
- API schemas are documented.

### Phase 1 release

Internal developer preview, `0.1.0-dev`.

## 4. Phase 2: Exact relocation and MCP alpha

**Duration:** 2–3 weeks  
**Goal:** Prove the main Markdown-aware advantage.

### Scope

- exact relocation of raw-identical moved nodes;
- structural fingerprints;
- duplicate-heading handling;
- neighbor evidence;
- ambiguity detection;
- MCP server with four tools;
- human-readable CLI commands;
- first public benchmark runner;
- model tool-use tests.

### Exit criteria

- at least 95% success on supported unchanged-moved cases;
- 100% rejection of benchmark ambiguity cases;
- zero automatic writes when target bytes changed;
- three model families complete core tool workflows;
- benchmark results are reproducible.

### Phase 2 release

Public alpha, `0.2.0-alpha`.

## 5. Phase 3: Benchmark and ecosystem hardening

**Duration:** 2–4 weeks  
**Goal:** Determine when MD SafeEdit is actually better than alternatives.

### Scope

- 200+ benchmark tasks;
- baselines:
  - full-file rewrite;
  - exact string replace;
  - unified diff;
  - line-hash patch;
- token, latency, correctness, and safety reports;
- Windows/macOS/Linux hardening;
- large-file performance;
- parser differential tests;
- installation documentation;
- npm packages;
- example integrations.

### Exit criteria

- public benchmark report;
- documented winning and losing scenarios;
- no safety-critical open issue;
- installation succeeds from a clean machine;
- protocol changes based on alpha feedback are complete.

### Phase 3 release

Public beta, `0.5.0-beta`.

## 6. Phase 4: Extended Markdown support

**Duration:** milestone-based  
**Goal:** Expand only where real users need it.

Potential scope:

- Obsidian block IDs and callouts;
- Markdown links and frontmatter field mutation;
- MDX read support;
- format-equivalent relocation preview;
- persistent installation-scoped anchors;
- editor integrations;
- Git hooks or GitHub Actions;
- additional language SDKs.

Each feature requires benchmark fixtures and an ADR.

## 7. Suggested two-track execution

### Track A: Safety engine

- snapshots;
- anchors;
- transactions;
- atomic writer;
- conflicts.

### Track B: Markdown intelligence

- parser;
- sections;
- search;
- structural evidence;
- relocation.

Integration happens through explicit interfaces. Agents should not edit both tracks in one broad task unless necessary.

## 8. Weekly project cadence

### Beginning of week

- confirm milestone acceptance criteria;
- split work into testable issues;
- assign package ownership;
- identify architecture decisions.

### Daily

- coding agent posts test and diff summary;
- technical owner reviews safety invariant changes;
- benchmark suite runs in CI.

### End of week

- demo real document workflows;
- review failures, not only successes;
- update ADRs and roadmap;
- decide continue/change/stop.

## 9. Go/no-go gates

### Gate A: Parser feasibility

Go only if source ranges are reliable.

### Gate B: Guarded-write value

Go only if stale and changed targets are consistently rejected without corrupting files.

### Gate C: Structural-relocation value

Go only if structure improves relocation or target accuracy over line/text baselines.

### Gate D: Agent usability

Go only if models reliably use the four-tool protocol without frequent tool-selection errors.

If a gate fails, simplify the product rather than adding more heuristics.

