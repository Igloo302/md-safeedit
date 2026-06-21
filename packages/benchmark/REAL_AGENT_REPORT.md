# MD SafeEdit Real Agent Evaluation Report

This report evaluates the performance of the **Antigravity subagents** running across **8** end-to-end tasks using the CAS signature-guarded protocol.

## Summary Metrics

| Metric | Target | Actual | Status |
|---|---|---|---|
| **Wrong-Target Write Rate** | **0.0%** | 0.0% | ✅ PASS |
| **Final Task Completion Rate** | **≥90%** | 100.0% | ✅ PASS |
| **Workflow Compliance Rate** | **≥95%** | 100.0% | ✅ PASS |
| **Bypassing Tools (Full Rewrites)** | **0.0%** | 0.0% | ✅ PASS |
| **Average Latency** | - | 51.8s | - |
| **Total Tokens Consumed** | - | 50,917 tokens | - |

## Detailed Task Runs

| Task ID | Category | Expected | Outcome | Tokens (In/Out/Total) | Latency | Compliance | Tools Invocations |
|---|---|---|---|---|---|---|---|
| task-001 | standard-edit | commit | **SUCCESS** | 557 / 6459 / **7016** | 49.0s | ✅ | view_file:7, run_command:9, schedule:1, list_dir:2, send_message:1 |
| task-004 | standard-edit | commit | **SUCCESS** | 300 / 3402 / **3702** | 39.0s | ✅ | list_dir:2, view_file:4, run_command:7, send_message:1 |
| task-007 | standard-edit | commit | **SUCCESS** | 555 / 6189 / **6744** | 48.0s | ✅ | list_dir:3, view_file:6, run_command:8, send_message:1 |
| task-011 | ambiguity-duplicate | commit | **SUCCESS** | 310 / 11408 / **11718** | 73.0s | ✅ | view_file:12, run_command:10, list_dir:7, send_message:1 |
| task-016 | user-change-post-read | reject | **SAFE_REJECT** | 425 / 4139 / **4564** | 57.0s | ✅ | view_file:4, run_command:7, list_dir:2, send_message:3 |
| task-026 | expired-anchor | commit_after_retry | **SUCCESS** | 335 / 4542 / **4877** | 40.0s | ✅ | view_file:3, run_command:12, send_message:1 |
| task-029 | node-relocation | commit | **SUCCESS** | 298 / 5335 / **5633** | 52.0s | ✅ | view_file:5, run_command:10, list_dir:2, send_message:1 |
| task-034 | auto-recovery | commit_after_retry | **SUCCESS** | 731 / 5932 / **6663** | 56.0s | ✅ | view_file:5, run_command:10, manage_task:1, grep_search:1, send_message:2 |

