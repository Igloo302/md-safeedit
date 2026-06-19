# MD SafeEdit Architecture

## 1. Architecture summary

MD SafeEdit separates generic guarded file mutation from Markdown-specific structural understanding.

```text
AI Agent / Human CLI
          |
          v
Protocol Adapters
  - MCP
  - CLI
  - TypeScript API
          |
          v
MD SafeEdit Service
  +-------------------------------+
  | Markdown Structural Adapter   |
  | - parse                       |
  | - outline/search/read         |
  | - structural evidence         |
  | - exact relocation            |
  +---------------+---------------+
                  |
  +---------------v---------------+
  | Guarded Patch Core            |
  | - revision and raw hash       |
  | - anchor verification         |
  | - overlap detection           |
  | - transaction planning        |
  | - CAS and atomic commit       |
  +---------------+---------------+
                  |
                  v
             Filesystem
```

## 2. Architectural principles

### 2.1 Core is format-independent

The guarded patch core understands bytes, snapshots, ranges, anchors, and transactions. It must not know what a Markdown heading is.

### 2.2 Markdown adapter supplies evidence

The Markdown adapter turns source bytes into structural nodes and evidence used to locate them. Structure helps locate a target but does not authorize overwriting changed content.

### 2.3 Anchors are snapshot evidence

An anchor is not a permanent node ID. It records evidence about one node observed in one document snapshot.

### 2.4 Relocation has a narrow automatic boundary

V1 automatically relocates only a target whose original raw bytes remain present as one unique, structurally compatible node.

### 2.5 Commit uses optimistic concurrency control

No long-lived file lock is required during agent reasoning. The system verifies assumptions at patch time and again at commit.

## 3. Components

## 3.1 Protocol layer

Responsibilities:

- parse and validate external requests;
- enforce protocol versions;
- convert internal errors to stable public codes;
- issue and verify opaque anchor tokens;
- ensure mutation requests cannot omit anchor evidence.

The protocol layer must reject unknown or malformed fields according to versioning policy.

## 3.2 Markdown parser

Responsibilities:

- parse source without serializing it back;
- provide exact source ranges;
- identify supported block nodes;
- construct logical sections from heading hierarchy;
- preserve unsupported syntax as raw nodes where possible;
- emit parser warnings.

The parser output is a transient source map, not the stored document representation.

## 3.3 Node model

Proposed internal node:

```ts
interface MarkdownNode {
  runtimeId: string;
  type:
    | "document"
    | "section"
    | "heading"
    | "paragraph"
    | "list"
    | "list_item"
    | "blockquote"
    | "code_block"
    | "table"
    | "table_row"
    | "frontmatter"
    | "raw";
  range: ByteRange;
  contentRange?: ByteRange;
  parentRuntimeId?: string;
  childRuntimeIds: string[];
  structuralPath: StructuralPathSegment[];
  rawHash: string;
  normalizedFingerprint?: string;
  previousSiblingFingerprint?: string;
  nextSiblingFingerprint?: string;
}
```

`runtimeId` is valid only for the parse instance and must never be accepted alone for mutation.

## 3.4 Logical section builder

A section begins at a heading and ends before the next heading of equal or higher level.

The model should distinguish:

- heading range;
- direct content range;
- full section range including nested subsections.

Patch operations must specify which range they target. The default `section` replacement in V1 should replace the full section body while preserving or explicitly replacing the heading according to an option.

## 3.5 Snapshot manager

A snapshot contains:

```ts
interface DocumentSnapshot {
  canonicalPath: string;
  fileIdentity?: FileIdentity;
  bytes: Uint8Array;
  revision: string;
  encoding: "utf-8" | "utf-8-bom";
  lineEnding: "lf" | "crlf" | "mixed";
  parsedDocument: ParsedMarkdownDocument;
  createdAt: string;
}
```

`revision` should be a cryptographic hash of the complete source bytes. File metadata can optimize checks but must not replace content hashing for correctness.

## 3.6 Anchor service

An anchor payload should bind:

- protocol version;
- canonical file identity;
- source revision;
- source byte range;
- raw target hash;
- node type;
- structural fingerprint;
- selected neighbor evidence;
- issue time and optional expiry;
- dialect identifier.

The external representation should be opaque and authenticated.

Possible design:

```text
base64url(payload) + "." + base64url(HMAC(payload))
```

For local use, the signing key can be generated per server installation or process. Persistence policy must be explicit:

- process-scoped keys make anchors session-scoped;
- installation-scoped keys allow anchors across restarts but require secure key storage.

Phase 1 may use session-scoped anchors as long as expiration errors are explicit.

## 3.7 Search service

Search stages:

1. scope by document or section;
2. filter by node type;
3. match text against exact source content;
4. return structural path and preview;
5. optionally return anchors for direct patching only if the complete target bytes are included in the result contract.

Safer default: search returns candidates, while `read` issues mutation-capable anchors.

## 3.8 Relocation engine

### Fast path

If current revision equals anchor revision:

- verify target range;
- verify raw hash;
- accept.

### Exact relocation path

If revision differs:

1. parse current document;
2. find nodes of the same type;
3. retain nodes with the same raw hash;
4. score structural compatibility;
5. accept only one candidate above the minimum evidence threshold;
6. otherwise return missing or ambiguous.

Structural evidence may include:

- heading path and levels;
- parent raw or normalized fingerprint;
- sibling occurrence;
- previous and next sibling fingerprints;
- distance from the old byte range.

Distance is a tie-breaker, not primary proof.

### Changed-target path

If no raw-identical candidate exists, the engine may locate similar candidates for diagnostics. It must not authorize a write.

## 3.9 Transaction planner

Inputs:

- one current snapshot;
- one or more verified operations.

Algorithm:

1. resolve every anchor against the same snapshot;
2. convert operations to byte edits;
3. validate operation-specific content;
4. sort ranges;
5. reject any intersection;
6. define ordering for multiple zero-width inserts;
7. apply edits from highest offset to lowest;
8. parse and validate resulting bytes;
9. generate diff;
10. if commit requested, perform final compare-and-swap and atomic replace.

## 3.10 Atomic writer

Required behavior:

1. canonicalize and authorize the path;
2. capture source identity and revision;
3. write result to a temporary file in the same directory;
4. preserve intended permissions;
5. flush and fsync where supported;
6. re-read or securely verify current source state;
7. abort with `COMMIT_RACE` if it changed;
8. atomically replace the source;
9. fsync parent directory where supported;
10. return the new revision.

Cross-platform behavior needs dedicated integration tests. Filesystem atomicity differs by operating system and open-file state.

## 4. Hash and fingerprint model

### 4.1 Document revision

SHA-256 over complete source bytes.

Purpose:

- snapshot identity;
- compare-and-swap;
- transaction consistency.

### 4.2 Raw node hash

SHA-256 over exact node bytes.

Purpose:

- authorize same-snapshot edits;
- authorize exact relocation.

### 4.3 Normalized fingerprint

A node-type-specific fingerprint that may normalize non-semantic presentation differences conservatively.

Purpose:

- diagnostics;
- candidate ranking;
- format-equivalent preview.

It must not authorize automatic write in V1.

Normalization must be node-type aware. A global whitespace-normalization function is unsafe for Markdown.

## 5. Conflict state machine

```text
ANCHOR RECEIVED
      |
      v
ANCHOR VALID? ---- no ----> ANCHOR_INVALID / EXPIRED
      |
     yes
      |
      v
SAME REVISION? ---- yes ---> RANGE + RAW HASH VALID?
      |                            | yes
      no                           v
      |                        VERIFIED
      v
EXACT RAW-HASH CANDIDATES
      |
      +-- 0 --> TARGET_CHANGED or TARGET_MISSING
      |
      +-- 1 --> STRUCTURALLY COMPATIBLE?
      |               | yes
      |               v
      |          VERIFIED_RELOCATED
      |               |
      |              no
      |               v
      |       TARGET_MISSING/AMBIGUOUS
      |
      +-- >1 --> DISAMBIGUATE WITH STRUCTURE
                       |
                       +-- exactly 1 --> VERIFIED_RELOCATED
                       |
                       +-- otherwise --> ANCHOR_AMBIGUOUS
```

## 6. Security architecture

### Threats

- path traversal;
- symlink escape;
- forged anchors;
- anchor replay against another file;
- replacement content containing executable-looking Markdown;
- race between validation and commit;
- denial of service through huge or pathological documents;
- parser differentials.

### Controls

- configured filesystem roots;
- canonical path checks;
- signed anchors;
- token binding to file and revision evidence;
- size and operation limits;
- timeouts;
- no execution of document content;
- parser version recorded in anchor payload;
- final commit race check.

## 7. Observability

Structured events:

- inspect completed;
- search completed;
- anchor issued;
- anchor verified;
- relocation attempted;
- relocation accepted/rejected;
- conflict returned;
- dry run completed;
- transaction committed/aborted.

Metrics should avoid logging full private document content. Hashes, node types, timings, counts, and result codes are sufficient by default.

## 8. Performance expectations

Phase 1 target:

- documents up to 5 MB;
- parsing under 150 ms p95 for 1 MB representative documents on a modern laptop;
- anchor verification under 20 ms when revision matches;
- exact relocation under 250 ms p95 for 1 MB documents;
- memory below 5x source file size for ordinary documents.

These are provisional targets to be validated.

