#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createTempVulnerableProject } from '../packages/core/dist/index.js';

const TRACKING_FILE = path.join(os.tmpdir(), 'preflight-temp-vulnerable-path.txt');

const isClean = process.argv.includes('--clean');
const isWait = process.argv.includes('--wait');

if (isClean) {
  if (fs.existsSync(TRACKING_FILE)) {
    const targetDir = fs.readFileSync(TRACKING_FILE, 'utf-8').trim();
    if (targetDir && fs.existsSync(targetDir)) {
      try {
        fs.rmSync(targetDir, { recursive: true, force: true });
        console.log(`✓ Cleaned up temporary vulnerable project: ${targetDir}`);
      } catch (err) {
        console.error(`Error cleaning up directory ${targetDir}:`, err.message);
      }
    } else {
      console.log(`No active temporary project directory found at: ${targetDir}`);
    }
    try {
      fs.unlinkSync(TRACKING_FILE);
    } catch {
      // ignore
    }
  } else {
    console.log('No active temporary vulnerable project recorded.');
  }
  process.exit(0);
}

// Create the temporary vulnerable project using existing core generator
const project = createTempVulnerableProject({ buildFails: true });
const absolutePath = path.resolve(project.rootPath);

// Save tracking path for later cleanup
try {
  fs.writeFileSync(TRACKING_FILE, absolutePath, 'utf-8');
} catch {
  // non-fatal if tracking file write fails
}

console.log('');
console.log('✈ PREFLIGHT AI — Temporary Vulnerable Project Runner');
console.log('─────────────────────────────────────────────────────');
console.log('✓ Created in system temp directory');
console.log('Project Path:');
console.log(`  ${absolutePath}`);
console.log('');
console.log('Test with PreFlight CLI:');
console.log(`  preflight test "${absolutePath}"`);
console.log(`  preflight test "${absolutePath}" --no-ai`);
console.log(`  preflight deploy "${absolutePath}"`);
console.log('');
console.log('Clean up when finished:');
console.log('  pnpm temp:vulnerable --clean');
console.log('─────────────────────────────────────────────────────');

if (isWait) {
  console.log('\n[Press Enter or Ctrl+C to clean up and exit]');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const doCleanup = () => {
    try {
      project.cleanup();
      if (fs.existsSync(TRACKING_FILE)) {
        fs.unlinkSync(TRACKING_FILE);
      }
      console.log(`\n✓ Cleaned up temporary project: ${absolutePath}`);
    } catch {
      // ignore
    }
    process.exit(0);
  };

  process.on('SIGINT', doCleanup);
  process.on('SIGTERM', doCleanup);
  rl.question('', () => {
    rl.close();
    doCleanup();
  });
}
