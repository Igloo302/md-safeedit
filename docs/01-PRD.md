# MD SafeEdit Product Requirements Document

**Version:** 1.0  
**Status:** Ready for implementation planning  
**Product type:** Open-source agent infrastructure  
**Primary users:** People who use AI agents to maintain Markdown documents; developers integrating document tools into agents

## 1. One-sentence description

MD SafeEdit lets AI agents modify the intended part of a Markdown document without silently overwriting changes made by people or other agents.

## 2. Background

AI agents are shifting from generating one-off documents to maintaining documents that evolve over time:

- product requirements;
- technical designs;
- README files;
- research notes;
- changelogs;
- project memory;
- knowledge bases;
- documentation websites.

Most current agents edit these files using full-file rewrite, exact string replacement, line ranges, or diff patches. These methods remain useful, but they do not expose a consistent model of:

- which document snapshot was read;
- which semantic node was selected;
- whether that node changed before the write;
- whether an unchanged node moved;
- whether a candidate relocation is unique;
- why an edit was rejected.

Markdown is especially suitable for a better abstraction because it is plain text with recognizable structure: headings, sections, paragraphs, lists, code blocks, tables, and metadata.

## 3. Problem statement

Users need agents to maintain Markdown files repeatedly and safely. The existing workflow has three recurring weaknesses.

### 3.1 Unsafe stale writes

The file or target may change between read and write. Full-file writes can overwrite those changes. String and diff tools have implicit safeguards, but their behavior is tool-specific and does not consistently expose document or node preconditions.

### 3.2 Weak semantic addressing

User instructions refer to sections, list items, or table rows, while general text tools address strings, lines, or byte ranges. Repeated content makes this mismatch more visible.

### 3.3 Poor conflict semantics

When an edit fails, agents need to know whether the target:

- moved unchanged;
- changed;
- disappeared;
- became ambiguous;
- is unsupported.

Generic text errors often do not provide this distinction.

## 4. Product hypothesis

Combining guarded writes with Markdown structure will improve agent editing by:

1. reducing silent overwrite risk;
2. improving target-location accuracy in repetitive documents;
3. allowing exact relocation when surrounding content changes;
4. producing clearer conflicts that agents can recover from;
5. reducing unnecessary document reads and rewrites in local-edit tasks.

The hypothesis must be validated against simpler tools. MD SafeEdit should not assume structural editing is always superior.

## 5. Goals

### P0 goals

- Never automatically overwrite a target whose original bytes changed.
- Detect when the file changes after an agent reads it.
- Relocate an unchanged target when only its position or surroundings change.
- Reject missing or ambiguous targets.
- Preserve untouched bytes exactly.
- Support atomic multi-operation changes.
- Provide an agent-facing API with no more than four primary tools.
- Publish a reproducible benchmark against common editing methods.

### P1 goals

- Support CommonMark, GFM tables, and basic YAML frontmatter.
- Provide CLI and MCP interfaces over the same engine.
- Return clear, stable conflict codes.
- Work without modifying the source Markdown to add IDs.

### P2 goals

- Support Obsidian-aware syntax and existing block IDs.
- Offer additional adapters such as a TypeScript library and editor integration.
- Explore format-equivalent relocation with mandatory preview.

## 6. Non-goals

- Guarantee that the agent's intended change is semantically correct.
- Replace Git, code review, or backups.
- Build a visual editor.
- Create a proprietary Markdown dialect.
- Maintain permanent node identities through arbitrary semantic rewrites.
- Automatically merge two conflicting rewrites of the same node.
- Implement real-time collaborative editing.
- Optimize primarily for short, one-off Markdown files.

## 7. Target users

### 7.1 Primary end user

A non-technical or semi-technical person who frequently asks an AI agent to update long-running Markdown documents and wants fewer accidental edits.

Examples:

- a product manager maintaining PRDs;
- a researcher maintaining notes and reports;
- an open-source maintainer updating documentation;
- an agent user keeping plans and memory in Markdown.

### 7.2 Integration user

An agent developer who needs a safe document-editing tool and wants a protocol, library, CLI, or MCP server.

## 8. Core use cases

### UC1: Change a value in a repeated table

User request:

> Change the charging current in the Battery section from 1A to 2A.

Expected:

- search is limited by structure;
- the target row is read with an anchor;
- only the row changes;
- identical rows elsewhere remain untouched;
- concurrent changes cause a conflict.

### UC2: Rewrite one section

User request:

> Rewrite the Risks section using these new findings.

Expected:

- the complete logical section is read;
- the replacement is guarded by the section's original state;
- nested subsections are handled according to an explicit range definition;
- external changes to that section block the write.

### UC3: Update terminology but exclude code

User request:

> Replace "compute box" with "computing puck" in prose, but not inside code blocks.

Expected:

- search results identify node types;
- code blocks are excluded;
- multiple operations apply atomically;
- any changed target rejects the transaction in strict mode.

### UC4: Target moved after reading

The agent reads a list item. A person inserts a new section before it. The item itself is unchanged.

Expected:

- the document revision mismatch is detected;
- exact relocation finds one node with the same raw bytes and compatible structural evidence;
- the edit may proceed;
- the response records that relocation occurred.

### UC5: Target changed after reading

The agent reads a paragraph. A person edits the paragraph before the agent writes.

Expected:

- no automatic overwrite;
- `TARGET_CHANGED` is returned;
- a likely candidate may be shown for re-reading;
- the agent must obtain a new anchor.

## 9. Functional requirements

### FR1: Inspect

The system shall return:

- canonical file identity;
- document revision;
- Markdown dialect;
- outline;
- supported node types;
- warnings about unsupported syntax.

### FR2: Search

The system shall search by:

- text;
- node type;
- heading path;
- optional section scope;
- inclusion or exclusion filters.

### FR3: Read

The system shall read one or more nodes and return:

- exact source content;
- node type;
- structural path;
- optional neighbors;
- an opaque anchor token.

### FR4: Guarded patch

The system shall support:

- replace;
- insert before;
- insert after;
- delete;
- multiple operations;
- dry run;
- commit.

Every target mutation shall require a valid anchor token.

### FR5: Conflict detection

The system shall distinguish at least:

- document changed;
- target changed;
- target missing;
- target ambiguous;
- overlapping operations;
- unsupported syntax;
- commit race.

### FR6: Exact relocation

When the document changes but target bytes do not, the system shall attempt relocation using:

- raw content identity;
- node type;
- parent and heading context;
- neighboring-node evidence;
- original location as a weak hint.

Automatic relocation is allowed only for one unambiguous unchanged candidate.

### FR7: Atomic commit

The system shall:

- validate all operations first;
- reject intersecting ranges;
- build the final output from one snapshot;
- recheck disk state immediately before commit;
- write through a temporary file;
- leave the original intact on failure.

### FR8: Byte preservation

For a successful patch, bytes outside the union of intended edit ranges shall be identical to the source snapshot.

### FR9: Diff preview

Dry-run and committed responses shall include a human-readable diff and machine-readable operation result.

## 10. User-facing tools

The public MCP interface should expose four tools:

1. `inspect`
2. `search`
3. `read`
4. `patch`

The CLI may expose more commands for human convenience, but all behavior must use the same core APIs.

## 11. Product principles

### Safety over completion rate

Returning a conflict is preferable to writing to a plausible but unproven target.

### Evidence over identity claims

Without persistent IDs in the source file, a node does not have permanent identity. The system manages evidence about a previously read node.

### Simple when possible

MD SafeEdit should coexist with ordinary text editing. It should be used when structure or stale-write protection provides clear value.

### Benchmark before expansion

No advanced relocation heuristic should be added without false-accept evaluation.

## 12. Success criteria

Phase 1 is successful if:

- no benchmark case silently overwrites a changed target;
- exact relocation succeeds for at least 95% of unchanged-moved target cases in the supported syntax set;
- ambiguous cases are rejected in 100% of benchmark fixtures;
- untouched bytes remain identical in 100% of golden tests;
- local structural-edit tasks use fewer generated output tokens than full-file rewrite;
- target accuracy is measurably better than unscoped exact string replacement in repetitive fixtures;
- the four-tool interface can be used successfully by at least three model families.

These are initial engineering targets, not claims for public release until measured.

