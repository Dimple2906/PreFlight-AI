import * as path from 'node:path';
import * as fs from 'node:fs';
import { spawnSync } from 'node:child_process';

export interface TestRunOptions {
  projectPath: string;
  enableAi?: boolean;
  json?: boolean;
  adaptive?: boolean;
}

export function runPreflightTest(options: TestRunOptions): number {
  const targetPath = path.resolve(options.projectPath || process.cwd());
  const cliBin = path.resolve(__dirname, '../../apps/cli/bin/preflight.js');

  const args = ['test', targetPath];
  if (options.enableAi === false) args.push('--no-ai');
  if (options.json) args.push('--json');
  if (options.adaptive === false) args.push('--no-adaptive');

  const result = spawnSync(process.execPath, [cliBin, ...args], {
    cwd: targetPath,
    stdio: 'inherit'
  });

  return result.status ?? 0;
}

export function main(argv: string[] = process.argv.slice(2)): number {
  const args = argv;
  const targetPath = args.find((a) => !a.startsWith('-')) || '.';
  const noAi = args.includes('--no-ai');
  const json = args.includes('--json');
  const noAdaptive = args.includes('--no-adaptive');

  return runPreflightTest({
    projectPath: targetPath,
    enableAi: !noAi,
    json,
    adaptive: !noAdaptive
  });
}

if (require.main === module) {
  const code = main();
  process.exit(code);
}
