const { spawnSync } = require('child_process');
const path = require('path');
const assert = require('assert');

console.log('Running PreFlight Testing System Battery...');
const rootDir = path.resolve(__dirname, '../..');

const res = spawnSync('pnpm', ['test'], {
  cwd: rootDir,
  encoding: 'utf-8',
  shell: true
});

console.log(res.stdout);
if (res.status !== 0) {
  console.error(res.stderr);
  process.exit(res.status);
}

console.log('ALL PREFLIGHT TEST BATTERIES PASSED: 100%');
