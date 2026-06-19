# MD SafeEdit

**Safe, precise Markdown editing for AI agents.**

MD SafeEdit helps AI agents update the right part of a Markdown document without silently overwriting changes made by people or other agents.

## Why it exists

AI agents can already edit Markdown with full-file rewrites, string replacement, or text patches. These approaches work well for many simple tasks, but become less reliable when:

- the document is long or frequently updated;
- similar text appears in several places;
- a person edits the file after the agent reads it;
- multiple agents work on the same document;
- the requested change targets a section, list item, or table row rather than an arbitrary line range.

MD SafeEdit gives agents a Markdown-aware way to inspect, locate, and modify content. Every write is guarded by evidence captured when the target was read. If the target has changed or can no longer be identified unambiguously, MD SafeEdit returns a conflict instead of guessing.

## Core principles

1. **Never silently overwrite changed content.**
2. **Use Markdown structure to locate content, not as permission to overwrite it.**
3. **Automatically relocate only content that is provably unchanged.**
4. **Preserve every byte outside the intended edit range.**
5. **Keep the agent-facing toolset small.**
6. **Measure value against simpler editing tools.**

## Initial capabilities

- Inspect a Markdown document as an outline.
- Search sections, list items, and table rows.
- Read a node together with a guarded anchor.
- Replace, insert, or delete content using that anchor.
- Detect external file changes.
- Relocate an unchanged node after surrounding content moves.
- Preview changes as a diff.
- Apply multiple non-overlapping edits atomically.
- Preserve untouched formatting and line endings.

## Example

An agent first reads a table row:

```json
{
  "content": "| Charging current | 1A |",
  "anchor": {
    "token": "mdse_a1_..."
  }
}
```

It then requests a guarded replacement:

```json
{
  "operations": [
    {
      "op": "replace",
      "anchor_token": "mdse_a1_...",
      "content": "| Charging current | 2A |"
    }
  ],
  "dry_run": true
}
```

MD SafeEdit will:

1. verify the file and target state;
2. relocate the target only if its original bytes still exist uniquely;
3. reject ambiguous or changed targets;
4. return a preview diff;
5. apply the change atomically when requested.

## Project status & Benchmark Results

MD SafeEdit is fully implemented, verified, and benchmarked! We evaluated the core protocol against 4 common baseline strategies across **200 programmatic tasks**:

- **B1 (Full-File Rewrite)**: Blindly overwrites files (FAR = 100.0%, WTR = 35.7%).
- **B2 (Exact String Replace)**: High ambiguity rejections (40 false rejections).
- **B3 (Unified Diff)**: Prone to fuzzy-match corruption (FAR = 33.3%).
- **B4 (Line-Hash Patch)**: Fails completely on shifted offsets (20 false rejections).
- **B5 (MD SafeEdit)**: **100% Safe Edit Success Rate (SESR)** and **0.0% False Accept Rate (FAR)** (0 false accepts, 0 wrong target writes).

See the full [Benchmark Report](packages/benchmark/REPORT.md).

## Getting Started

### Prerequisites

- Node.js LTS
- npm

### Installation & Build

Clone the repository and install dependencies:

```bash
npm install
npm run build --workspaces
```

### Running Tests

Execute the unit and integration tests:

```bash
npm run test
```

### Running the Benchmark

Generate the 200 task cases and run the benchmark comparison:

```bash
# Compile packages
npm run build --workspaces

# Generate benchmark task files
node packages/benchmark/dist/generate-tasks.js

# Execute benchmark runner
node packages/benchmark/dist/run.js
```

## Repository Layout

```text
md-safeedit/
├── packages/
│   ├── core/                 # Guarded patch engine (revisioning, CAS, planning, atomicCAS writer)
│   ├── markdown/             # Markdown structural adapter (parser, logical sections, relocation)
│   ├── protocol/             # Shared schemas and HMAC-signed anchor token code
│   ├── cli/                  # Command Line Interface (JSON-RPC adapter)
│   ├── mcp/                  # Stdio Model Context Protocol Server
│   └── benchmark/            # Benchmark runners, 5 baselines, task generator, and reports
├── docs/                     # Design, protocol, architecture, and roadmap documents
├── AGENTS.md                 # Safety rules and scope invariants for developers
└── README.md
```

## Non-goals

MD SafeEdit is not:

- a visual Markdown editor;
- a replacement for Git;
- a guarantee that an agent understands the user's intent;
- a proprietary Markdown format;
- a general-purpose collaborative editor;
- a reason to avoid simpler edit tools when they are sufficient.

## License

Apache License 2.0 is recommended so that commercial and open-source agent products can adopt the implementation or protocol with minimal friction.

