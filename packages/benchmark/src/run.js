import * as fs from 'fs';
import * as path from 'path';
import { parseMarkdownToNodes, buildLogicalSections } from '@md-safeedit/markdown';
import { runFullFileRewrite, runExactStringReplace, runUnifiedDiff, runLineHashPatch, runMDSafeEdit } from './baselines.js';
const TASKS_DIR = path.join(process.cwd(), 'packages/benchmark/tasks');
const TEMP_DIR = path.join(process.cwd(), 'packages/benchmark/temp');
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}
async function runBenchmark() {
    if (!fs.existsSync(TASKS_DIR)) {
        console.error('Tasks directory not found. Please run task generator first.');
        process.exit(1);
    }
    const taskDirs = fs.readdirSync(TASKS_DIR).filter(d => d.startsWith('task-')).sort();
    console.log(`Found ${taskDirs.length} tasks. Running benchmark...`);
    const results = [];
    for (const dirName of taskDirs) {
        const taskDir = path.join(TASKS_DIR, dirName);
        const initialContent = fs.readFileSync(path.join(taskDir, 'initial.md'), 'utf-8');
        const currentContent = fs.readFileSync(path.join(taskDir, 'current.md'), 'utf-8');
        const expectedContent = fs.readFileSync(path.join(taskDir, 'expected.md'), 'utf-8');
        const metadata = JSON.parse(fs.readFileSync(path.join(taskDir, 'metadata.json'), 'utf-8'));
        const assertions = JSON.parse(fs.readFileSync(path.join(taskDir, 'assertions.json'), 'utf-8'));
        // Find the target node in initialContent to get range, content, path, blockId
        const bytesInitial = new TextEncoder().encode(initialContent);
        const parsedInitial = parseMarkdownToNodes(bytesInitial, initialContent);
        const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, initialContent);
        const typedNodes = nodesInitial.filter(n => n.type === assertions.targetNodeType);
        const targetNode = typedNodes[assertions.targetIndex];
        if (!targetNode) {
            console.warn(`Warning: Target node not found for ${dirName}. Skipping.`);
            continue;
        }
        const taskResult = {
            id: dirName,
            category: metadata.category,
            expectedOutcome: metadata.expected_outcome,
            baselines: {}
        };
        const strategies = ['B1_FullRewrite', 'B2_StringReplace', 'B3_UnifiedDiff', 'B4_LineHash', 'B5_MDSafeEdit'];
        for (const strat of strategies) {
            const tempPath = path.join(TEMP_DIR, `${dirName}-${strat}.md`);
            fs.writeFileSync(tempPath, currentContent);
            let res;
            try {
                if (strat === 'B1_FullRewrite') {
                    res = runFullFileRewrite(tempPath, initialContent, targetNode.range, assertions.replacementContent);
                }
                else if (strat === 'B2_StringReplace') {
                    res = runExactStringReplace(tempPath, targetNode.content, assertions.replacementContent);
                }
                else if (strat === 'B3_UnifiedDiff') {
                    res = runUnifiedDiff(tempPath, initialContent, targetNode.range, assertions.replacementContent);
                }
                else if (strat === 'B4_LineHash') {
                    res = runLineHashPatch(tempPath, initialContent, targetNode.range, assertions.replacementContent);
                }
                else {
                    // B5_MDSafeEdit
                    // Find target's runtimeId in the initial content
                    const bytesTemp = new TextEncoder().encode(initialContent);
                    const parsedTemp = parseMarkdownToNodes(bytesTemp, initialContent);
                    const nodesTemp = buildLogicalSections(parsedTemp, bytesTemp, initialContent);
                    const targetTemp = nodesTemp.filter(n => n.type === assertions.targetNodeType)[assertions.targetIndex];
                    res = runMDSafeEdit(tempPath, initialContent, currentContent, targetTemp.runtimeId, assertions.replacementContent, [TEMP_DIR]);
                }
            }
            catch (err) {
                res = { ok: false, error: err.message || 'RUNTIME_ERROR' };
            }
            // Check correctness
            let correct = false;
            if (res.ok) {
                const finalContent = fs.readFileSync(tempPath, 'utf-8');
                correct = (finalContent === expectedContent);
            }
            // Determine outcome classification
            let outcome;
            if (metadata.expected_outcome === 'commit') {
                if (res.ok && correct) {
                    outcome = 'success';
                }
                else if (res.ok && !correct) {
                    outcome = 'wrong_target';
                }
                else {
                    outcome = 'false_reject';
                }
            }
            else { // expected_outcome === 'reject'
                if (res.ok) {
                    outcome = 'false_accept'; // Unsafe edit committed
                }
                else {
                    outcome = 'safe_reject';
                }
            }
            taskResult.baselines[strat] = {
                ok: res.ok,
                correct,
                error: res.error,
                outcome
            };
            try {
                if (fs.existsSync(tempPath))
                    fs.unlinkSync(tempPath);
            }
            catch { }
        }
        results.push(taskResult);
    }
    // Clean up temp directory
    try {
        fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
    catch { }
    // Generate Report
    generateReport(results);
}
function generateReport(results) {
    const total = results.length;
    const strategies = ['B1_FullRewrite', 'B2_StringReplace', 'B3_UnifiedDiff', 'B4_LineHash', 'B5_MDSafeEdit'];
    const stats = {};
    strategies.forEach(s => {
        stats[s] = {
            success: 0,
            false_reject: 0,
            false_accept: 0,
            safe_reject: 0,
            wrong_target: 0
        };
    });
    results.forEach(r => {
        strategies.forEach(s => {
            const outcome = r.baselines[s].outcome;
            stats[s][outcome]++;
        });
    });
    const reportPath = path.join(process.cwd(), 'packages/benchmark/REPORT.md');
    let report = `# MD SafeEdit Benchmark Report\n\n`;
    report += `This report evaluates the safety, correctness, and robustness of **MD SafeEdit** against 4 common baseline strategies across **${total} tasks**.\n\n`;
    report += `## Summary Metrics\n\n`;
    report += `| Strategy | Safe Edit Success Rate (SESR) | False Accept Rate (FAR) | Wrong Target Rate (WTR) | Safe Rejection Rate (SRR) |\n`;
    report += `|---|---|---|---|---|\n`;
    strategies.forEach(s => {
        const sStats = stats[s];
        const totalCommit = results.filter(r => r.expectedOutcome === 'commit').length;
        const totalReject = results.filter(r => r.expectedOutcome === 'reject').length;
        const sesr = ((sStats.success / totalCommit) * 100).toFixed(1) + '%';
        const far = ((sStats.false_accept / totalReject) * 100).toFixed(1) + '%';
        const wtr = ((sStats.wrong_target / totalCommit) * 100).toFixed(1) + '%';
        const srr = ((sStats.safe_reject / totalReject) * 100).toFixed(1) + '%';
        let label = '';
        if (s === 'B1_FullRewrite')
            label = 'B1: Full-File Rewrite';
        else if (s === 'B2_StringReplace')
            label = 'B2: Exact String Replace';
        else if (s === 'B3_UnifiedDiff')
            label = 'B3: Unified Diff';
        else if (s === 'B4_LineHash')
            label = 'B4: Line-Hash Patch';
        else
            label = 'B5: MD SafeEdit (Ours)';
        report += `| **${label}** | ${sesr} | **${far}** | ${wtr} | ${srr} |\n`;
    });
    report += `\n`;
    report += `> [!IMPORTANT]\n`;
    report += `> **False Accept Rate (FAR)** represents the percentage of unsafe concurrent modification tasks where the strategy *incorrectly* allowed the write. Our goal is **0.0%** for MD SafeEdit.\n`;
    report += `> **Safe Edit Success Rate (SESR)** measures the percentage of correct, safe edits successfully relocated and committed.\n\n`;
    report += `## Detailed Task Outcomes\n\n`;
    report += `| Strategy | Success (Commits) | False Rejections | False Accepts (Unsafe) | Safe Rejections | Wrong Target writes |\n`;
    report += `|---|---|---|---|---|---|\n`;
    strategies.forEach(s => {
        const sStats = stats[s];
        let label = '';
        if (s === 'B1_FullRewrite')
            label = 'B1: Full-File Rewrite';
        else if (s === 'B2_StringReplace')
            label = 'B2: Exact String Replace';
        else if (s === 'B3_UnifiedDiff')
            label = 'B3: Unified Diff';
        else if (s === 'B4_LineHash')
            label = 'B4: Line-Hash Patch';
        else
            label = 'B5: MD SafeEdit (Ours)';
        report += `| **${label}** | ${sStats.success} | ${sStats.false_reject} | ${sStats.false_accept} | ${sStats.safe_reject} | ${sStats.wrong_target} |\n`;
    });
    report += `\n## Breakdown by Category\n\n`;
    // Categorized breakdown
    const categories = Array.from(new Set(results.map(r => r.category)));
    categories.forEach(cat => {
        report += `### Category: \`${cat}\`\n\n`;
        report += `| Strategy | Success | False Rejections | False Accepts | Safe Rejections | Wrong Target |\n`;
        report += `|---|---|---|---|---|---|\n`;
        strategies.forEach(s => {
            const catResults = results.filter(r => r.category === cat);
            const catStats = {
                success: catResults.filter(r => r.baselines[s].outcome === 'success').length,
                false_reject: catResults.filter(r => r.baselines[s].outcome === 'false_reject').length,
                false_accept: catResults.filter(r => r.baselines[s].outcome === 'false_accept').length,
                safe_reject: catResults.filter(r => r.baselines[s].outcome === 'safe_reject').length,
                wrong_target: catResults.filter(r => r.baselines[s].outcome === 'wrong_target').length
            };
            let label = '';
            if (s === 'B1_FullRewrite')
                label = 'B1: Full-File Rewrite';
            else if (s === 'B2_StringReplace')
                label = 'B2: Exact String Replace';
            else if (s === 'B3_UnifiedDiff')
                label = 'B3: Unified Diff';
            else if (s === 'B4_LineHash')
                label = 'B4: Line-Hash Patch';
            else
                label = 'B5: MD SafeEdit (Ours)';
            report += `| **${label}** | ${catStats.success} | ${catStats.false_reject} | ${catStats.false_accept} | ${catStats.safe_reject} | ${catStats.wrong_target} |\n`;
        });
        report += `\n`;
    });
    fs.writeFileSync(reportPath, report);
    console.log(`Benchmark completed successfully! Report generated at: ${reportPath}`);
    console.log(report);
}
runBenchmark().catch(err => {
    console.error('Fatal error in benchmark run:', err);
    process.exit(1);
});
//# sourceMappingURL=run.js.map