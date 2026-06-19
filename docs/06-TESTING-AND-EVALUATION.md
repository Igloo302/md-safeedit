# MD SafeEdit Testing and Evaluation Plan

## 1. Evaluation question

The project is not evaluated by feature count. It is evaluated by whether it makes repeated Markdown editing safer and more reliable than simpler alternatives.

The primary question:

> Does Markdown-aware guarded editing reduce wrong-target writes and stale overwrites without imposing unacceptable latency, token, or tool-use cost?

## 2. Quality model

Product quality has five dimensions:

1. **Safety** — does it refuse unsafe writes?
2. **Correctness** — does it modify the intended node?
3. **Recoverability** — does it return useful conflict information?
4. **Preservation** — does it avoid unrelated file changes?
5. **Efficiency** — does it reduce context, output, or retries enough to justify itself?

Safety has priority over successful completion rate.

## 3. Primary metrics

## 3.1 False accept rate

Percentage of cases where the system writes despite the target having changed or being ambiguous.

```text
false accepts / all unsafe cases
```

Target: **0% in the maintained benchmark suite.**

This is the most important metric.

## 3.2 Safe edit success rate

Percentage of valid requested edits completed correctly without unrelated changes.

Measure separately for:

- same snapshot;
- target moved unchanged;
- duplicate content;
- multi-operation transaction.

## 3.3 Exact relocation success

Percentage of unchanged-moved targets correctly relocated and edited.

Target for supported fixtures: **≥95%.**

## 3.4 Ambiguity rejection rate

Percentage of deliberately ambiguous cases rejected.

Target: **100%.**

## 3.5 Wrong-target rate

Percentage of completed edits applied to the wrong semantic node.

Target: **0% for benchmark fixtures.**

## 3.6 Untouched-byte preservation

Percentage of successful operations where all bytes outside intended edit ranges remain identical.

Target: **100%.**

## 3.7 Conflict classification accuracy

Accuracy of distinguishing:

- changed;
- missing;
- ambiguous;
- unsupported;
- commit race.

Target: **≥95% initially**, with no changed target classified as safe.

## 4. Secondary metrics

- input tokens;
- output tokens;
- total tool calls;
- model retries;
- end-to-end latency;
- parser latency;
- relocation latency;
- peak memory;
- diff size;
- unrelated changed lines;
- agent tool-selection success;
- percentage of tasks requiring user clarification.

## 5. Baselines

Compare MD SafeEdit against:

### B1: Full-file rewrite

Agent reads and rewrites the complete document.

### B2: Exact string replacement

Agent provides old and new strings with uniqueness checks.

### B3: Unified diff

Agent produces and applies a patch.

### B4: Line-range hash patch

Agent reads line ranges with content hashes and submits guarded line edits.

The fourth baseline is important: it tests whether Markdown structure provides value beyond generic guarded text editing.

## 6. Benchmark task families

At least 200 tasks for public beta.

## 6.1 Straightforward local edits

- change one paragraph;
- change one list item;
- change one table row;
- append to a section;
- delete a paragraph.

## 6.2 Repetition and ambiguity

- identical list items in different sections;
- duplicate headings;
- repeated warning blocks;
- identical table rows;
- repeated template sections.

## 6.3 Concurrent-change scenarios

- insertion before target;
- insertion after target;
- target section moved;
- unrelated section rewritten;
- target formatting changed;
- target semantically changed;
- target deleted;
- duplicate target added;
- file changed during commit.

## 6.4 Structural filtering

- replace prose but exclude code;
- search within one heading path;
- edit a row in one of several tables;
- update a list item but not matching paragraph text.

## 6.5 Syntax and encoding

- LF;
- CRLF;
- UTF-8 BOM;
- emoji;
- CJK;
- combining characters;
- escaped table pipes;
- nested lists;
- code fences containing headings;
- HTML blocks;
- frontmatter;
- malformed Markdown.

## 6.6 Transactions

- two independent replacements;
- replacement plus insert;
- overlapping section and child-row edits;
- multiple inserts at one boundary;
- one stale anchor in a batch;
- commit failure after temporary write.

## 7. Dataset format

Each task should contain:

```text
task-id/
├── initial.md
├── current.md
├── request.txt
├── expected.md
├── metadata.json
└── assertions.json
```

Example metadata:

```json
{
  "category": "target-moved-unchanged",
  "dialect": "commonmark+gfm",
  "expected_outcome": "commit",
  "allowed_relocation": "exact-only",
  "target_type": "table_row"
}
```

## 8. Scoring

### Task outcome

- 1.0: exact expected result;
- 0.0: wrong result, unsafe write, or corruption;
- conflict tasks score 1.0 only when the expected conflict is returned.

Do not award partial safety credit for a wrong write.

### Aggregate reporting

Report:

- macro average by task family;
- micro average across tasks;
- safety metrics separately;
- model-specific tool-use results;
- latency and token distributions;
- confidence intervals where appropriate.

## 9. Test layers

## 9.1 Unit tests

- hashing;
- ranges;
- overlap;
- anchors;
- path authorization;
- section construction;
- fingerprints;
- error mapping.

## 9.2 Property-based tests

Properties:

- applying non-overlapping edits preserves untouched slices;
- rejected transactions do not change the file;
- encode/decode token round trips;
- modified token bytes fail authentication;
- edits applied in planner order match reference implementation.

## 9.3 Golden fixture tests

Parser nodes, outlines, ranges, patches, and diffs are checked against committed expected outputs.

## 9.4 Integration tests

- real filesystem;
- temporary directories;
- symlinks;
- permissions;
- concurrent modification;
- process restart;
- CLI and MCP.

## 9.5 Fault-injection tests

Simulate:

- temporary write failure;
- fsync failure;
- source changes before rename;
- rename failure;
- parser exception;
- malformed token;
- oversized document.

## 9.6 Model-in-the-loop tests

At minimum:

- one leading proprietary model;
- one second provider model;
- one capable open-weight model.

Evaluate:

- correct tool selection;
- whether the model reads before patching;
- whether it returns anchor tokens unchanged;
- recovery from each conflict code;
- unnecessary full-file reads.

## 10. Release thresholds

### Alpha

- zero known false accepts in core fixtures;
- ≥90% valid-task completion;
- ≥90% exact relocation;
- 100% ambiguity rejection;
- 100% byte preservation.

### Beta

- zero false accepts in 200+ public tasks;
- ≥95% valid-task completion in supported scope;
- ≥95% exact relocation;
- ≥95% conflict classification;
- cross-platform CI;
- benchmark baselines published.

### Stable 1.0

- protocol frozen through real integration feedback;
- safety audit completed;
- documented platform limitations;
- no critical unresolved race or path-security issue;
- at least two independent Agent integrations.

## 11. How to decide whether the product is good

MD SafeEdit is good if:

- it refuses changed or ambiguous targets consistently;
- it safely completes moved-target edits that line and string tools fail;
- its conflicts help agents recover;
- it introduces few model-tool mistakes;
- its overhead is acceptable for long-lived documents.

It is not good if:

- it relies on fuzzy matching to improve success rates;
- it rejects ordinary edits so often that users bypass it;
- line-hash patches perform equally well with lower complexity;
- agents cannot reliably use the protocol;
- parser limitations cause unpredictable node boundaries;
- “safe” behavior depends on undocumented filesystem assumptions.

## 12. Honest outcome possibilities

The benchmark may show:

1. full structural editing is valuable;
2. only section navigation plus guarded text patches is valuable;
3. generic line-hash editing is sufficient;
4. structure helps reading but not writing;
5. the best design should be absorbed into mainstream agent edit tools.

All five are valid research outcomes.

