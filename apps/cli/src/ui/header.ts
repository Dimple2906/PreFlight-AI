import chalk from 'chalk';
import { ProjectProfile } from '@preflight/core';

export function renderBanner(): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('✈ PREFLIGHT AI'));
  lines.push(chalk.gray('────────────────────────────────────────\n'));
  return lines.join('\n');
}

export function renderProjectSummary(profile: ProjectProfile): string {
  const lines: string[] = [];
  lines.push(`  ${chalk.dim('Project:')}    ${chalk.bold(profile.name)}`);
  lines.push(`  ${chalk.dim('Framework:')}  ${profile.frameworks.join(', ')}`);
  lines.push(`  ${chalk.dim('Runtime:')}    ${profile.runtime}`);
  lines.push(`  ${chalk.dim('Database:')}   ${profile.databases.join(', ')}`);
  lines.push(`  ${chalk.dim('Hosting:')}    ${profile.hosting.join(', ')}`);
  lines.push(`  ${chalk.dim('Domain:')}     ${profile.projectType}`);
  lines.push('\n  ' + chalk.green('✓ Project classified') + '\n');
  return lines.join('\n');
}
