import * as fs from 'fs';
import * as path from 'path';

const AGENT_TASKS_DIR = path.join(process.cwd(), 'packages/benchmark/tasks/agent-tasks');

if (!fs.existsSync(AGENT_TASKS_DIR)) {
  fs.mkdirSync(AGENT_TASKS_DIR, { recursive: true });
}

function writeTask(
  id: string,
  category: string,
  initialMd: string,
  currentMd: string,
  expectedMd: string,
  metadata: any
) {
  const taskDir = path.join(AGENT_TASKS_DIR, id);
  if (!fs.existsSync(taskDir)) {
    fs.mkdirSync(taskDir, { recursive: true });
  }

  fs.writeFileSync(path.join(taskDir, 'initial.md'), initialMd);
  fs.writeFileSync(path.join(taskDir, 'current.md'), currentMd);
  fs.writeFileSync(path.join(taskDir, 'expected.md'), expectedMd);
  fs.writeFileSync(path.join(taskDir, 'metadata.json'), JSON.stringify({
    id,
    category,
    ...metadata
  }, null, 2));
}

function generateAgentTasks() {
  console.log('Generating 35 agent testing tasks...');

  // ==========================================
  // Category A: Standard Edits (10 tasks, task-001 to task-010)
  // ==========================================
  
  // task-001: Modify paragraph
  writeTask(
    'task-001',
    'standard-edit',
    `# Section 1\nThis is paragraph A.\n\nThis is paragraph B.\n`,
    `# Section 1\nThis is paragraph A.\n\nThis is paragraph B.\n`,
    `# Section 1\nThis is paragraph A.\n\nThis is paragraph B modified.\n`,
    {
      prompt: 'Modify paragraph B to say: This is paragraph B modified.',
      target_type: 'paragraph',
      expected_outcome: 'commit'
    }
  );

  // task-002: Delete paragraph
  writeTask(
    'task-002',
    'standard-edit',
    `# Section 1\nThis is paragraph A.\n\nThis is paragraph B.\n`,
    `# Section 1\nThis is paragraph A.\n\nThis is paragraph B.\n`,
    `# Section 1\nThis is paragraph A.\n`,
    {
      prompt: 'Delete the paragraph containing: This is paragraph B.',
      target_type: 'paragraph',
      expected_outcome: 'commit'
    }
  );

  // task-003: Insert paragraph after
  writeTask(
    'task-003',
    'standard-edit',
    `# Section 1\nThis is paragraph A.\n`,
    `# Section 1\nThis is paragraph A.\n`,
    `# Section 1\nThis is paragraph A.\n\nThis is paragraph B inserted.\n`,
    {
      prompt: 'Insert a new paragraph after paragraph A saying: This is paragraph B inserted.',
      target_type: 'paragraph',
      expected_outcome: 'commit'
    }
  );

  // task-004: Modify bullet list item
  writeTask(
    'task-004',
    'standard-edit',
    `# Todo List\n- Buy milk\n- Buy eggs\n- Call gym\n`,
    `# Todo List\n- Buy milk\n- Buy eggs\n- Call gym\n`,
    `# Todo List\n- Buy milk\n- Buy fresh eggs\n- Call gym\n`,
    {
      prompt: 'Modify the list item "Buy eggs" to say: Buy fresh eggs',
      target_type: 'list_item',
      expected_outcome: 'commit'
    }
  );

  // task-005: Delete list item
  writeTask(
    'task-005',
    'standard-edit',
    `# Todo List\n- Buy milk\n- Buy eggs\n`,
    `# Todo List\n- Buy milk\n- Buy eggs\n`,
    `# Todo List\n- Buy eggs\n`,
    {
      prompt: 'Delete the list item "Buy milk".',
      target_type: 'list_item',
      expected_outcome: 'commit'
    }
  );

  // task-006: Insert list item before
  writeTask(
    'task-006',
    'standard-edit',
    `# Todo List\n- Buy eggs\n`,
    `# Todo List\n- Buy eggs\n`,
    `# Todo List\n- Buy milk\n- Buy eggs\n`,
    {
      prompt: 'Insert a list item "Buy milk" before "Buy eggs".',
      target_type: 'list_item',
      expected_outcome: 'commit'
    }
  );

  // task-007: Modify table row cell
  writeTask(
    'task-007',
    'standard-edit',
    `# Inventory\n| Item | Qty |\n|---|---|\n| Apple | 10 |\n| Banana | 5 |\n`,
    `# Inventory\n| Item | Qty |\n|---|---|\n| Apple | 10 |\n| Banana | 5 |\n`,
    `# Inventory\n| Item | Qty |\n|---|---|\n| Apple | 12 |\n| Banana | 5 |\n`,
    {
      prompt: 'Modify the table row for Apple to set Qty to 12.',
      target_type: 'table_row',
      expected_outcome: 'commit'
    }
  );

  // task-008: Delete table row
  writeTask(
    'task-008',
    'standard-edit',
    `# Inventory\n| Item | Qty |\n|---|---|\n| Apple | 10 |\n| Banana | 5 |\n`,
    `# Inventory\n| Item | Qty |\n|---|---|\n| Apple | 10 |\n| Banana | 5 |\n`,
    `# Inventory\n| Item | Qty |\n|---|---|\n| Banana | 5 |\n`,
    {
      prompt: 'Delete the table row for Apple.',
      target_type: 'table_row',
      expected_outcome: 'commit'
    }
  );

  // task-009: Insert table row
  writeTask(
    'task-009',
    'standard-edit',
    `# Inventory\n| Item | Qty |\n|---|---|\n| Apple | 10 |\n`,
    `# Inventory\n| Item | Qty |\n|---|---|\n| Apple | 10 |\n`,
    `# Inventory\n| Item | Qty |\n|---|---|\n| Apple | 10 |\n| Banana | 5 |\n`,
    {
      prompt: 'Insert a new table row for Banana with Qty 5 after Apple.',
      target_type: 'table_row',
      expected_outcome: 'commit'
    }
  );

  // task-010: Modify fenced code block
  writeTask(
    'task-010',
    'standard-edit',
    `# Source Code\n\`\`\`javascript\nconst a = 1;\n\`\`\`\n`,
    `# Source Code\n\`\`\`javascript\nconst a = 1;\n\`\`\`\n`,
    `# Source Code\n\`\`\`javascript\nconst a = 2;\n\`\`\`\n`,
    {
      prompt: 'Modify the code block to set a = 2.',
      target_type: 'fenced_code',
      expected_outcome: 'commit'
    }
  );

  // ==========================================
  // Category B: Ambiguity & Duplicates (5 tasks, task-011 to task-015)
  // ==========================================

  // task-011: Duplicate headers
  writeTask(
    'task-011',
    'ambiguity-duplicate',
    `# Section\nContent A\n\n# Section\nContent B\n`,
    `# Section\nContent A\n\n# Section\nContent B\n`,
    `# Section\nContent A\n\n# Section\nContent B modified\n`,
    {
      prompt: 'Modify the paragraph under the second "# Section" header to say: Content B modified',
      target_type: 'paragraph',
      expected_outcome: 'commit'
    }
  );

  // task-012: Duplicate list items
  writeTask(
    'task-012',
    'ambiguity-duplicate',
    `# List\n- Duplicate item\n- Unique item\n- Duplicate item\n`,
    `# List\n- Duplicate item\n- Unique item\n- Duplicate item\n`,
    `# List\n- Duplicate item\n- Unique item\n- Duplicate item modified\n`,
    {
      prompt: 'Modify the second "Duplicate item" list item to say: Duplicate item modified (Ensure you modify the second one, not the first).',
      target_type: 'list_item',
      expected_outcome: 'commit'
    }
  );

  // task-013: Duplicate table rows
  writeTask(
    'task-013',
    'ambiguity-duplicate',
    `# Sales\n| Year | Sale |\n|---|---|\n| 2025 | 100 |\n| 2025 | 100 |\n`,
    `# Sales\n| Year | Sale |\n|---|---|\n| 2025 | 100 |\n| 2025 | 100 |\n`,
    `# Sales\n| Year | Sale |\n|---|---|\n| 2025 | 100 |\n| 2025 | 120 |\n`,
    {
      prompt: 'Modify the second row containing "2025 | 100" to set Sale to 120.',
      target_type: 'table_row',
      expected_outcome: 'commit'
    }
  );

  // task-014: Duplicate paragraph content under different headers
  writeTask(
    'task-014',
    'ambiguity-duplicate',
    `# Section A\nThis text is duplicate.\n\n# Section B\nThis text is duplicate.\n`,
    `# Section A\nThis text is duplicate.\n\n# Section B\nThis text is duplicate.\n`,
    `# Section A\nThis text is duplicate.\n\n# Section B\nThis text is duplicate modified.\n`,
    {
      prompt: 'Modify the paragraph under Section B to say: This text is duplicate modified.',
      target_type: 'paragraph',
      expected_outcome: 'commit'
    }
  );

  // task-015: Nested duplicate sections
  writeTask(
    'task-015',
    'ambiguity-duplicate',
    `# Parent\n## Duplicate\nContent A\n# Parent B\n## Duplicate\nContent B\n`,
    `# Parent\n## Duplicate\nContent A\n# Parent B\n## Duplicate\nContent B\n`,
    `# Parent\n## Duplicate\nContent A\n# Parent B\n## Duplicate\nContent B modified\n`,
    {
      prompt: 'Modify the paragraph "Content B" under Parent B > Duplicate to say: Content B modified',
      target_type: 'paragraph',
      expected_outcome: 'commit'
    }
  );

  // ==========================================
  // Category C: User Change Post-Read (5 tasks, task-016 to task-020)
  // ==========================================

  // task-016: User modifies target paragraph
  writeTask(
    'task-016',
    'user-change-post-read',
    `# Title\nThis is paragraph A.\n`,
    `# Title\nThis is paragraph A.\n`,
    `# Title\nThis is paragraph A modified concurrently by user.\n`, // Expected reject state
    {
      prompt: 'Update paragraph A to say: This is paragraph A updated. Note: You must check in with the coordinator by messaging "I have read the node." after reading the node but before patching it.',
      target_type: 'paragraph',
      expected_outcome: 'reject',
      simulate_user_change: {
        change_type: 'modify_target',
        new_content: '# Title\nThis is paragraph A modified concurrently by user.\n'
      }
    }
  );

  // task-017: User deletes target list item
  writeTask(
    'task-017',
    'user-change-post-read',
    `# List\n- Item A\n- Item B\n`,
    `# List\n- Item A\n- Item B\n`,
    `# List\n- Item A\n`, // Expected reject state
    {
      prompt: 'Update Item B to say: Item B updated. Note: Message "I have read the node." after reading B.',
      target_type: 'list_item',
      expected_outcome: 'reject',
      simulate_user_change: {
        change_type: 'modify_target',
        new_content: '# List\n- Item A\n' // Item B deleted
      }
    }
  );

  // task-018: User modifies surrounding section heading
  writeTask(
    'task-018',
    'user-change-post-read',
    `# Section A\nThis is paragraph A.\n`,
    `# Section A\nThis is paragraph A.\n`,
    `# Section B\nThis is paragraph A.\n`, // Expected reject state
    {
      prompt: 'Update paragraph A to say: Paragraph A updated. Note: Message "I have read the node." after reading.',
      target_type: 'paragraph',
      expected_outcome: 'reject',
      simulate_user_change: {
        change_type: 'modify_target',
        new_content: '# Section B\nThis is paragraph A.\n' // Heading changed
      }
    }
  );

  // task-019: User appends concurrent paragraph
  writeTask(
    'task-019',
    'user-change-post-read',
    `# Title\nThis is paragraph A.\n`,
    `# Title\nThis is paragraph A.\n`,
    `# Title\nThis is paragraph A.\n\nThis is paragraph B added by user.\n`, // Expected reject state
    {
      prompt: 'Update paragraph A to say: Paragraph A updated. Note: Message "I have read the node." after reading.',
      target_type: 'paragraph',
      expected_outcome: 'reject',
      simulate_user_change: {
        change_type: 'modify_target',
        new_content: '# Title\nThis is paragraph A.\n\nThis is paragraph B added by user.\n'
      }
    }
  );

  // task-020: User shifts paragraph target by prepending content
  writeTask(
    'task-020',
    'user-change-post-read',
    `# Title\nThis is paragraph A.\n`,
    `# Title\nThis is paragraph A.\n`,
    `# Preface\nIntro text.\n\n# Title\nThis is paragraph A.\n`, // Expected reject state
    {
      prompt: 'Update paragraph A to say: Paragraph A updated. Note: Message "I have read the node." after reading.',
      target_type: 'paragraph',
      expected_outcome: 'reject',
      simulate_user_change: {
        change_type: 'modify_target',
        new_content: `# Preface\nIntro text.\n\n# Title\nThis is paragraph A.\n`
      }
    }
  );

  // ==========================================
  // Category D: Concurrent Agent Edits (5 tasks, task-021 to task-025)
  // ==========================================
  // In these tasks, we will simulate concurrent edit race conditions.

  // task-021: Two agents update same paragraph
  writeTask(
    'task-021',
    'concurrent-agents',
    `# Title\nParagraph A\n`,
    `# Title\nParagraph A\n`,
    `# Title\nParagraph A updated by Agent X.\n`, // Expected reject state
    {
      prompt: 'Update Paragraph A. Message "I have read the node." after reading.',
      target_type: 'paragraph',
      expected_outcome: 'reject',
      simulate_user_change: {
        change_type: 'concurrent_agent_commit',
        new_content: '# Title\nParagraph A updated by Agent X.\n'
      }
    }
  );

  // task-022: Two agents modify different items in same list
  writeTask(
    'task-022',
    'concurrent-agents',
    `# List\n- Item A\n- Item B\n`,
    `# List\n- Item A\n- Item B\n`,
    `# List\n- Item A updated by Agent X\n- Item B\n`, // Expected reject state
    {
      prompt: 'Update Item B to say: Item B updated. Message "I have read the node." after reading.',
      target_type: 'list_item',
      expected_outcome: 'reject',
      simulate_user_change: {
        change_type: 'concurrent_agent_commit',
        new_content: '# List\n- Item A updated by Agent X\n- Item B\n'
      }
    }
  );

  // task-023: Two agents edit different table cells
  writeTask(
    'task-023',
    'concurrent-agents',
    `| Item | Price |\n|---|---|\n| Apple | 1 |\n| Banana | 2 |\n`,
    `| Item | Price |\n|---|---|\n| Apple | 1 |\n| Banana | 2 |\n`,
    `| Item | Price |\n|---|---|\n| Apple | 1.5 |\n| Banana | 2 |\n`, // Expected reject state
    {
      prompt: 'Modify Banana price to 2.5. Message "I have read the node." after reading.',
      target_type: 'table_row',
      expected_outcome: 'reject',
      simulate_user_change: {
        change_type: 'concurrent_agent_commit',
        new_content: `| Item | Price |\n|---|---|\n| Apple | 1.5 |\n| Banana | 2 |\n`
      }
    }
  );

  // task-024: Two agents edit overlapping headers
  writeTask(
    'task-024',
    'concurrent-agents',
    `# Header\nParagraph\n`,
    `# Header\nParagraph\n`,
    `# Header modified\nParagraph\n`, // Expected reject state
    {
      prompt: 'Modify Paragraph. Message "I have read the node." after reading.',
      target_type: 'paragraph',
      expected_outcome: 'reject',
      simulate_user_change: {
        change_type: 'concurrent_agent_commit',
        new_content: `# Header modified\nParagraph\n`
      }
    }
  );

  // task-025: Two agents insert at same offset
  writeTask(
    'task-025',
    'concurrent-agents',
    `# Title\nParagraph\n`,
    `# Title\nParagraph\n`,
    `# Title\nParagraph\n\nInserted by Agent X\n`, // Expected reject state
    {
      prompt: 'Insert "Inserted by Agent Y" after Paragraph. Message "I have read the node." after reading.',
      target_type: 'paragraph',
      expected_outcome: 'reject',
      simulate_user_change: {
        change_type: 'concurrent_agent_commit',
        new_content: `# Title\nParagraph\n\nInserted by Agent X\n`
      }
    }
  );

  // ==========================================
  // Category E: Expired Anchor (3 tasks, task-026 to task-028)
  // ==========================================

  // task-026: Paragraph expired
  writeTask(
    'task-026',
    'expired-anchor',
    `# Title\nParagraph A\n`,
    `# Title\nParagraph A\n`,
    `# Title\nParagraph A updated.\n`, // Expected matches prompt period
    {
      prompt: 'Modify Paragraph A to say: Paragraph A updated. Note: The environment has extremely short token expiration, so expect anchor expiration and recover.',
      target_type: 'paragraph',
      expected_outcome: 'commit_after_retry',
      force_expiry_ms: 10
    }
  );

  // task-027: List item expired
  writeTask(
    'task-027',
    'expired-anchor',
    `# Todo\n- Item A\n`,
    `# Todo\n- Item A\n`,
    `# Todo\n- Item A updated.\n`, // Expected matches prompt period
    {
      prompt: 'Modify Item A to say: Item A updated.',
      target_type: 'list_item',
      expected_outcome: 'commit_after_retry',
      force_expiry_ms: 10
    }
  );

  // task-028: Table row expired
  writeTask(
    'task-028',
    'expired-anchor',
    `| A | B |\n|---|---|\n| 1 | 2 |\n`,
    `| A | B |\n|---|---|\n| 1 | 2 |\n`,
    `| A | B |\n|---|---|\n| 3 | 2 |\n`,
    {
      prompt: 'Modify the table row for "1 | 2" to say "3 | 2".',
      target_type: 'table_row',
      expected_outcome: 'commit_after_retry',
      force_expiry_ms: 10
    }
  );

  // ==========================================
  // Category F: Node Relocation & Deletion (5 tasks, task-029 to task-033)
  // ==========================================

  // task-029: Paragraph moved to top of file
  writeTask(
    'task-029',
    'node-relocation',
    `# Section 1\nSome paragraph.\n\n# Section 2\nTarget paragraph.\n`,
    `# Section 2\nTarget paragraph.\n\n# Section 1\nSome paragraph.\n`,
    `# Section 2\nTarget paragraph updated.\n\n# Section 1\nSome paragraph.\n`,
    {
      prompt: 'Modify Target paragraph to say: Target paragraph updated.',
      target_type: 'paragraph',
      expected_outcome: 'commit'
    }
  );

  // task-030: Sibling list items shuffled
  writeTask(
    'task-030',
    'node-relocation',
    `# List\n- Item A\n- Item B\n- Item C\n`,
    `# List\n- Item C\n- Item A\n- Item B\n`,
    `# List\n- Item C\n- Item A\n- Item B updated\n`,
    {
      prompt: 'Modify Item B to say: Item B updated',
      target_type: 'list_item',
      expected_outcome: 'commit'
    }
  );

  // task-031: Heading renamed but content remains
  writeTask(
    'task-031',
    'node-relocation',
    `# Original Header\nParagraph text.\n`,
    `# Renamed Header\nParagraph text.\n`,
    `# Renamed Header\nParagraph text updated.\n`,
    {
      prompt: 'Modify Paragraph text to say: Paragraph text updated.',
      target_type: 'paragraph',
      expected_outcome: 'commit'
    }
  );

  // task-032: Sibling paragraph deleted
  writeTask(
    'task-032',
    'node-relocation',
    `# Section\nParagraph 1\n\nParagraph 2\n\nParagraph 3\n`,
    `# Section\nParagraph 1\n\nParagraph 3\n`,
    `# Section\nParagraph 1\n\nParagraph 3 updated\n`,
    {
      prompt: 'Modify Paragraph 3 to say: Paragraph 3 updated',
      target_type: 'paragraph',
      expected_outcome: 'commit'
    }
  );

  // task-033: Table row relocated due to sort
  writeTask(
    'task-033',
    'node-relocation',
    `| Item | Price |\n|---|---|\n| Apple | 1 |\n| Banana | 2 |\n`,
    `| Item | Price |\n|---|---|\n| Banana | 2 |\n| Apple | 1 |\n`,
    `| Item | Price |\n|---|---|\n| Banana | 2 |\n| Apple | 1.5 |\n`,
    {
      prompt: 'Modify Apple price to 1.5.',
      target_type: 'table_row',
      expected_outcome: 'commit'
    }
  );

  // ==========================================
  // Category G: Conflict Auto-Recovery (2 tasks, task-034 to task-035)
  // ==========================================

  // task-034: Auto recovery on concurrent edit of list item
  writeTask(
    'task-034',
    'auto-recovery',
    `# List\n- Item A\n- Item B\n`,
    `# List\n- Item A\n- Item B\n`,
    `# List\n- Item A updated by User\n- Item B modified\n`, // Expected final state
    {
      prompt: 'Update Item B to say: Item B modified. Note: Message "I have read the node." after reading. If you hit TARGET_CHANGED, do not bypass or rewrite the file. Obtain a fresh token and retry.',
      target_type: 'list_item',
      expected_outcome: 'commit_after_retry',
      simulate_user_change: {
        change_type: 'concurrent_agent_commit',
        new_content: '# List\n- Item A updated by User\n- Item B\n'
      }
    }
  );

  // task-035: Auto recovery on concurrent paragraph modification
  writeTask(
    'task-035',
    'auto-recovery',
    `# Title\nParagraph A\n\nParagraph B\n`,
    `# Title\nParagraph A\n\nParagraph B\n`,
    `# Title\nParagraph A updated by User\n\nParagraph B modified.\n`, // Expected matches prompt period
    {
      prompt: 'Modify Paragraph B to say: Paragraph B modified. Note: Message "I have read the node." after reading.',
      target_type: 'paragraph',
      expected_outcome: 'commit_after_retry',
      simulate_user_change: {
        change_type: 'concurrent_agent_commit',
        new_content: '# Title\nParagraph A updated by User\n\nParagraph B\n'
      }
    }
  );

  console.log('Successfully generated 35 agent tasks!');
}

generateAgentTasks();
