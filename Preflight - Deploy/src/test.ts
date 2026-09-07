import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

console.log('Running PreFlight AI Test Suite...');

let testsDir = path.resolve(__dirname, '../tests');
if (!fs.existsSync(testsDir)) {
  const localTestsDir = path.resolve(__dirname, '../Preflight Local test files');
  if (fs.existsSync(localTestsDir)) {
    testsDir = localTestsDir;
  } else {
    console.log('No tests directory found at:', testsDir);
    process.exit(0);
  }
}

const testFiles = fs.readdirSync(testsDir)
  .filter((file) => file.endsWith('.js'))
  .sort();

let allPassed = true;

for (const file of testFiles) {
  const fullPath = path.join(testsDir, file);
  console.log(`\n================================================================================`);
  console.log(`RUNNING SUITE: ${file}`);
  console.log(`================================================================================`);
  try {
    execSync(`node "${fullPath}"`, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
    console.log(`[PASS] Suite ${file} completed successfully.`);
  } catch (err: any) {
    console.error(`[FAIL] Suite ${file} failed: ${err.message}`);
    allPassed = false;
  }
}

if (!allPassed) {
  console.error('\nOne or more test suites failed.');
  process.exit(1);
} else {
  console.log('\n================================================================================');
  console.log('ALL PREFLIGHT TEST SUITES COMPLETED SUCCESSFULLY.');
  console.log('================================================================================');
}
