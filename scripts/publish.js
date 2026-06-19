import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const packages = ['core', 'protocol', 'markdown', 'cli', 'mcp', 'benchmark'];
const publishPackages = ['core', 'protocol', 'markdown', 'cli', 'mcp'];

function getRegistryVersion() {
  try {
    const output = execSync('npm view @md-safeedit/core version', { stdio: ['pipe', 'pipe', 'ignore'] });
    return output.toString().trim();
  } catch (e) {
    console.log('⚠️ Could not fetch version from NPM registry. Assuming package is not published yet.');
    return '0.0.0-dev';
  }
}

function parseVersion(v) {
  const match = v.match(/^(\d+)\.(\d+)\.(\d+)(?:-dev)?$/);
  if (!match) return [0, 0, 0, false];
  return [
    parseInt(match[1], 10),
    parseInt(match[2], 10),
    parseInt(match[3], 10),
    v.includes('-dev')
  ];
}

function isGreater(v1, v2) {
  const [maj1, min1, pat1, dev1] = parseVersion(v1);
  const [maj2, min2, pat2, dev2] = parseVersion(v2);
  
  if (maj1 !== maj2) return maj1 > maj2;
  if (min1 !== min2) return min1 > min2;
  if (pat1 !== pat2) return pat1 > pat2;
  if (dev1 !== dev2) return !dev1; // stable is greater than dev
  return false;
}

function incrementVersion(v) {
  const [maj, min, pat, dev] = parseVersion(v);
  return `${maj}.${min}.${pat + 1}${dev ? '-dev' : ''}`;
}

function run() {
  console.log('🔍 Checking current NPM registry and local package states...');
  
  // 1. Get registry version
  const registryVersion = getRegistryVersion();
  console.log(`📡 Registry version (@md-safeedit/core): ${registryVersion}`);
  
  // 2. Get local version
  const corePackageJsonPath = path.join(rootDir, 'packages', 'core', 'package.json');
  const corePackageJson = JSON.parse(fs.readFileSync(corePackageJsonPath, 'utf8'));
  const localVersion = corePackageJson.version;
  console.log(`💻 Local version in package.json: ${localVersion}`);
  
  // 3. Determine target version
  let targetVersion;
  if (isGreater(localVersion, registryVersion)) {
    console.log(`✨ Local version ${localVersion} is newer than registry. Using local version.`);
    targetVersion = localVersion;
  } else {
    targetVersion = incrementVersion(registryVersion);
    console.log(`📈 Registry version is equal or newer. Auto-incrementing to next version: ${targetVersion}`);
  }
  
  // 4. Update all package.json files
  console.log(`✍️ Updating package.json files to version ${targetVersion}...`);
  for (const pkg of packages) {
    const pkgJsonPath = path.join(rootDir, 'packages', pkg, 'package.json');
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    pkgJson.version = targetVersion;
    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n');
  }
  
  // 5. Build workspaces
  console.log('🔨 Rebuilding workspaces with the new version...');
  execSync('npm run build --workspaces', { stdio: 'inherit', cwd: rootDir });
  
  // 6. Publish packages in dependency order
  console.log('📦 Starting publication...');
  const isDev = targetVersion.includes('-dev');
  const publishCmd = isDev 
    ? 'npm publish --tag dev --access public' 
    : 'npm publish --access public';
  
  for (const pkg of publishPackages) {
    console.log(`\n🚀 Publishing @md-safeedit/${pkg} at version ${targetVersion}...`);
    const pkgDir = path.join(rootDir, 'packages', pkg);
    try {
      execSync(publishCmd, { stdio: 'inherit', cwd: pkgDir });
    } catch (e) {
      console.error(`❌ Failed to publish @md-safeedit/${pkg}. Stopping execution.`);
      process.exit(1);
    }
  }
  
  // 7. Commit changes to Git so package.jsons stay updated in repo
  console.log('\n💾 Committing version updates to Git...');
  try {
    execSync(`git add packages/*/package.json && git commit -m "chore: bump version to ${targetVersion} [skip ci]"`, { stdio: 'inherit', cwd: rootDir });
    console.log('✅ Version bump committed to local Git repository.');
  } catch (e) {
    console.log('⚠️ Git commit failed or no changes to commit.');
  }
  
  console.log(`\n🎉 All packages successfully published to NPM as version ${targetVersion}!`);
}

run();
