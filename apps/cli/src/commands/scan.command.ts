import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import { ScanAppService } from '../services/scan.service.js';
import { GlobalCliOptions } from '../utils/options.js';
import { ExitCode, resolveExitCode } from '../utils/exit-codes.js';
import { renderBanner, renderProjectSummary } from '../ui/header.js';

export function registerScanCommand(program: Command): void {
  program
    .command('scan [path]')
    .description('Scan project for vulnerability vectors and architectural risks')
    .action(async (projectArg?: string) => {
      const opts = program.opts<GlobalCliOptions>();
      const targetPath = projectArg ? path.resolve(projectArg) : process.cwd();

      try {
        const scanService = new ScanAppService();
        const res = await scanService.run(targetPath);

        if (opts.json) {
          console.log(JSON.stringify({
            schemaVersion: "1.0",
            project: res.profile,
            classification: {
              type: res.profile.projectType,
              languages: res.profile.languages,
              frameworks: res.profile.frameworks
            },
            vulnerabilityVectorsCount: res.vulnerabilityVectorsCount,
            recommendations: res.recommendations
          }, null, 2));
        } else {
          if (!opts.quiet) {
            console.log(renderBanner());
            console.log(renderProjectSummary(res.profile));
          }
          console.log(chalk.bold.yellow('Vulnerability Scan Summary:'));
          console.log(`  Identified Vectors: ${res.vulnerabilityVectorsCount}`);
          for (const rec of res.recommendations) {
            console.log(`  * ${rec}`);
          }
        }
        process.exitCode = ExitCode.SUCCESS;
      } catch (err: any) {
        const code = resolveExitCode(err);
        if (!opts.quiet) {
          console.error(chalk.red(`\nPreFlight Scan Error: ${err.message || String(err)}`));
        }
        process.exitCode = code;
      }
    });
}
