# Decisions and Open Questions

## 1. Confirmed decisions

### D1: Project name

**MD SafeEdit**

Reason:

- understandable to non-technical users;
- clearly associated with Markdown;
- communicates safe editing rather than parser technology.

### D2: Open-source first

The project optimizes for adoption, learning, and upstream influence rather than monetization.

### D3: Primary value

The primary value is guarded writing plus structural relocation. Token savings are secondary.

### D4: Safety rule

Changed or ambiguous targets are conflicts. The system does not guess.

### D5: No source pollution by default

The system does not insert permanent IDs into ordinary Markdown.

### D6: Four public agent tools

- inspect;
- search;
- read;
- patch.

### D7: Two-layer architecture

- generic guarded patch core;
- Markdown structural adapter.

### D8: Exact-only automatic relocation in V1

Automatic relocation requires raw-byte identity and unique structural compatibility.

### D9: Benchmark is a first-class deliverable

Benchmark development starts with implementation, not after it.

## 2. Decisions required before Phase 1

### Q1: Parser

Candidates:

- mdast/micromark;
- tree-sitter Markdown;
- another source-position-preserving parser.

Decision criterion:

- source-range correctness;
- GFM support;
- TypeScript integration;
- behavior on malformed documents;
- maintenance health.

### Q2: Anchor lifetime

Options:

- process/session scoped;
- installation scoped;
- stateless unsigned evidence plus server-side snapshot cache.

Recommended Phase 1:

- signed session-scoped anchors;
- explicit expiry errors;
- revisit after model-in-the-loop testing.

### Q3: Section replacement semantics

Need to define:

- whether heading text is included;
- whether nested subsections are included;
- body-only vs full-section modes.

Recommended:

- anchors identify exact ranges;
- read response labels `heading`, `body`, and `full_section`;
- patch defaults to the exact range read.

### Q4: Paragraphs in MVP

Paragraphs increase generality but may provide less advantage over exact string replacement.

Recommended:

- parse and read paragraphs in Phase 1;
- support replacement for completeness;
- evaluate whether they remain prominent in the public API.

### Q5: Multiple inserts at one offset

Options:

- preserve request order;
- reject as ambiguous;
- require explicit sequence.

Recommended:

- preserve request order within one transaction and test it.

### Q6: File identity

Path alone may be insufficient across renames and symlinks.

Investigate:

- canonical path;
- platform file ID/inode;
- root-relative display path;
- behavior after rename.

Phase 1 may reject anchors after rename.

## 3. Decisions required before public alpha

### Q7: Normalized fingerprints

Define node-type-specific normalization only for diagnostics and candidate ranking.

Do not use a universal whitespace normalizer.

### Q8: Validation defaults

Recommended:

- `normal` default;
- conflict safety never configurable;
- validation level affects only Markdown structure checks.

### Q9: MCP tool descriptions

Tool prompts need testing across model families. Small wording differences may change whether agents read before patching.

### Q10: Benchmark licensing and contribution format

The benchmark should make external task contributions easy while preventing fixtures containing confidential documents.

## 4. Deferred questions

- Should anchors persist across server restarts?
- Should existing Obsidian block IDs be preferred?
- Should V2 support format-equivalent relocation with confirmation?
- Should the protocol expand beyond Markdown?
- Should there be a generic SafeEdit protocol with MD SafeEdit as one adapter?
- Is an editor extension useful, or should native agent adoption remain the goal?
- Should Git blob IDs be used when inside repositories?

## 5. Architecture decision record template

```markdown
# ADR-NNN: Title

## Status

Proposed / Accepted / Superseded

## Context

What problem requires a decision?

## Options

What alternatives were considered?

## Decision

What was selected?

## Consequences

What becomes easier, harder, or deferred?

## Validation

How will tests or benchmarks verify the decision?
```

