import { Command } from 'commander';
import dotenv from 'dotenv';
import { registerTestCommand } from './commands/test.command.js';
import { registerDeployCommand } from './commands/deploy.command.js';
import { registerScanCommand } from './commands/scan.command.js';
import { registerDoctorCommand } from './commands/doctor.command.js';
import { ExitCode } from './utils/exit-codes.js';

dotenv.config();

export function createCliProgram(): Command {
  const program = new Command();

  program
    .name('preflight')
    .description('PreFlight AI - CLI Production Readiness Gatekeeper for Software Projects')
    .version('1.0.0')
    .configureOutput({
      outputError: (str, write) => {
        write(str);
        process.exitCode = ExitCode.INVALID_USAGE;
      }
    });

  // Global Options
  program
    .option('--json', 'Output results in machine-readable JSON format', false)
    .option('--verbose', 'Enable detailed debug logging', false)
    .option('--quiet', 'Suppress all output except final result', false)
    .option('--no-ai', 'Disable AI analysis layer post-execution', false)
    .option('--config <path>', 'Path to custom configuration file')
    .option('-r, --report <path>', 'Write execution report to specified Markdown file');

  // Register commands
  registerTestCommand(program);
  registerDeployCommand(program);
  registerScanCommand(program);
  registerDoctorCommand(program);

  return program;
}

if (
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
  process.argv[1]?.endsWith('index.js') ||
  process.argv[1]?.endsWith('preflight.js')
) {
  const handleSignal = (signal: string) => {
    console.error(`\nProcess interrupted by ${signal}. Cleaning up...`);
    process.exit(ExitCode.INTERRUPTED);
  };

  process.on('SIGINT', () => handleSignal('SIGINT'));
  process.on('SIGTERM', () => handleSignal('SIGTERM'));

  const program = createCliProgram();
  program.parseAsync(process.argv).catch(() => {
    process.exitCode = ExitCode.SYSTEM_ERROR;
  });
}
