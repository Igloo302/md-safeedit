import * as fs from 'fs';
import * as path from 'path';
import { inspectService, searchService, readService, patchService } from '@md-safeedit/cli/services.js';
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) {
    console.error('Error: GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required to run the evaluation.');
    process.exit(1);
}
const allowedRoots = [path.join(process.cwd(), 'packages/benchmark/tasks')];
// Gemini Function Declarations
const functionDeclarations = [
    {
        name: 'inspect',
        description: 'Inspect a Markdown file outline, dialect, line endings, size, and revision.',
        parameters: {
            type: 'OBJECT',
            properties: {
                file: {
                    type: 'OBJECT',
                    properties: {
                        path: { type: 'STRING', description: 'Path to the target Markdown file.' }
                    },
                    required: ['path']
                },
                options: {
                    type: 'OBJECT',
                    properties: {
                        max_depth: { type: 'NUMBER', description: 'Max heading outline depth.' },
                        include_counts: { type: 'BOOLEAN', description: 'Whether to count child nodes.' }
                    }
                }
            },
            required: ['file']
        }
    },
    {
        name: 'search',
        description: 'Search for text patterns inside a Markdown file, scoped by structural nodes or heading paths.',
        parameters: {
            type: 'OBJECT',
            properties: {
                file: {
                    type: 'OBJECT',
                    properties: {
                        path: { type: 'STRING', description: 'Path to the target Markdown file.' }
                    },
                    required: ['path']
                },
                query: { type: 'STRING', description: 'Text phrase to search for.' },
                filters: {
                    type: 'OBJECT',
                    properties: {
                        include_types: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Include only these node types.' }
                    }
                }
            },
            required: ['file', 'query']
        }
    },
    {
        name: 'read',
        description: 'Read contents of specified nodes and acquire signed anchor tokens for mutation.',
        parameters: {
            type: 'OBJECT',
            properties: {
                file: {
                    type: 'OBJECT',
                    properties: {
                        path: { type: 'STRING', description: 'Path to the target Markdown file.' }
                    },
                    required: ['path']
                },
                targets: {
                    type: 'ARRAY',
                    items: {
                        type: 'OBJECT',
                        properties: {
                            runtime_id: { type: 'STRING', description: 'Node runtime ID.' }
                        },
                        required: ['runtime_id']
                    }
                }
            },
            required: ['file', 'targets']
        }
    },
    {
        name: 'patch',
        description: 'Safely edit node contents using issued anchor tokens. Supports atomic execution and dry runs.',
        parameters: {
            type: 'OBJECT',
            properties: {
                file: {
                    type: 'OBJECT',
                    properties: {
                        path: { type: 'STRING', description: 'Path to the target Markdown file.' }
                    },
                    required: ['path']
                },
                operations: {
                    type: 'ARRAY',
                    items: {
                        type: 'OBJECT',
                        properties: {
                            op: { type: 'STRING', enum: ['replace', 'delete', 'insert_before', 'insert_after'] },
                            anchor_token: { type: 'STRING', description: 'Signed anchor token for the node.' },
                            content: { type: 'STRING', description: 'New replacement content.' }
                        },
                        required: ['op', 'anchor_token']
                    }
                },
                options: {
                    type: 'OBJECT',
                    properties: {
                        dry_run: { type: 'BOOLEAN', description: 'Whether to preview the diff (dry_run: true) or commit (dry_run: false).' }
                    }
                }
            },
            required: ['file', 'operations']
        }
    }
];
/**
 * Executes a tool locally and returns the result.
 */
function executeTool(name, args) {
    console.log(`[TOOL CALL] executing "${name}" with args:`, JSON.stringify(args, null, 2));
    try {
        switch (name) {
            case 'inspect':
                return inspectService(args, allowedRoots);
            case 'search':
                return searchService(args, allowedRoots);
            case 'read':
                return readService(args, allowedRoots);
            case 'patch':
                return patchService(args, allowedRoots);
            default:
                return { ok: false, error: { code: 'UNSUPPORTED_SYNTAX', message: `Unknown tool "${name}"` } };
        }
    }
    catch (err) {
        return { ok: false, error: { code: 'IO_ERROR', message: err.message || 'Execution error' } };
    }
}
/**
 * Runs the model-in-the-loop chat session for a task.
 */
async function runTaskSession(taskId, targetFile, promptText) {
    console.log(`\n==================================================`);
    console.log(`Evaluating Task: ${taskId}`);
    console.log(`Prompt: "${promptText}"`);
    console.log(`==================================================`);
    const taskPath = path.join(process.cwd(), 'packages/benchmark/tasks', taskId, targetFile);
    const messages = [
        {
            role: 'user',
            parts: [
                {
                    text: `You are an AI coding assistant. You need to edit the document located at: "${taskPath}".
Please perform the following edit: "${promptText}"

You must follow the safe editing protocol:
1. First, call the 'inspect' or 'search' tool to locate the node you want to modify.
2. Call the 'read' tool to get the contents and the signed 'anchor_token' for the node.
3. Call the 'patch' tool with the 'anchor_token' to apply the modification. Set options.dry_run = false to commit.
4. If you hit any conflict error (e.g. TARGET_CHANGED), do not write or force-overwrite. Stop immediately and report the error code.

CRITICAL: When calling the 'patch' tool, you MUST copy the 'anchor_token' from the 'read' tool output EXACTLY, character-for-character, without making any modifications, typos, or character substitutions. Even a single character difference will cause a validation failure.

Always output tool calls. Do not try to guess ranges or perform bare text replacement.`
                }
            ]
        }
    ];
    let loopCount = 0;
    const maxLoops = 10;
    while (loopCount < maxLoops) {
        loopCount++;
        // Wait 15 seconds before each API call to avoid exceeding the Gemini API free tier rate limit of 5 requests per minute
        await new Promise(resolve => setTimeout(resolve, 15000));
        // Make request to Gemini REST API
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: messages,
                tools: [{ functionDeclarations }]
            })
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini API Error (${response.status}): ${errText}`);
        }
        const resJson = await response.json();
        const candidate = resJson.candidates?.[0];
        const modelContent = candidate?.content;
        if (!modelContent) {
            console.log('No response content from model.');
            break;
        }
        // Add model message to history
        messages.push(modelContent);
        const parts = modelContent.parts || [];
        let hasFunctionCall = false;
        const functionResponses = [];
        for (const part of parts) {
            if (part.text) {
                console.log(`[MODEL RESPONSE] ${part.text}`);
            }
            if (part.functionCall) {
                hasFunctionCall = true;
                const call = part.functionCall;
                const toolResult = executeTool(call.name, call.args);
                console.log(`[TOOL OUTPUT] ok: ${toolResult.ok}, status: ${toolResult.status || 'N/A'}, error: ${toolResult.error?.code || 'none'}`);
                functionResponses.push({
                    functionResponse: {
                        name: call.name,
                        response: {
                            output: toolResult
                        }
                    }
                });
            }
        }
        if (!hasFunctionCall) {
            console.log('[AGENT WORKFLOW COMPLETED]');
            break;
        }
        // Append function response message
        messages.push({
            role: 'function',
            parts: functionResponses
        });
    }
}
async function main() {
    try {
        // Task 1: Safe local edit on task-001 (paragraph 2 update)
        // We overwrite packages/benchmark/tasks/task-001/current.md with initial.md first to ensure clean state
        const task1Dir = path.join(process.cwd(), 'packages/benchmark/tasks/task-001');
        fs.copyFileSync(path.join(task1Dir, 'initial.md'), path.join(task1Dir, 'current.md'));
        await runTaskSession('task-001', 'current.md', 'Please update paragraph 2 to say: This is paragraph 2 updated version 1.');
        // Task 2: Target moved relocation on task-081 (target paragraph moved due to Preface prepended)
        // Overwrite packages/benchmark/tasks/task-081/current.md with initial target-moved state
        const task2Dir = path.join(process.cwd(), 'packages/benchmark/tasks/task-081');
        const task2Initial = fs.readFileSync(path.join(task2Dir, 'initial.md'), 'utf-8');
        const task2Current = `# Preface\nIntro text.\n\n` + task2Initial;
        fs.writeFileSync(path.join(task2Dir, 'current.md'), task2Current);
        await runTaskSession('task-081', 'current.md', 'Please update paragraph A to say: This is paragraph A updated 1.');
        // Task 3: Conflict target changed on task-101
        // We simulate target being concurrently changed
        const task3Dir = path.join(process.cwd(), 'packages/benchmark/tasks/task-101');
        const task3Current = `# Title\nThis is paragraph A altered concurrently 1.\n`;
        fs.writeFileSync(path.join(task3Dir, 'current.md'), task3Current);
        await runTaskSession('task-101', 'current.md', 'Please update paragraph A to say: This is paragraph A updated 1.');
    }
    catch (err) {
        console.error('Fatal error during evaluation run:', err);
    }
}
main();
//# sourceMappingURL=eval-llm.js.map