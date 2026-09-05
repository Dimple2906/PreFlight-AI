import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import path from 'node:path';
import { TestAppService } from '../services/test.service.js';
import { GlobalCliOptions } from '../utils/options.js';
import { ExitCode, resolveExitCode } from '../utils/exit-codes.js';
import { renderBanner, renderProjectSummary } from '../ui/header.js';
import { ReportEngine } from '@preflight/reporter';

interface TestCommandOptions extends GlobalCliOptions {
  url?: string;
  concurrency?: string;
}

export function registerTestCommand(program: Command): void {
  program
    .command('test [path]')
    .description('Perform deterministic adversarial QA testing and coverage gap analysis')
    .option('--url <url>', 'Target application HTTP URL for active probing')
    .option('--concurrency <number>', 'Maximum concurrency for burst probes', '4')
    .action(async (projectArg?: string, cmdOpts?: TestCommandOptions) => {
      const globalOpts = program.opts<GlobalCliOptions>();
      const opts = { ...globalOpts, ...cmdOpts };
      const targetPath = projectArg ? path.resolve(projectArg) : process.cwd();
      const spinner = !opts.quiet && !opts.json ? ora('Inspecting project structure...').start() : null;

      try {
        const testService = new TestAppService();
        const report = await testService.run({
          projectPath: targetPath,
          enableAi: opts.ai !== false,
          configPath: opts.config,
          url: opts.url,
          concurrency: opts.concurrency ? parseInt(opts.concurrency, 10) : 4
        });

        if (spinner) spinner.stop();

        const reporter = new ReportEngine();

        if (opts.report) {
          const fs = await import('fs');
          const mdContent = reporter.renderMarkdown(report);
          const fullPath = path.resolve(process.cwd(), opts.report);
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          fs.writeFileSync(fullPath, mdContent, 'utf-8');
          if (!opts.quiet && !opts.json) {
            console.log(chalk.green(`✓ Report generated: ${opts.report}`));
          }
        }

        if (opts.json) {
          console.log(reporter.renderJson(report));
        } else {
          if (!opts.quiet) {
            console.log(renderBanner());
            console.log(renderProjectSummary(report.projectProfile));
          }
          console.log(reporter.renderTerminal(report));
        }

        if (report.overallStatus === 'FAIL' || report.overallStatus === 'ERROR') {
          process.exitCode = ExitCode.FAILURE;
        } else {
          process.exitCode = ExitCode.SUCCESS;
        }
      } catch (err: any) {
        if (spinner) spinner.fail('Test execution failed');
        const code = resolveExitCode(err);
        if (!opts.quiet) {
          console.error(chalk.red(`\nPreFlight Test Error: ${err.message || String(err)}`));
        }
        process.exitCode = code;
      }
    });
}
