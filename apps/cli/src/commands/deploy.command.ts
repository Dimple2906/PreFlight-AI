import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import path from 'node:path';
import { DeployAppService } from '../services/deploy.service.js';
import { loadCliEnvironment } from '../utils/env.js';
import { GlobalCliOptions } from '../utils/options.js';
import { ExitCode, resolveExitCode } from '../utils/exit-codes.js';
import { renderBanner, renderProjectSummary } from '../ui/header.js';
import { ReportEngine } from '@preflight/reporter';

export function registerDeployCommand(program: Command): void {
  program
    .command('deploy [path]')
    .description('Perform deterministic deployment-readiness checks and pre-flight release validation')
    .action(async (projectArg?: string) => {
      const opts = program.opts<GlobalCliOptions>();
      const targetPath = projectArg ? path.resolve(projectArg) : process.cwd();
      loadCliEnvironment(targetPath);
      const spinner = !opts.quiet && !opts.json ? ora('Inspecting deployment readiness...').start() : null;

      try {
        const deployService = new DeployAppService();
        const report = await deployService.run({
          projectPath: targetPath,
          enableAi: opts.ai !== false,
          configPath: opts.config
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
        if (spinner) spinner.fail('Deployment check failed');
        const code = resolveExitCode(err);
        if (!opts.quiet) {
          console.error(chalk.red(`\nPreFlight Deploy Error: ${err.message || String(err)}`));
        }
        process.exitCode = code;
      }
    });
}
