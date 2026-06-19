import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const tempDir = path.join(process.cwd(), 'packages/mcp/test-temp');

describe('MCP Server Integration', () => {
  const filePath = 'mcp-doc.md';
  const fullPath = path.join(tempDir, filePath);

  beforeEach(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    fs.writeFileSync(fullPath, `# Hardware\nThis is paragraph A.\n`);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('connects to MCP server, lists tools, and executes inspect tool', () => {
    return new Promise<void>((resolve, reject) => {
      // Spawn MCP server dist/index.js
      const mcpProcess = spawn('node', [path.join(process.cwd(), 'packages/mcp/dist/index.js')], {
        env: {
          ...process.env,
          MDSE_ALLOWED_ROOTS: tempDir
        }
      });

      let stdoutData = '';
      mcpProcess.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString();
        
        // We look for JSON-RPC responses
        try {
          if (stdoutData.includes('\n')) {
            const lines = stdoutData.split('\n').filter(l => l.trim().length > 0);
            
            // Check list tools response
            if (lines.length === 1) {
              const res = JSON.parse(lines[0]);
              if (res.id === 1) {
                expect(res.result.tools).toBeDefined();
                expect(res.result.tools.some((t: any) => t.name === 'inspect')).toBe(true);
                
                // Call inspect tool
                const callInspectMsg = {
                  jsonrpc: '2.0',
                  id: 2,
                  method: 'tools/call',
                  params: {
                    name: 'inspect',
                    arguments: {
                      file: { path: fullPath }
                    }
                  }
                };
                mcpProcess.stdin.write(JSON.stringify(callInspectMsg) + '\n');
              }
            } else if (lines.length === 2) {
              const res = JSON.parse(lines[1]);
              if (res.id === 2) {
                expect(res.result.isError).toBe(false);
                const contentText = JSON.parse(res.result.content[0].text);
                expect(contentText.ok).toBe(true);
                expect(contentText.document.display_path).toBe(fullPath);
                
                mcpProcess.kill();
                resolve();
              }
            }
          }
        } catch (err) {
          mcpProcess.kill();
          reject(err);
        }
      });

      mcpProcess.stderr.on('data', (chunk) => {
        // Log stderr (e.g. server running notice)
        // console.log('MCP Error Log:', chunk.toString());
      });

      mcpProcess.on('error', (err) => {
        reject(err);
      });

      // Send initial tools/list request
      const listToolsMsg = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      };
      mcpProcess.stdin.write(JSON.stringify(listToolsMsg) + '\n');
    });
  });
});
