/**
 * Generates a unified diff between oldStr and newStr.
 */
export function generateUnifiedDiff(oldStr, newStr, filePath) {
    if (oldStr === newStr) {
        return '';
    }
    const oldLines = oldStr.split(/\r?\n/);
    const newLines = newStr.split(/\r?\n/);
    const m = oldLines.length;
    const n = newLines.length;
    // LCS Dynamic Programming
    const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (oldLines[i - 1] === newLines[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            }
            else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    const ops = [];
    let i = m;
    let j = n;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            ops.push({ type: 'same', line: oldLines[i - 1], oldIdx: i - 1, newIdx: j - 1 });
            i--;
            j--;
        }
        else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            ops.push({ type: 'added', line: newLines[j - 1], oldIdx: -1, newIdx: j - 1 });
            j--;
        }
        else {
            ops.push({ type: 'removed', line: oldLines[i - 1], oldIdx: i - 1, newIdx: -1 });
            i--;
        }
    }
    ops.reverse();
    const contextSize = 3;
    let diffText = `--- a/${filePath}\n+++ b/${filePath}\n`;
    for (let k = 0; k < ops.length; k++) {
        const op = ops[k];
        if (op.type !== 'same') {
            const start = Math.max(0, k - contextSize);
            let end = k;
            let consecutiveSames = 0;
            while (end < ops.length) {
                if (ops[end].type === 'same') {
                    consecutiveSames++;
                    if (consecutiveSames > contextSize * 2) {
                        break;
                    }
                }
                else {
                    consecutiveSames = 0;
                }
                end++;
            }
            const hunk = ops.slice(start, end);
            const oldStartOp = hunk.find(o => o.oldIdx !== -1);
            const newStartOp = hunk.find(o => o.newIdx !== -1);
            const oldStartLine = oldStartOp ? oldStartOp.oldIdx + 1 : 1;
            const newStartLine = newStartOp ? newStartOp.newIdx + 1 : 1;
            let oldLen = 0;
            let newLen = 0;
            hunk.forEach(o => {
                if (o.type === 'same') {
                    oldLen++;
                    newLen++;
                }
                else if (o.type === 'removed') {
                    oldLen++;
                }
                else if (o.type === 'added') {
                    newLen++;
                }
            });
            diffText += `@@ -${oldStartLine},${oldLen} +${newStartLine},${newLen} @@\n`;
            hunk.forEach(o => {
                if (o.type === 'same') {
                    diffText += ` ${o.line}\n`;
                }
                else if (o.type === 'removed') {
                    diffText += `-${o.line}\n`;
                }
                else if (o.type === 'added') {
                    diffText += `+${o.line}\n`;
                }
            });
            k = end - 1;
        }
    }
    return diffText;
}
//# sourceMappingURL=diff.js.map