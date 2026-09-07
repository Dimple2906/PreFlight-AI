import { Command } from 'commander';
import chalk from 'chalk';
import { DoctorAppService } from '../services/doctor.service.js';
import { loadCliEnvironment } from '../utils/env.js';
import { GlobalCliOptions } from '../utils/options.js';
import { ExitCode } from '../utils/exit-codes.js';

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Diagnose PreFlight CLI environment and AI provider connectivity')
    .action(async () => {
      loadCliEnvironment();
      const opts = program.opts<GlobalCliOptions>();
      const doctorService = new DoctorAppService();
      const results = await doctorService.run();

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(chalk.bold.cyan('\n✈ PREFLIGHT DOCTOR DIAGNOSTICS'));
        console.log(chalk.gray('────────────────────────────────────────\n'));
        for (const res of results) {
          const icon = res.passed ? chalk.green('✓') : chalk.yellow('!');
          console.log(`  ${icon} ${chalk.bold(res.check)}: ${res.message}`);
        }
        console.log('\n' + chalk.green('System environment ready.\n'));
      }
      process.exitCode = ExitCode.SUCCESS;
    });
}
