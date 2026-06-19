# MD SafeEdit Benchmark Report

This report evaluates the safety, correctness, and robustness of **MD SafeEdit** against 4 common baseline strategies across **200 tasks**.

## Summary Metrics

| Strategy | Safe Edit Success Rate (SESR) | False Accept Rate (FAR) | Wrong Target Rate (WTR) | Safe Rejection Rate (SRR) |
|---|---|---|---|---|
| **B1: Full-File Rewrite** | 64.3% | **100.0%** | 35.7% | 0.0% |
| **B2: Exact String Replace** | 71.4% | **0.0%** | 0.0% | 100.0% |
| **B3: Unified Diff** | 78.6% | **33.3%** | 10.7% | 66.7% |
| **B4: Line-Hash Patch** | 75.0% | **0.0%** | 10.7% | 100.0% |
| **B5: MD SafeEdit (Ours)** | 100.0% | **0.0%** | 0.0% | 100.0% |

> [!IMPORTANT]
> **False Accept Rate (FAR)** represents the percentage of unsafe concurrent modification tasks where the strategy *incorrectly* allowed the write. Our goal is **0.0%** for MD SafeEdit.
> **Safe Edit Success Rate (SESR)** measures the percentage of correct, safe edits successfully relocated and committed.

## Detailed Task Outcomes

| Strategy | Success (Commits) | False Rejections | False Accepts (Unsafe) | Safe Rejections | Wrong Target writes |
|---|---|---|---|---|---|
| **B1: Full-File Rewrite** | 90 | 0 | 60 | 0 | 50 |
| **B2: Exact String Replace** | 100 | 40 | 0 | 60 | 0 |
| **B3: Unified Diff** | 110 | 15 | 20 | 40 | 15 |
| **B4: Line-Hash Patch** | 105 | 20 | 0 | 60 | 15 |
| **B5: MD SafeEdit (Ours)** | 140 | 0 | 0 | 60 | 0 |

## Breakdown by Category

### Category: `local-edit`

| Strategy | Success | False Rejections | False Accepts | Safe Rejections | Wrong Target |
|---|---|---|---|---|---|
| **B1: Full-File Rewrite** | 40 | 0 | 0 | 0 | 0 |
| **B2: Exact String Replace** | 40 | 0 | 0 | 0 | 0 |
| **B3: Unified Diff** | 40 | 0 | 0 | 0 | 0 |
| **B4: Line-Hash Patch** | 40 | 0 | 0 | 0 | 0 |
| **B5: MD SafeEdit (Ours)** | 40 | 0 | 0 | 0 | 0 |

### Category: `ambiguity-reject`

| Strategy | Success | False Rejections | False Accepts | Safe Rejections | Wrong Target |
|---|---|---|---|---|---|
| **B1: Full-File Rewrite** | 0 | 0 | 20 | 0 | 0 |
| **B2: Exact String Replace** | 0 | 0 | 0 | 20 | 0 |
| **B3: Unified Diff** | 0 | 0 | 20 | 0 | 0 |
| **B4: Line-Hash Patch** | 0 | 0 | 0 | 20 | 0 |
| **B5: MD SafeEdit (Ours)** | 0 | 0 | 0 | 20 | 0 |

### Category: `disambiguation`

| Strategy | Success | False Rejections | False Accepts | Safe Rejections | Wrong Target |
|---|---|---|---|---|---|
| **B1: Full-File Rewrite** | 20 | 0 | 0 | 0 | 0 |
| **B2: Exact String Replace** | 0 | 20 | 0 | 0 | 0 |
| **B3: Unified Diff** | 20 | 0 | 0 | 0 | 0 |
| **B4: Line-Hash Patch** | 20 | 0 | 0 | 0 | 0 |
| **B5: MD SafeEdit (Ours)** | 20 | 0 | 0 | 0 | 0 |

### Category: `target-moved`

| Strategy | Success | False Rejections | False Accepts | Safe Rejections | Wrong Target |
|---|---|---|---|---|---|
| **B1: Full-File Rewrite** | 0 | 0 | 0 | 0 | 20 |
| **B2: Exact String Replace** | 20 | 0 | 0 | 0 | 0 |
| **B3: Unified Diff** | 20 | 0 | 0 | 0 | 0 |
| **B4: Line-Hash Patch** | 0 | 20 | 0 | 0 | 0 |
| **B5: MD SafeEdit (Ours)** | 20 | 0 | 0 | 0 | 0 |

### Category: `target-changed-reject`

| Strategy | Success | False Rejections | False Accepts | Safe Rejections | Wrong Target |
|---|---|---|---|---|---|
| **B1: Full-File Rewrite** | 0 | 0 | 20 | 0 | 0 |
| **B2: Exact String Replace** | 0 | 0 | 0 | 20 | 0 |
| **B3: Unified Diff** | 0 | 0 | 0 | 20 | 0 |
| **B4: Line-Hash Patch** | 0 | 0 | 0 | 20 | 0 |
| **B5: MD SafeEdit (Ours)** | 0 | 0 | 0 | 20 | 0 |

### Category: `target-deleted-reject`

| Strategy | Success | False Rejections | False Accepts | Safe Rejections | Wrong Target |
|---|---|---|---|---|---|
| **B1: Full-File Rewrite** | 0 | 0 | 20 | 0 | 0 |
| **B2: Exact String Replace** | 0 | 0 | 0 | 20 | 0 |
| **B3: Unified Diff** | 0 | 0 | 0 | 20 | 0 |
| **B4: Line-Hash Patch** | 0 | 0 | 0 | 20 | 0 |
| **B5: MD SafeEdit (Ours)** | 0 | 0 | 0 | 20 | 0 |

### Category: `structural-filter`

| Strategy | Success | False Rejections | False Accepts | Safe Rejections | Wrong Target |
|---|---|---|---|---|---|
| **B1: Full-File Rewrite** | 20 | 0 | 0 | 0 | 0 |
| **B2: Exact String Replace** | 0 | 20 | 0 | 0 | 0 |
| **B3: Unified Diff** | 20 | 0 | 0 | 0 | 0 |
| **B4: Line-Hash Patch** | 20 | 0 | 0 | 0 | 0 |
| **B5: MD SafeEdit (Ours)** | 20 | 0 | 0 | 0 | 0 |

### Category: `encoding-syntax`

| Strategy | Success | False Rejections | False Accepts | Safe Rejections | Wrong Target |
|---|---|---|---|---|---|
| **B1: Full-File Rewrite** | 0 | 0 | 0 | 0 | 15 |
| **B2: Exact String Replace** | 15 | 0 | 0 | 0 | 0 |
| **B3: Unified Diff** | 0 | 0 | 0 | 0 | 15 |
| **B4: Line-Hash Patch** | 0 | 0 | 0 | 0 | 15 |
| **B5: MD SafeEdit (Ours)** | 15 | 0 | 0 | 0 | 0 |

### Category: `obsidian-block-id`

| Strategy | Success | False Rejections | False Accepts | Safe Rejections | Wrong Target |
|---|---|---|---|---|---|
| **B1: Full-File Rewrite** | 0 | 0 | 0 | 0 | 15 |
| **B2: Exact String Replace** | 15 | 0 | 0 | 0 | 0 |
| **B3: Unified Diff** | 0 | 15 | 0 | 0 | 0 |
| **B4: Line-Hash Patch** | 15 | 0 | 0 | 0 | 0 |
| **B5: MD SafeEdit (Ours)** | 15 | 0 | 0 | 0 | 0 |

### Category: `transaction-batch`

| Strategy | Success | False Rejections | False Accepts | Safe Rejections | Wrong Target |
|---|---|---|---|---|---|
| **B1: Full-File Rewrite** | 10 | 0 | 0 | 0 | 0 |
| **B2: Exact String Replace** | 10 | 0 | 0 | 0 | 0 |
| **B3: Unified Diff** | 10 | 0 | 0 | 0 | 0 |
| **B4: Line-Hash Patch** | 10 | 0 | 0 | 0 | 0 |
| **B5: MD SafeEdit (Ours)** | 10 | 0 | 0 | 0 | 0 |

