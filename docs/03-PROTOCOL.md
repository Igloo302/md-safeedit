# MD SafeEdit Protocol

## 1. Status

This document defines the proposed V1 agent-facing protocol. It is transport-independent and may be exposed through MCP, CLI JSON mode, or a library API.

## 2. Protocol principles

- Four primary operations: `inspect`, `search`, `read`, `patch`.
- Mutation requires an opaque anchor token.
- Bare runtime node IDs are never mutation authority.
- Responses use stable machine-readable result and error codes.
- Dry run and commit share one patch schema.
- Multiple operations are atomic by default.

## 3. Common types

### 3.1 File reference

```json
{
  "path": "docs/spec.md"
}
```

Paths are resolved inside configured roots. Responses return a normalized display path, not necessarily the host's full private path.

### 3.2 Node type

```text
document | section | heading | paragraph | list_item |
blockquote | code_block | table | table_row | frontmatter | raw
```

### 3.3 Structural path

```json
[
  {
    "heading": "Hardware",
    "level": 1,
    "occurrence": 1
  },
  {
    "heading": "Battery",
    "level": 2,
    "occurrence": 2
  }
]
```

This is descriptive evidence, not a permanent identifier.

## 4. `inspect`

### Request

```json
{
  "file": {
    "path": "docs/spec.md"
  },
  "options": {
    "max_depth": 4,
    "include_counts": true
  }
}
```

### Response

```json
{
  "ok": true,
  "protocol_version": "1.0",
  "document": {
    "display_path": "docs/spec.md",
    "revision": "sha256:...",
    "dialect": "commonmark+gfm",
    "size_bytes": 28431,
    "line_ending": "lf"
  },
  "outline": [
    {
      "runtime_id": "n_01",
      "type": "section",
      "title": "Hardware",
      "level": 1,
      "path": [
        {
          "heading": "Hardware",
          "level": 1,
          "occurrence": 1
        }
      ],
      "child_count": 4
    }
  ],
  "warnings": []
}
```

`runtime_id` is navigation convenience only.

## 5. `search`

### Request

```json
{
  "file": {
    "path": "docs/spec.md"
  },
  "query": "charging current",
  "filters": {
    "include_types": ["paragraph", "list_item", "table_row"],
    "exclude_types": ["code_block"],
    "under_path": [
      {
        "heading": "Hardware",
        "level": 1,
        "occurrence": 1
      }
    ]
  },
  "options": {
    "limit": 20,
    "preview_chars": 160
  }
}
```

### Response

```json
{
  "ok": true,
  "document_revision": "sha256:...",
  "matches": [
    {
      "runtime_id": "n_41",
      "type": "table_row",
      "path": [
        {
          "heading": "Hardware",
          "level": 1,
          "occurrence": 1
        },
        {
          "heading": "Battery",
          "level": 2,
          "occurrence": 1
        }
      ],
      "preview": "| Charging current | 1A |",
      "match_ranges": [
        {
          "start": 2,
          "end": 18
        }
      ]
    }
  ]
}
```

Search does not return mutation-capable anchors by default.

## 6. `read`

### Request

```json
{
  "file": {
    "path": "docs/spec.md"
  },
  "targets": [
    {
      "runtime_id": "n_41"
    }
  ],
  "options": {
    "include_neighbors": 1,
    "include_children": false
  }
}
```

Alternatively, a target may be expressed through a fully qualified path and node selector if runtime IDs are unavailable.

### Response

```json
{
  "ok": true,
  "document_revision": "sha256:...",
  "nodes": [
    {
      "type": "table_row",
      "content": "| Charging current | 1A |\n",
      "path": [
        {
          "heading": "Hardware",
          "level": 1,
          "occurrence": 1
        },
        {
          "heading": "Battery",
          "level": 2,
          "occurrence": 1
        }
      ],
      "anchor_token": "mdse_a1_...",
      "neighbors": {
        "previous": [],
        "next": []
      }
    }
  ]
}
```

The token is opaque and must be returned unchanged.

## 7. `patch`

### Request

```json
{
  "file": {
    "path": "docs/spec.md"
  },
  "operations": [
    {
      "op": "replace",
      "anchor_token": "mdse_a1_...",
      "content": "| Charging current | 2A |\n"
    }
  ],
  "options": {
    "dry_run": true,
    "atomic": true,
    "validation_level": "normal"
  }
}
```

### Supported operations

#### Replace

```json
{
  "op": "replace",
  "anchor_token": "...",
  "content": "..."
}
```

#### Delete

```json
{
  "op": "delete",
  "anchor_token": "..."
}
```

#### Insert before

```json
{
  "op": "insert_before",
  "anchor_token": "...",
  "content": "..."
}
```

#### Insert after

```json
{
  "op": "insert_after",
  "anchor_token": "...",
  "content": "..."
}
```

### Successful dry-run response

```json
{
  "ok": true,
  "status": "preview",
  "source_revision": "sha256:...",
  "result_revision": "sha256:...",
  "relocated": false,
  "diff": "--- a/docs/spec.md\n+++ b/docs/spec.md\n@@ ...",
  "operations": [
    {
      "index": 0,
      "status": "verified",
      "node_type": "table_row"
    }
  ],
  "warnings": []
}
```

### Successful commit response

```json
{
  "ok": true,
  "status": "committed",
  "source_revision": "sha256:...",
  "new_revision": "sha256:...",
  "diff": "...",
  "operations": [
    {
      "index": 0,
      "status": "verified_relocated",
      "node_type": "table_row"
    }
  ]
}
```

## 8. Error model

### Example

```json
{
  "ok": false,
  "error": {
    "code": "TARGET_CHANGED",
    "message": "The target content changed after it was read.",
    "retryable": true,
    "recommended_action": "Read the candidate again and create a new patch.",
    "details": {
      "operation_index": 0,
      "candidate_count": 1
    }
  }
}
```

### Stable codes

| Code | Meaning | Agent action |
|---|---|---|
| `DOCUMENT_CHANGED` | Strict document CAS failed | Re-inspect or use node-level retry flow |
| `TARGET_CHANGED` | Likely target exists but raw bytes changed | Re-read and reconsider |
| `TARGET_MISSING` | No compatible target found | Search again |
| `ANCHOR_AMBIGUOUS` | Multiple unchanged compatible candidates | Ask user or read candidates |
| `ANCHOR_INVALID` | Token malformed, forged, or incompatible | Obtain a new anchor |
| `ANCHOR_EXPIRED` | Token is no longer valid | Read again |
| `OVERLAPPING_OPERATIONS` | Transaction ranges intersect | Split or remove conflicting operations |
| `UNSUPPORTED_SYNTAX` | Safe node boundary unavailable | Use a larger supported node or another tool |
| `INVALID_REPLACEMENT` | Replacement violates operation contract | Correct content |
| `VALIDATION_FAILED` | Resulting Markdown failed configured validation | Correct content or adjust validation level |
| `COMMIT_RACE` | File changed during final commit window | Retry from read |
| `IO_ERROR` | Filesystem operation failed | Inspect details or retry |

## 9. Validation levels

Validation level concerns resulting Markdown structure, not conflict safety.

### Strict

- parse without errors;
- supported structural invariants maintained;
- no new unsupported raw regions;
- target-type-specific rules enforced.

### Normal

- parse successfully;
- allow existing unsupported regions;
- reject newly broken target structure.

### Permissive

- byte operation may proceed if safety preconditions pass;
- parser warnings returned;
- still never relax anchor or concurrency checks.

## 10. Versioning

- Protocol uses semantic versions.
- Minor versions may add optional response fields.
- Major versions may change schemas or anchor semantics.
- Anchor tokens are bound to a protocol and parser-evidence version.
- Unsupported token versions return `ANCHOR_INVALID`, not best-effort decoding.

