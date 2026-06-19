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

MD SafeEdit can be used in two ways:
1. **As an End User** (e.g., running the MCP Server for Cursor/Claude Desktop, or using the CLI) — **No source code clone required!** You can run or install it directly via NPM.
2. **As a Contributor / Developer** (building from source, running tests, or running the benchmark) — Clone this GitHub repository and build locally.

---

## 1. For End Users (MCP & CLI)

You do **not** need to clone this repository. Ensure you have Node.js (LTS version recommended) and npm installed.

### Option A: Using the MCP Server in AI Coding Assistants

MD SafeEdit can run as a Model Context Protocol (MCP) server, allowing AI coding assistants like **Cursor**, **Claude Desktop**, or **Windsurf** to safely read and edit Markdown files using the signature-guarded CAS patch protocol.

#### Configure in Claude Desktop

Add the following configuration to your Claude Desktop configuration file (typically `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, or `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "md-safeedit": {
      "command": "npx",
      "args": [
        "-y",
        "@md-safeedit/mcp@dev"
      ],
      "env": {
        "MDSE_ALLOWED_ROOTS": "/absolute/path/to/your/project"
      }
    }
  }
}
```

> [!IMPORTANT]
> - Replace `/absolute/path/to/your/project` with your actual workspace root directory.
> - For security, the MCP server restricts files it can read or write to directories specified in `MDSE_ALLOWED_ROOTS` (see Configuration below).

#### Configure in Cursor

1. Open Cursor Settings -> **Features** -> **MCP**.
2. Click **+ Add New MCP Server**.
3. Fill in the fields:
   - **Name**: `md-safeedit`
   - **Type**: `stdio`
   - **Command**: `npx -y @md-safeedit/mcp@dev`
4. *(Optional)* Set environment variables (such as `MDSE_ALLOWED_ROOTS` or `MDSE_TOKEN_TTL_MS`) in the configuration if desired. By default, it will allow operations in Cursor's current working directory.

---

### Option B: Using the CLI Tool

If you want to use the CLI tool to inspect documents, search nodes, or apply patches manually:

1. **Install the CLI globally**:
   ```bash
   npm install -g @md-safeedit/cli@dev
   ```

2. **Run CLI commands**:
   ```bash
   # Inspect a file (gets formatting, line endings, size, and current revision)
   mdse inspect path/to/document.md

   # Search for section headings, list items, or table rows
   mdse search path/to/document.md --query "Installation"

   # Read a node with an anchor token
   mdse read path/to/document.md --node-id "section:Installation"
   ```

> [!NOTE]
> During the developer preview phase, the packages are published to NPM with the `@dev` tag. When installing or running via NPM/npx, make sure to append `@dev` (e.g., `@md-safeedit/mcp@dev` or `@md-safeedit/cli@dev`).

---

### Configuration (Environment Variables)

The MCP server and CLI can be configured using the following environment variables:

- **`MDSE_ALLOWED_ROOTS`**: A comma-separated list of absolute paths that MD SafeEdit is authorized to access.
  - *Default*: The current working directory (`process.cwd()`).
  - *Purpose*: Prevents directory traversal attacks. MD SafeEdit will resolve all symlinks and reject operations on any files outside these roots.
- **`MDSE_TOKEN_TTL_MS`**: The lifetime of signed anchor tokens in milliseconds.
  - *Default*: `3600000` (1 hour).
  - *Purpose*: Anchor tokens automatically expire after this period to prevent stale token re-use. Increase this for exceptionally long agent planning workflows.

---

## 2. For Contributors & Developers (Source Code)

If you want to contribute, build from source, run tests, or run the benchmark comparison:

### Prerequisites

- Node.js LTS
- npm

### Installation & Build

Clone the repository and build the monorepo packages:

```bash
git clone https://github.com/Igloo302/md-safeedit.git
cd md-safeedit
npm install
npm run build --workspaces
```

### Running Tests

Execute the unit and integration tests:

```bash
npm run test
```

### Running the Benchmark

MD SafeEdit includes a benchmarking suite that evaluates performance against 4 baseline strategies over 200 task cases:

```bash
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

