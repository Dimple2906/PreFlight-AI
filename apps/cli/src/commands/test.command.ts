import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import path from 'node:path';
import { TestAppService } from '../services/test.service.js';
import { loadCliEnvironment } from '../utils/env.js';
import { loadPreflightConfig } from '@preflight/config';
import { GlobalCliOptions } from '../utils/options.js';
import { ExitCode, resolveExitCode } from '../utils/exit-codes.js';
import { renderBanner, renderProjectSummary, renderAIStatus } from '../ui/header.js';
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

      // Load environment variables before provider resolution
      loadCliEnvironment(targetPath);

      const config = await loadPreflightConfig(targetPath);
      const isAiEnabled = opts.ai !== false && config.ai.enabled;
      const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
      const activeProvider = isAiEnabled ? (config.ai.provider as 'gemini' | 'mock') : 'mock';

      if (!opts.quiet && !opts.json) {
        console.log(renderBanner());
        console.log(renderAIStatus(isAiEnabled, activeProvider, hasGeminiKey, config.ai.modelName));
      }

      const spinner = !opts.quiet && !opts.json ? ora('Inspecting project structure & executing tests...').start() : null;

      try {
        const testService = new TestAppService();
        const report = await testService.run({
          projectPath: targetPath,
          enableAi: isAiEnabled,
          configPath: opts.config,
          url: opts.url,
          concurrency: opts.concurrency ? parseInt(opts.concurrency, 10) : 4,
          onProgress: (msg: string) => {
            if (spinner) spinner.stop();
            if (!opts.quiet && !opts.json) {
              console.log(chalk.cyan(`  ${msg}`));
            }
            if (spinner) spinner.start('Executing tests...');
          }
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
