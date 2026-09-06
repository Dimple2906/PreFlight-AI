import chalk from 'chalk';
import { ProjectProfile } from '@preflight/core';

export function renderBanner(): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('✈ PREFLIGHT AI'));
  lines.push(chalk.gray('────────────────────────────────────────\n'));
  return lines.join('\n');
}

export function renderAIStatus(aiEnabled: boolean, provider = 'gemini', isAvailable = false, modelName = 'gemini-3.6-flash'): string {
  const lines: string[] = [];
  lines.push(chalk.bold.white('AI PROVIDER'));
  if (!aiEnabled) {
    lines.push(`  ${chalk.gray('○ Disabled by --no-ai')}`);
  } else {
    const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
    lines.push(`  ${chalk.dim('GEMINI_API_KEY detected:')} ${hasKey ? chalk.green('yes') : chalk.yellow('no')}`);
    lines.push(`  ${chalk.dim('Selected provider:')}       ${chalk.cyan(provider === 'gemini' && hasKey ? 'Gemini' : 'Mock')}`);

    if (provider === 'gemini' && (isAvailable || hasKey)) {
      lines.push(`  ${chalk.green('✓ Gemini connected')}`);
      lines.push(`  ${chalk.dim(`Model: ${modelName} | Mode: adaptive testing`)}`);
    } else if (provider === 'gemini') {
      lines.push(`  ${chalk.yellow('⚠ Gemini unavailable (GEMINI_API_KEY missing or invalid)')}`);
      lines.push(`  ${chalk.dim('Mode: offline deterministic testing')}`);
    } else {
      lines.push(`  ${chalk.green('✓ Mock AI provider active')}`);
      lines.push(`  ${chalk.dim('Mode: offline deterministic simulation')}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

export function renderProjectSummary(profile: ProjectProfile): string {
  const lines: string[] = [];
  lines.push(`  ${chalk.dim('Project:')}    ${chalk.bold(profile.name)}`);
  lines.push(`  ${chalk.dim('Framework:')}  ${profile.frameworks.join(', ') || 'N/A'}`);
  lines.push(`  ${chalk.dim('Runtime:')}    ${profile.runtime}`);
  lines.push(`  ${chalk.dim('Database:')}   ${profile.databases.join(', ') || 'none'}`);
  lines.push(`  ${chalk.dim('Hosting:')}    ${profile.hosting.join(', ') || 'unknown'}`);
  lines.push(`  ${chalk.dim('Domain:')}     ${profile.projectType}`);
  lines.push('\n  ' + chalk.green('✓ Project classified') + '\n');
  return lines.join('\n');
}
