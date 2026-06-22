import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";

const tempDir = path.join(process.cwd(), "packages/mcp/test-temp");

describe("MCP Server Integration", () => {
  const filePath = "mcp-doc.md";
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

  it("connects to MCP server, lists tools, and executes inspect tool", () => {
    return new Promise<void>((resolve, reject) => {
      // Spawn MCP server dist/index.js
      const mcpProcess = spawn(
        "node",
        [path.join(process.cwd(), "packages/mcp/dist/index.js")],
        {
          env: {
            ...process.env,
            MDSE_ALLOWED_ROOTS: tempDir,
          },
        },
      );

      let stdoutData = "";
      mcpProcess.stdout.on("data", (chunk) => {
        stdoutData += chunk.toString();

        // We look for JSON-RPC responses
        try {
          if (stdoutData.includes("\n")) {
            const lines = stdoutData
              .split("\n")
              .filter((l) => l.trim().length > 0);

            // Check list tools response
            if (lines.length === 1) {
              const res = JSON.parse(lines[0]);
              if (res.id === 1) {
                expect(res.result.tools).toBeDefined();
                expect(
                  res.result.tools.some((t: any) => t.name === "inspect"),
                ).toBe(true);

                // Call inspect tool
                const callInspectMsg = {
                  jsonrpc: "2.0",
                  id: 2,
                  method: "tools/call",
                  params: {
                    name: "inspect",
                    arguments: {
                      file: { path: fullPath },
                    },
                  },
                };
                mcpProcess.stdin.write(JSON.stringify(callInspectMsg) + "\n");
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

      mcpProcess.stderr.on("data", (chunk) => {
        // Log stderr (e.g. server running notice)
        // console.log('MCP Error Log:', chunk.toString());
      });

      mcpProcess.on("error", (err) => {
        reject(err);
      });

      // Send initial tools/list request
      const listToolsMsg = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      };
      mcpProcess.stdin.write(JSON.stringify(listToolsMsg) + "\n");
    });
  });

  it("connects to MCP server and executes safe_replace tool", () => {
    return new Promise<void>((resolve, reject) => {
      const mcpProcess = spawn(
        "node",
        [path.join(process.cwd(), "packages/mcp/dist/index.js")],
        {
          env: {
            ...process.env,
            MDSE_ALLOWED_ROOTS: tempDir,
          },
        },
      );

      let stdoutData = "";
      mcpProcess.stdout.on("data", (chunk) => {
        stdoutData += chunk.toString();
        try {
          if (stdoutData.includes("\n")) {
            const lines = stdoutData
              .split("\n")
              .filter((l) => l.trim().length > 0);
            if (lines.length === 1) {
              const res = JSON.parse(lines[0]);
              if (res.id === 1) {
                // Call safe_replace tool
                const callSafeReplaceMsg = {
                  jsonrpc: "2.0",
                  id: 2,
                  method: "tools/call",
                  params: {
                    name: "safe_replace",
                    arguments: {
                      file: { path: fullPath },
                      search: "paragraph A",
                      replace: "updated paragraph text",
                      options: { dry_run: false },
                    },
                  },
                };
                mcpProcess.stdin.write(
                  JSON.stringify(callSafeReplaceMsg) + "\n",
                );
              }
            } else if (lines.length === 2) {
              const res = JSON.parse(lines[1]);
              if (res.id === 2) {
                expect(res.result.isError).toBe(false);
                const contentText = JSON.parse(res.result.content[0].text);
                expect(contentText.ok).toBe(true);
                expect(contentText.status).toBe("committed");

                // Check file content actually changed
                const content = fs.readFileSync(fullPath, "utf-8");
                expect(content).toContain("updated paragraph text");
                expect(content).not.toContain("paragraph A");

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

      mcpProcess.on("error", (err) => {
        reject(err);
      });

      const listToolsMsg = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      };
      mcpProcess.stdin.write(JSON.stringify(listToolsMsg) + "\n");
    });
  });

  it("connects to MCP server and executes safe_patch tool", () => {
    return new Promise<void>((resolve, reject) => {
      const mcpProcess = spawn(
        "node",
        [path.join(process.cwd(), "packages/mcp/dist/index.js")],
        {
          env: {
            ...process.env,
            MDSE_ALLOWED_ROOTS: tempDir,
          },
        },
      );

      let stdoutData = "";
      mcpProcess.stdout.on("data", (chunk) => {
        stdoutData += chunk.toString();
        try {
          if (stdoutData.includes("\n")) {
            const lines = stdoutData
              .split("\n")
              .filter((l) => l.trim().length > 0);
            if (lines.length === 1) {
              const res = JSON.parse(lines[0]);
              if (res.id === 1) {
                // Call safe_patch tool
                const callSafePatchMsg = {
                  jsonrpc: "2.0",
                  id: 2,
                  method: "tools/call",
                  params: {
                    name: "safe_patch",
                    arguments: {
                      file: { path: fullPath },
                      operations: [
                        {
                          op: "insert_after",
                          search: "paragraph A",
                          content: "inserted paragraph text",
                        },
                      ],
                      options: { dry_run: false },
                    },
                  },
                };
                mcpProcess.stdin.write(JSON.stringify(callSafePatchMsg) + "\n");
              }
            } else if (lines.length === 2) {
              const res = JSON.parse(lines[1]);
              if (res.id === 2) {
                expect(res.result.isError).toBe(false);
                const contentText = JSON.parse(res.result.content[0].text);
                expect(contentText.ok).toBe(true);
                expect(contentText.status).toBe("committed");

                // Check file content actually changed
                const content = fs.readFileSync(fullPath, "utf-8");
                expect(content).toContain("inserted paragraph text");

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

      mcpProcess.on("error", (err) => {
        reject(err);
      });

      const listToolsMsg = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      };
      mcpProcess.stdin.write(JSON.stringify(listToolsMsg) + "\n");
    });
  });
});
