# Phase 1 Project Baseline Report

This report documents the state of the repository before any code changes are made.

## 1. System Environment
* **Node.js Version**: `v24.16.0`
* **npm Version**: `11.16.0`

## 2. Test Verification
* **Test Runner**: Vitest v1.6.1
* **Total Tests**: 43
* **Passed**: 43
* **Failed**: 0
* **Skipped**: 0
* **Test Files Verified**:
  - `packages/core/test/snapshot.test.ts` (8 tests)
  - `packages/core/test/atomic.test.ts` (3 tests)
  - `packages/core/test/planner.test.ts` (6 tests)
  - `packages/markdown/test/parser.test.ts` (7 tests)
  - `packages/markdown/test/relocation.test.ts` (7 tests)
  - `packages/protocol/test/token.test.ts` (3 tests)
  - `packages/core/test/diff.test.ts` (2 tests)
  - `packages/cli/test/services.test.ts` (6 tests)
  - `packages/mcp/test/mcp.test.ts` (1 test)

## 3. Workspace Build Verification
All 6 workspace packages build successfully using `npm run build`:
* `@md-safeedit/benchmark` (built via `tsc`)
* `@md-safeedit/cli` (built via `tsc`)
* `@md-safeedit/core` (built via `tsc`)
* `@md-safeedit/markdown` (built via `tsc`)
* `@md-safeedit/mcp` (built via `tsc`)
* `@md-safeedit/protocol` (built via `tsc`)

No type errors detected during `tsc --noEmit` (typecheck command).

## 4. npm pack --dry-run Results
The packages intended for NPM publication are packed successfully:
* **@md-safeedit/core**: `md-safeedit-core-0.1.1-dev.tgz` (16 files, size: 9.2 kB, unpacked: 35.3 kB)
* **@md-safeedit/protocol**: `md-safeedit-protocol-0.1.1-dev.tgz` (10 files, size: 4.6 kB, unpacked: 25.0 kB)
* **@md-safeedit/markdown**: `md-safeedit-markdown-0.1.1-dev.tgz` (13 files, size: 10.2 kB, unpacked: 39.9 kB)
* **@md-safeedit/cli**: `md-safeedit-cli-0.1.1-dev.tgz` (7 files, size: 11.8 kB, unpacked: 56.7 kB)
* **@md-safeedit/mcp**: `md-safeedit-mcp-0.1.1-dev.tgz` (5 files, size: 5.3 kB, unpacked: 19.9 kB)

## 5. Tracked Build Artifacts in Git
The following compiled files (build artifacts) are currently tracked in Git and reside inside the `src/` and `test/` folders instead of being restricted to `dist/`:

* **packages/benchmark/src/**:
  - `baselines.d.ts`, `baselines.js`, `baselines.js.map`
  - `eval-llm.d.ts`, `eval-llm.js`, `eval-llm.js.map`
  - `generate-tasks.d.ts`, `generate-tasks.js`, `generate-tasks.js.map`
  - `run.d.ts`, `run.js`, `run.js.map`
* **packages/cli/src/**:
  - `index.d.ts`, `index.js`, `index.js.map`
  - `services.d.ts`, `services.js`, `services.js.map`
* **packages/cli/test/**:
  - `services.test.d.ts`
* **packages/core/src/**:
  - `diff/diff.d.ts`, `diff/diff.js`, `diff/diff.js.map`
  - `index.d.ts`, `index.js`, `index.js.map`
  - `snapshot/snapshot.d.ts`, `snapshot/snapshot.js`, `snapshot/snapshot.js.map`
  - `transaction/planner.d.ts`, `transaction/planner.js`, `transaction/planner.js.map`
  - `writer/atomic.d.ts`, `writer/atomic.js`, `writer/atomic.js.map`
* **packages/core/test/**:
  - `atomic.test.d.ts`, `diff.test.d.ts`, `planner.test.d.ts`, `snapshot.test.d.ts`
* **packages/markdown/src/**:
  - `index.d.ts`, `index.js`, `index.js.map`
  - `parser/parser.d.ts`, `parser/parser.js`, `parser/parser.js.map`
  - `relocation/relocation.d.ts`, `relocation/relocation.js`, `relocation/relocation.js.map`
  - `sections/sections.d.ts`, `sections/sections.js`, `sections/sections.js.map`
* **packages/markdown/test/**:
  - `parser.test.d.ts`, `relocation.test.d.ts`
* **packages/mcp/src/**:
  - `index.d.ts`, `index.js`, `index.js.map`
* **packages/mcp/test/**:
  - `mcp.test.d.ts`
* **packages/protocol/src/**:
  - `anchor/token.d.ts`, `anchor/token.js`, `anchor/token.js.map`
  - `index.d.ts`, `index.js`, `index.js.map`
  - `schemas/schemas.d.ts`, `schemas/schemas.js`, `schemas/schemas.js.map`
* **packages/protocol/test/**:
  - `token.test.d.ts`
