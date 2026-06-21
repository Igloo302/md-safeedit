import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';

// On Windows, executables like `npx` and `npm` are .cmd files and require
// shell: true to be found by spawn/execSync without an absolute path.
const IS_WINDOWS = process.platform === 'win32';
const SHELL_OPT = IS_WINDOWS ? { shell: true } : {};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const tempDir = path.join(rootDir, 'temp-smoke-test');

const packages = ['core', 'protocol', 'markdown', 'cli', 'mcp'];

async function cleanup() {
  if (!fs.existsSync(tempDir)) return;
  const maxRetries = 10;
  const delay = 100;
  for (let i = 0; i < maxRetries; i++) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
      return;
    } catch (err) {
      if (i === maxRetries - 1) {
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function run() {
  console.log('🧹 Cleaning up old temp smoke test folders...');
  await cleanup();
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // 1. Pack all packages
    console.log('📦 Running npm pack on all workspaces...');
    const tarballs = {};
    for (const pkg of packages) {
      const pkgDir = path.join(rootDir, 'packages', pkg);
      // Run pack and extract the filename of the generated tarball
      const output = execSync('npm pack --json', { cwd: pkgDir }).toString();
      const packResult = JSON.parse(output);
      const filename = packResult[0].filename;
      tarballs[pkg] = path.join(pkgDir, filename);
      console.log(`   Packed @md-safeedit/${pkg} -> ${filename}`);
    }

    // 2. Init temp npm project
    console.log('⚙️ Initializing clean npm project in temp sandbox...');
    execSync('npm init -y', { cwd: tempDir, stdio: 'ignore' });

    // 3. Install packages from tarballs
    console.log('🚚 Installing packed packages in sandbox...');
    const installArgs = Object.values(tarballs).map(t => `"${t}"`).join(' ');
    execSync(`npm install ${installArgs}`, { cwd: tempDir, stdio: 'inherit' });

    // 4. Create a sample Markdown file for testing
    console.log('📝 Creating sample Markdown file...');
    const sampleMd = path.join(tempDir, 'sample.md');
    fs.writeFileSync(sampleMd, '# Sample File\n\nThis is a test paragraph for smoke testing.\n\n- List Item 1\n- List Item 2\n');

    // 5. Test CLI functionality
    console.log('🤖 Verifying CLI functionality...');
    
    // Inspect
    console.log('   Running: mdse inspect');
    const inspectOut = execSync(`npx mdse inspect "${sampleMd}"`, { cwd: tempDir, ...SHELL_OPT }).toString();
    const inspectJson = JSON.parse(inspectOut);
    if (!inspectJson.ok || !inspectJson.document) {
      throw new Error(`CLI inspect output validation failed: ${inspectOut}`);
    }
    console.log('   ✅ CLI inspect is OK.');

    // Search
    console.log('   Running: mdse search');
    const searchOut = execSync(`npx mdse search "${sampleMd}" "paragraph"`, { cwd: tempDir, ...SHELL_OPT }).toString();
    const searchJson = JSON.parse(searchOut);
    if (!searchJson.ok || !Array.isArray(searchJson.matches)) {
      throw new Error(`CLI search output validation failed: ${searchOut}`);
    }
    console.log('   ✅ CLI search is OK.');

    // 6. Test MCP Server functionality (JSON-RPC initialize and tools/list)
    console.log('🔌 Verifying MCP Server stdio connection...');
    await testMCPServer();
    console.log('   ✅ MCP Server is OK.');

    console.log('\n🎉 ALL SMOKE TESTS PASSED SUCCESSFULLY!');
  } finally {
    console.log('🧹 Cleaning up temp smoke test folders...');
    await cleanup();
    // Also remove the local tarballs
    for (const pkg of packages) {
      const pkgDir = path.join(rootDir, 'packages', pkg);
      const files = fs.readdirSync(pkgDir).filter(f => f.endsWith('.tgz'));
      for (const file of files) {
        fs.unlinkSync(path.join(pkgDir, file));
      }
    }
  }
}

function testMCPServer() {
  return new Promise((resolve, reject) => {
    // Spawn npx md-safeedit-mcp
    // shell:true is required on Windows where npx is npx.cmd, not a bare binary.
    const mcpProcess = spawn('npx', ['md-safeedit-mcp'], {
      cwd: tempDir,
      shell: IS_WINDOWS,
      env: { ...process.env, MDSE_ALLOWED_ROOTS: tempDir }
    });

    let finished = false;
    let timeoutId;

    function finish(err) {
      if (finished) return;
      finished = true;
      clearTimeout(timeoutId);

      const done = () => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      };

      if (mcpProcess.exitCode !== null || mcpProcess.signalCode !== null) {
        done();
      } else {
        mcpProcess.once('close', done);
        mcpProcess.kill();
      }
    }

    let stdoutData = '';
    mcpProcess.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
      checkState();
    });

    mcpProcess.stderr.on('data', (chunk) => {
      // MCP writes logs to stderr, which is fine
      // console.log(`[MCP Stderr] ${chunk.toString().trim()}`);
    });

    mcpProcess.on('error', (err) => {
      finish(new Error(`Failed to start MCP process: ${err.message}`));
    });

    let state = 'INIT';

    function sendRequest(payload) {
      mcpProcess.stdin.write(JSON.stringify(payload) + '\n');
    }

    function checkState() {
      // Split stdout by newlines and parse JSON payloads
      const lines = stdoutData.split('\n');
      while (lines.length > 1) {
        const line = lines.shift().trim();
        if (!line) continue;
        try {
          const response = JSON.parse(line);
          if (state === 'INIT') {
            if (response.id === 1 && response.result) {
              console.log('   ✅ MCP Server initialized successfully.');
              state = 'LIST_TOOLS';
              sendRequest({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/list',
                params: {}
              });
            } else {
              finish(new Error(`MCP Server initialize failed: ${line}`));
            }
          } else if (state === 'LIST_TOOLS') {
            if (response.id === 2 && response.result && Array.isArray(response.result.tools)) {
              const tools = response.result.tools.map(t => t.name);
              console.log(`   ✅ MCP Server returned tools: ${tools.join(', ')}`);
              const expectedTools = ['inspect', 'search', 'read', 'patch'];
              const missing = expectedTools.filter(t => !tools.includes(t));
              if (missing.length > 0) {
                finish(new Error(`MCP Server missing expected tools: ${missing.join(', ')}`));
              } else {
                finish();
              }
            } else {
              finish(new Error(`MCP Server tools/list failed: ${line}`));
            }
          }
        } catch (e) {
          // If not valid JSON, could be partial read, wait for more data
        }
      }
      stdoutData = lines.join('\n');
    }

    // Send initialize request
    sendRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'smoke-test-client',
          version: '1.0.0'
        }
      }
    });

    // Timeout safety
    timeoutId = setTimeout(() => {
      finish(new Error('MCP Server smoke test timed out.'));
    }, 5000);
  });
}

run().catch(err => {
  console.error('❌ Smoke test failed:', err);
  process.exit(1);
});
