import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync, execFileSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const cliPath = path.join(process.cwd(), 'packages/cli/dist/index.js');
const tempDir = path.join(process.cwd(), 'packages/cli/test-temp-cli');

describe('CLI Shell Execution and Exit Codes', () => {
  const filePath = path.join(tempDir, 'cli-test.md');

  beforeEach(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    fs.writeFileSync(filePath, '# Hello\nThis is a paragraph.\n');
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  const runCli = (args: string[], stdinContent?: string): { status: number | null; stdout: string; stderr: string } => {
    try {
      const hasJsonFlags = args.includes('--json') || args.includes('--no-json');
      const finalArgs = hasJsonFlags ? args : [...args, '--json'];
      const cleanArgs = finalArgs.filter(a => a !== '--no-json');
      const stdout = execFileSync('node', [cliPath, ...cleanArgs], {
        input: stdinContent,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          MDSE_ALLOWED_ROOTS: tempDir
        }
      });
      return { status: 0, stdout, stderr: '' };
    } catch (err: any) {
      return {
        status: err.status ?? null,
        stdout: err.stdout || '',
        stderr: err.stderr || ''
      };
    }
  };

  it('exits with 64 on usage / help', () => {
    const res = runCli([]);
    expect(res.status).toBe(64);
    expect(res.stderr).toContain('Usage:');

    const resHelp = runCli(['--help']);
    expect(resHelp.status).toBe(64);
  });

  it('exits with 64 on missing required parameters', () => {
    // search requires query
    const resSearch = runCli(['search', filePath]);
    expect(resSearch.status).toBe(64);
    expect(resSearch.stderr).toContain('requires a query string');

    // read requires targets
    const resRead = runCli(['read', filePath]);
    expect(resRead.status).toBe(64);
    expect(resRead.stderr).toContain('requires at least one runtime ID');
  });

  it('exits with 64 on invalid JSON stdin input', () => {
    const res = runCli(['inspect'], 'invalid-json{');
    expect(res.status).toBe(64);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe('IO_ERROR');
  });

  it('exits with 6 on IO error (e.g. file does not exist)', () => {
    const res = runCli(['inspect', path.join(tempDir, 'non-existent.md')]);
    expect(res.status).toBe(6);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe('IO_ERROR');
  });

  it('exits with 5 on validation failure (Zod validation error)', () => {
    // Pass malformed options to search via stdin JSON mode
    const payload = {
      file: { path: filePath },
      query: 'Hello',
      options: {
        limit: 'not-a-number' // Should trigger Zod validation error
      }
    };
    const res = runCli(['search'], JSON.stringify(payload));
    expect(res.status).toBe(5);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe('VALIDATION_FAILED');
  });

  it('verifies human-readable text output mode when --json is omitted', () => {
    const res = runCli(['inspect', filePath, '--no-json']);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('mdse CLI version:');
    expect(res.stdout).toContain('File:');
    expect(res.stdout).toContain('Outline:');
    expect(res.stdout).not.toContain('{'); // not JSON
  });

  it('verifies --version and -v queries', () => {
    const resVer = runCli(['--version']);
    const parsedVer = JSON.parse(resVer.stdout);
    expect(parsedVer.ok).toBe(true);
    expect(parsedVer.cli_version).toBeDefined();

    const resVerNoJson = runCli(['-v', '--no-json']);
    expect(resVerNoJson.stdout).toContain('mdse CLI version:');
  });

  it('reads token from file using @ prefix during patch command', () => {
    // 1. Get outline to locate runtime ID of paragraph
    const inspectRes = runCli(['inspect', filePath]);
    const parsedInspect = JSON.parse(inspectRes.stdout);
    const section = parsedInspect.outline[0];
    
    // 2. Read node to obtain token
    const readRes = runCli(['read', filePath, section.runtime_id]);
    const parsedRead = JSON.parse(readRes.stdout);
    const token = parsedRead.nodes[0].anchor_token;
    
    // 3. Write token to a temporary file
    const tokenFilePath = path.join(tempDir, 'token-temp.txt');
    fs.writeFileSync(tokenFilePath, token);
    
    // 4. Run patch by specifying @tokenFilePath as argument
    const patchRes = runCli(['patch', filePath, 'replace', `@${tokenFilePath}`, '## Hello\nUpdated content\n', '--commit']);
    expect(patchRes.status).toBe(0);
    const parsedPatch = JSON.parse(patchRes.stdout);
    expect(parsedPatch.ok).toBe(true);
    expect(parsedPatch.status).toBe('committed');
    
    // 5. Confirm file content updated
    const updatedContent = fs.readFileSync(filePath, 'utf-8');
    expect(updatedContent).toContain('Updated content');
  });

  it('reads content from file using @ prefix during patch command', () => {
    // 1. Get outline to locate runtime ID of paragraph
    const inspectRes = runCli(['inspect', filePath]);
    const parsedInspect = JSON.parse(inspectRes.stdout);
    const section = parsedInspect.outline[0];
    
    // 2. Read node to obtain token
    const readRes = runCli(['read', filePath, section.runtime_id]);
    const parsedRead = JSON.parse(readRes.stdout);
    const token = parsedRead.nodes[0].anchor_token;
    
    // 3. Write content to a temporary file
    const contentFilePath = path.join(tempDir, 'content-temp.txt');
    fs.writeFileSync(contentFilePath, '## Hello\nUpdated content from file\n');
    
    // 4. Run patch by specifying @contentFilePath as the content argument
    const patchRes = runCli(['patch', filePath, 'replace', token, `@${contentFilePath}`, '--commit']);
    expect(patchRes.status).toBe(0);
    const parsedPatch = JSON.parse(patchRes.stdout);
    expect(parsedPatch.ok).toBe(true);
    expect(parsedPatch.status).toBe('committed');
    
    // 5. Confirm file content updated
    const updatedContent = fs.readFileSync(filePath, 'utf-8');
    expect(updatedContent).toContain('Updated content from file');
  });
});

