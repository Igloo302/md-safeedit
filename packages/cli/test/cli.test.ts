import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
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
      const stdout = execSync(`node ${cliPath} ${args.join(' ')}`, {
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
});
