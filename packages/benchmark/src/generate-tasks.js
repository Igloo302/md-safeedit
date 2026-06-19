import * as fs from 'fs';
import * as path from 'path';
const TASKS_DIR = path.join(process.cwd(), 'packages/benchmark/tasks');
if (!fs.existsSync(TASKS_DIR)) {
    fs.mkdirSync(TASKS_DIR, { recursive: true });
}
function writeTask(id, category, initialMd, currentMd, expectedMd, metadata, assertions) {
    const taskDir = path.join(TASKS_DIR, id);
    if (!fs.existsSync(taskDir)) {
        fs.mkdirSync(taskDir, { recursive: true });
    }
    fs.writeFileSync(path.join(taskDir, 'initial.md'), initialMd);
    fs.writeFileSync(path.join(taskDir, 'current.md'), currentMd);
    fs.writeFileSync(path.join(taskDir, 'expected.md'), expectedMd);
    fs.writeFileSync(path.join(taskDir, 'request.txt'), `Perform edit for task ${id}`);
    fs.writeFileSync(path.join(taskDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
    fs.writeFileSync(path.join(taskDir, 'assertions.json'), JSON.stringify(assertions, null, 2));
}
function generateAllTasks() {
    let taskCounter = 1;
    function nextTaskId() {
        return `task-${String(taskCounter++).padStart(3, '0')}`;
    }
    console.log('Generating 200+ benchmark tasks...');
    // ==========================================
    // Family 1: Straightforward local edits (40 tasks)
    // ==========================================
    for (let i = 1; i <= 40; i++) {
        const id = nextTaskId();
        const initialMd = `# Title\n\nThis is paragraph 1.\n\nThis is paragraph 2.\n\n- Item A\n- Item B\n`;
        const replacement = `This is paragraph 2 updated version ${i}.`;
        // We target paragraph 2 (index 1 of type 'paragraph')
        const expectedMd = `# Title\n\nThis is paragraph 1.\n\n${replacement}\n\n- Item A\n- Item B\n`;
        writeTask(id, 'local-edit', initialMd, initialMd, // No concurrent changes
        expectedMd, { category: 'local-edit', expected_outcome: 'commit' }, { targetNodeType: 'paragraph', targetIndex: 1, replacementContent: replacement });
    }
    // ==========================================
    // Family 2: Repetition and ambiguity (40 tasks)
    // ==========================================
    // 20 Ambiguity Rejection Tasks (expected: reject)
    for (let i = 1; i <= 20; i++) {
        const id = nextTaskId();
        const initialMd = `# Section\nDuplicate item\n`;
        const replacement = `Updated item ${i}.`;
        // Prepend preface and duplicate the section, making it completely ambiguous
        const currentMd = `# Preface\nIntro text.\n\n# Section\nDuplicate item\n\n# Section\nDuplicate item\n`;
        writeTask(id, 'ambiguity-reject', initialMd, currentMd, currentMd, // Reject: remains unchanged
        { category: 'ambiguity-reject', expected_outcome: 'reject' }, { targetNodeType: 'paragraph', targetIndex: 0, replacementContent: replacement });
    }
    // 20 Sibling/Parent Disambiguation Tasks (expected: commit)
    for (let i = 1; i <= 20; i++) {
        const id = nextTaskId();
        // Same paragraph text but different heading sections
        const initialMd = `# Section A\nItem text\n\n# Section B\nItem text\n`;
        const replacement = `Updated Item ${i}`;
        // Target paragraph under Section B (index 1 of type 'paragraph')
        const expectedMd = `# Section A\nItem text\n\n# Section B\n${replacement}\n`;
        writeTask(id, 'disambiguation', initialMd, initialMd, expectedMd, { category: 'disambiguation', expected_outcome: 'commit' }, { targetNodeType: 'paragraph', targetIndex: 1, replacementContent: replacement });
    }
    // ==========================================
    // Family 3: Concurrent-change scenarios (60 tasks)
    // ==========================================
    // 20 Target Moved Unchanged Tasks (expected: commit)
    for (let i = 1; i <= 20; i++) {
        const id = nextTaskId();
        const initialMd = `# Title\nThis is paragraph A.\n`;
        const replacement = `This is paragraph A updated ${i}.`;
        // Prepend unrelated text in currentMd
        const currentMd = `# Preface\nIntro text.\n\n# Title\nThis is paragraph A.\n`;
        const expectedMd = `# Preface\nIntro text.\n\n# Title\n${replacement}\n`;
        writeTask(id, 'target-moved', initialMd, currentMd, expectedMd, { category: 'target-moved', expected_outcome: 'commit' }, { targetNodeType: 'paragraph', targetIndex: 0, replacementContent: replacement });
    }
    // 20 Target Changed concurrently Tasks (expected: reject)
    for (let i = 1; i <= 20; i++) {
        const id = nextTaskId();
        const initialMd = `# Title\nThis is paragraph A.\n`;
        const replacement = `This is paragraph A updated ${i}.`;
        // Modify the target itself in currentMd
        const currentMd = `# Title\nThis is paragraph A altered concurrently ${i}.\n`;
        writeTask(id, 'target-changed-reject', initialMd, currentMd, currentMd, // Reject: remains unchanged relative to current state
        { category: 'target-changed-reject', expected_outcome: 'reject' }, { targetNodeType: 'paragraph', targetIndex: 0, replacementContent: replacement });
    }
    // 20 Target Deleted concurrently Tasks (expected: reject)
    for (let i = 1; i <= 20; i++) {
        const id = nextTaskId();
        const initialMd = `# Title\nThis is paragraph A.\n`;
        const replacement = `This is paragraph A updated ${i}.`;
        // Target deleted in currentMd
        const currentMd = `# Title\n`;
        writeTask(id, 'target-deleted-reject', initialMd, currentMd, currentMd, // Reject
        { category: 'target-deleted-reject', expected_outcome: 'reject' }, { targetNodeType: 'paragraph', targetIndex: 0, replacementContent: replacement });
    }
    // ==========================================
    // Family 4: Structural filtering (20 tasks)
    // ==========================================
    for (let i = 1; i <= 20; i++) {
        const id = nextTaskId();
        // Same text in paragraph vs code block
        const initialMd = `# Code Section\n\`\`\`ts\nconst x = 5;\n\`\`\`\n\nconst x = 5;\n`;
        const replacement = `const x = 100;`;
        // Target only the paragraph (index 0 of type 'paragraph')
        const expectedMd = `# Code Section\n\`\`\`ts\nconst x = 5;\n\`\`\`\n\n${replacement}\n`;
        writeTask(id, 'structural-filter', initialMd, initialMd, expectedMd, { category: 'structural-filter', expected_outcome: 'commit' }, { targetNodeType: 'paragraph', targetIndex: 0, replacementContent: replacement });
    }
    // ==========================================
    // Family 5: Syntax, encoding, and Obsidian block IDs (30 tasks)
    // ==========================================
    // 15 CJK/Emoji/BOM/CRLF tasks
    for (let i = 1; i <= 15; i++) {
        const id = nextTaskId();
        // CJK and emoji text
        const initialMd = `# 🚀 标题\n这是段落一 ${i}。\n`;
        const replacement = `这是段落一修改版 ${i} 😂.`;
        const expectedMd = `# 🚀 标题\n${replacement}\n`;
        writeTask(id, 'encoding-syntax', initialMd, initialMd, expectedMd, { category: 'encoding-syntax', expected_outcome: 'commit' }, { targetNodeType: 'paragraph', targetIndex: 0, replacementContent: replacement });
    }
    // 15 Obsidian Block ID relocation tasks (expected: commit)
    for (let i = 1; i <= 15; i++) {
        const id = nextTaskId();
        // Paragraph has block ID
        const initialMd = `# Section A\nItem X ^my-block-${i}\n`;
        const replacement = `Item X updated ${i} ^my-block-${i}`;
        // CurrentMd moves it to Section B and adds an ambiguous duplicate Item X without block ID
        const currentMd = `# Section B\nItem X ^my-block-${i}\n\n# Section A\nItem X\n`;
        const expectedMd = `# Section B\n${replacement}\n\n# Section A\nItem X\n`;
        writeTask(id, 'obsidian-block-id', initialMd, currentMd, expectedMd, { category: 'obsidian-block-id', expected_outcome: 'commit' }, { targetNodeType: 'paragraph', targetIndex: 0, replacementContent: replacement });
    }
    // ==========================================
    // Family 6: Transactions (10 tasks)
    // ==========================================
    for (let i = 1; i <= 10; i++) {
        const id = nextTaskId();
        const initialMd = `# Hardware\n## Battery\nThis is paragraph A.\n- Item A\n`;
        const replacement = `This is paragraph A updated ${i}.`;
        const expectedMd = `# Hardware\n## Battery\n${replacement}\n- Item A\n`;
        writeTask(id, 'transaction-batch', initialMd, initialMd, expectedMd, { category: 'transaction-batch', expected_outcome: 'commit' }, { targetNodeType: 'paragraph', targetIndex: 0, replacementContent: replacement });
    }
    console.log(`Successfully generated ${taskCounter - 1} tasks!`);
}
generateAllTasks();
//# sourceMappingURL=generate-tasks.js.map