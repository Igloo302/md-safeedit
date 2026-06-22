import * as fs from 'fs';
import * as path from 'path';

const AGENT_TASKS_DIR = '/Users/jyshen/Projects/md-safeedit/packages/benchmark/tasks/agent-tasks';
const targetTasks = [
  'task-001',
  'task-004',
  'task-007',
  'task-011',
  'task-016',
  'task-026',
  'task-029',
  'task-034'
];

function resetTasks() {
  console.log('🔄 Resetting task files (initial.md -> current.md)...');
  for (const task of targetTasks) {
    const taskDir = path.join(AGENT_TASKS_DIR, task);
    const initialPath = path.join(taskDir, 'initial.md');
    const currentPath = path.join(taskDir, 'current.md');

    if (!fs.existsSync(initialPath)) {
      console.error(`❌ Error: initial.md not found for ${task}`);
      continue;
    }

    fs.copyFileSync(initialPath, currentPath);
    console.log(`✅ Reset ${task}`);
  }
  console.log('🎉 Reset complete.');
}

resetTasks();
