import Table from 'cli-table3';
import chalk from 'chalk';
import { FinalReport, PreflightStatus, ExecutionResult } from '@preflight/core';
import { globalSanitizer } from '@preflight/security';

export class ReportEngine {
  /**
   * Determine standardized final verdict label
   */
  public getVerdictCode(mode: 'test' | 'deploy', status: PreflightStatus): string {
    if (mode === 'test') {
      switch (status) {
        case 'PASS':
          return '🟢 PREFLIGHT PASSED';
        case 'WARN':
          return '🟡 PREFLIGHT PASSED WITH WARNINGS';
        case 'FAIL':
        case 'ERROR':
        default:
          return '🔴 PREFLIGHT FAILED';
      }
    } else {
      switch (status) {
        case 'PASS':
          return '🟢 GO';
        case 'WARN':
          return '🟡 GO WITH WARNINGS';
        case 'FAIL':
        case 'ERROR':
        default:
          return '🔴 NO-GO';
      }
    }
  }

  /**
   * Render machine-readable JSON (stable v1.0 schema specified in spec)
   */
  public renderJson(report: FinalReport): string {
    const verdictCode = this.getVerdictCode(report.mode, report.overallStatus);

    const findings = report.results.flatMap((res) =>
      (res.findings || []).map((f) => ({
        id: f.id,
        title: globalSanitizer.sanitize(f.title).sanitizedText,
        description: globalSanitizer.sanitize(f.description).sanitizedText,
        severity: f.severity,
        status: f.status,
        location: f.location || undefined,
        remediation: f.remediation ? globalSanitizer.sanitize(f.remediation).sanitizedText : undefined
      }))
    );

    const evidenceList = report.results.map((res) => ({
      testId: res.targetId || res.id,
      name: res.name,
      status: res.status,
      durationMs: res.durationMs,
      command: res.evidence.command ? globalSanitizer.sanitize(res.evidence.command).sanitizedText : undefined,
      exitCode: res.evidence.exitCode,
      stdout: globalSanitizer.sanitize(res.evidence.stdout || '').sanitizedText,
      stderr: globalSanitizer.sanitize(res.evidence.stderr || '').sanitizedText
    }));

    const results = report.results.map((res) => {
      const rca = report.aiAnalysis?.rootCauseAnalyses?.find(
        (r) => r.resultId === res.id || r.resultId === res.targetId
      );

      return {
        id: res.targetId || res.id,
        name: res.name,
        purpose: res.explanation,
        type: res.type,
        status: res.status,
        severity: res.severity,
        durationMs: res.durationMs,
        provenance: res.provenance || 'initial',
        evidence: {
          command: res.evidence.command ? globalSanitizer.sanitize(res.evidence.command).sanitizedText : undefined,
          stdout: globalSanitizer.sanitize(res.evidence.stdout || '').sanitizedText,
          stderr: globalSanitizer.sanitize(res.evidence.stderr || '').sanitizedText,
          exitCode: res.evidence.exitCode
        },
        risk: res.findings && res.findings.length > 0
          ? res.findings[0].description
          : `Potential failure under ${res.severity.toLowerCase()} severity scenarios`,
        aiAnalysis: rca
          ? {
              possibleRootCause: globalSanitizer.sanitize(rca.possibleRootCause).sanitizedText,
              confidence: rca.confidence,
              suggestedFix: globalSanitizer.sanitize(rca.suggestedFix).sanitizedText
            }
          : undefined,
        remediation: res.remediation ? globalSanitizer.sanitize(res.remediation).sanitizedText : undefined
      };
    });

    const aiAnalysis = report.aiAnalysis;
    const isAiEnabled = Boolean(aiAnalysis);

    const jsonPayload = {
      version: '1.0',
      project: {
        name: report.projectProfile.name,
        rootPath: report.projectProfile.rootPath,
        projectType: report.projectProfile.projectType,
        languages: report.projectProfile.languages,
        frameworks: report.projectProfile.frameworks,
        runtime: report.projectProfile.runtime,
        databases: report.projectProfile.databases,
        hosting: report.projectProfile.hosting,
        packageManager: report.projectProfile.packageManager,
        domainSignals: report.projectProfile.domainSignals
      },
      ai: {
        enabled: isAiEnabled,
        provider: aiAnalysis?.provider || 'mock',
        status: aiAnalysis?.status || (isAiEnabled ? 'available' : 'disabled')
      },
      riskAnalysis: aiAnalysis?.riskAnalysis || {
        summary: 'Deterministic testing only (no AI risk analysis)',
        detectedArchitectureRisk: 'N/A',
        riskSignals: [],
        recommendedTestingStrategy: []
      },
      testPlan: aiAnalysis?.testPlan || [],
      results,
      tests: results,
      aiRecommendations: (aiAnalysis?.coverageGaps || []).map((gap) => ({
        id: gap.id,
        area: gap.area,
        description: globalSanitizer.sanitize(gap.description).sanitizedText,
        severity: gap.severity,
        recommendedAction: globalSanitizer.sanitize(gap.recommendedAction).sanitizedText
      })),
      evidence: evidenceList,
      findings,
      summary: {
        total: report.stats.total,
        passed: report.stats.passed,
        failed: report.stats.failed,
        warned: report.stats.warned,
        skipped: report.stats.skipped,
        errored: report.stats.errored,
        durationMs: report.stats.durationMs
      },
      verdict: {
        mode: report.mode,
        status: report.overallStatus,
        code: verdictCode,
        passed: report.overallStatus === 'PASS' || report.overallStatus === 'WARN'
      }
    };

    return JSON.stringify(jsonPayload, null, 2);
  }

  /**
   * Render human-readable Terminal output
   */
  public renderTerminal(report: FinalReport): string {
    const lines: string[] = [];
    const verdictCode = this.getVerdictCode(report.mode, report.overallStatus);

    // Header banner
    lines.push('\n' + chalk.bold.cyan('==========================================================='));
    lines.push(chalk.bold.white(`  PREFLIGHT AI - ${report.mode.toUpperCase()} READINESS REPORT`));
    lines.push(chalk.bold.cyan('==========================================================='));

    // Verdict Banner
    lines.push(`\n  VERDICT: ${chalk.bold(verdictCode)}`);
    lines.push(`  Target Project:  ${chalk.bold(report.projectProfile.name)}`);
    lines.push(`  Project Type:    ${report.projectProfile.projectType} (${report.projectProfile.languages.join(', ')})`);
    lines.push(`  Frameworks:      ${report.projectProfile.frameworks.join(', ') || 'None'}`);
    lines.push(`  Runtime:         ${report.projectProfile.runtime}`);
    lines.push(`  Duration:        ${report.stats.durationMs}ms`);

    // AI Status & Risk Analysis Section
    if (report.aiAnalysis) {
      lines.push('\n' + chalk.bold.magenta('───────────────────────────────────────────────────────────'));
      lines.push(chalk.bold.magenta(`  AI REASONING LAYER [Provider: ${(report.aiAnalysis.provider || 'gemini').toUpperCase()}]`));
      lines.push(chalk.bold.magenta('───────────────────────────────────────────────────────────'));

      if (report.aiAnalysis.riskAnalysis) {
        lines.push(chalk.bold.white('  Risk Analysis:'));
        lines.push(chalk.gray(`  Summary: ${globalSanitizer.sanitize(report.aiAnalysis.riskAnalysis.summary).sanitizedText}`));
        if (report.aiAnalysis.riskAnalysis.riskSignals?.length > 0) {
          lines.push(chalk.dim(`  Identified Signals: ${report.aiAnalysis.riskAnalysis.riskSignals.join(' | ')}`));
        }
      }

      if (report.aiAnalysis.testPlan && report.aiAnalysis.testPlan.length > 0) {
        lines.push(chalk.bold.white('\n  AI Proposed Test Scenarios:'));
        for (const item of report.aiAnalysis.testPlan) {
          const badge = item.status === 'APPROVED' ? chalk.green('✓ APPROVED') : chalk.gray('○ SKIPPED');
          lines.push(`   ${badge} [${item.category}] ${item.title}`);
          if (item.skipReason) {
            lines.push(chalk.dim(`     Reason: ${item.skipReason}`));
          }
        }
      }
    }

    // Results Table
    const table = new Table({
      head: [chalk.cyan('Status'), chalk.cyan('Target Name'), chalk.cyan('Type'), chalk.cyan('Severity'), chalk.cyan('Duration')],
      colWidths: [10, 34, 10, 12, 12]
    });

    for (const res of report.results) {
      table.push([
        this.formatStatusBadge(res.status),
        res.name,
        res.type,
        this.formatSeverity(res.severity),
        `${res.durationMs}ms`
      ]);
    }

    lines.push('\n' + chalk.bold('Execution Results:'));
    lines.push(table.toString());

    // Failed Test Detail Section
    const failedResults = report.results.filter(
      (r) => r.status === 'FAIL' || r.status === 'ERROR' || r.status === 'WARN'
    );

    if (failedResults.length > 0) {
      lines.push('\n' + chalk.bold.red('───────────────────────────────────────────────────────────'));
      lines.push(chalk.bold.red('  FAILED TEST / CHECK DETAILS'));
      lines.push(chalk.bold.red('───────────────────────────────────────────────────────────'));

      for (const fail of failedResults) {
        const rca = report.aiAnalysis?.rootCauseAnalyses?.find(
          (r) => r.resultId === fail.id || r.resultId === fail.targetId
        );

        lines.push(`\n  ${chalk.bold.white('Name:')}         ${fail.name}`);
        lines.push(`  ${chalk.bold.white('Purpose:')}      ${fail.explanation}`);
        lines.push(`  ${chalk.bold.white('Status:')}       ${this.formatStatusBadge(fail.status)}`);
        lines.push(`  ${chalk.bold.white('Duration:')}     ${fail.durationMs}ms`);
        lines.push(`  ${chalk.bold.white('Severity:')}     ${this.formatSeverity(fail.severity)}`);

        if (fail.evidence) {
          const sanitizedEv = globalSanitizer.sanitize(
            fail.evidence.command ? `$ ${fail.evidence.command}\n${fail.evidence.stdout || fail.evidence.stderr}` : fail.evidence.stdout || fail.evidence.stderr
          ).sanitizedText;
          const snippet = sanitizedEv.split('\n').slice(0, 4).join('\n  │ ');
          lines.push(`  ${chalk.bold.white('Evidence:')}\n  │ ${snippet}`);
        }

        const risk = fail.findings && fail.findings.length > 0
          ? fail.findings[0].description
          : `High potential for runtime/production vulnerability (${fail.severity})`;
        lines.push(`  ${chalk.bold.white('Risk:')}         ${chalk.yellow(risk)}`);

        if (rca) {
          lines.push(`  ${chalk.bold.white('AI Analysis:')}  ${chalk.magenta(`[${rca.confidence}] ${globalSanitizer.sanitize(rca.possibleRootCause).sanitizedText}`)}`);
          lines.push(`  ${chalk.bold.white('Suggested Fix:')} ${chalk.green(globalSanitizer.sanitize(rca.suggestedFix).sanitizedText)}`);
        } else if (fail.remediation) {
          lines.push(`  ${chalk.bold.white('Suggested Fix:')} ${chalk.green(globalSanitizer.sanitize(fail.remediation).sanitizedText)}`);
        }
      }
    }

    // AI Gap Analysis section
    if (report.aiAnalysis && report.aiAnalysis.coverageGaps && report.aiAnalysis.coverageGaps.length > 0) {
      lines.push('\n' + chalk.bold.yellow('───────────────────────────────────────────────────────────'));
      lines.push(chalk.bold.yellow('  AI COVERAGE GAP ANALYSIS'));
      lines.push(chalk.bold.yellow('───────────────────────────────────────────────────────────'));

      for (const gap of report.aiAnalysis.coverageGaps) {
        lines.push(`   * [${gap.severity}] ${gap.area}: ${globalSanitizer.sanitize(gap.description).sanitizedText}`);
        lines.push(chalk.dim(`     Action: ${globalSanitizer.sanitize(gap.recommendedAction).sanitizedText}`));
      }
    }

    // Summary line
    lines.push('\n' + chalk.bold.cyan('-----------------------------------------------------------'));
    lines.push(chalk.bold(`Summary: ${report.stats.passed} Passed | ${report.stats.failed} Failed | ${report.stats.warned} Warned | ${report.stats.skipped} Skipped`));
    lines.push(chalk.bold(`Verdict: ${verdictCode}`));
    lines.push(chalk.bold.cyan('-----------------------------------------------------------\n'));

    return lines.join('\n');
  }

  /**
   * Render GitHub-flavored Markdown report (`--report report.md`)
   */
  public renderMarkdown(report: FinalReport): string {
    const verdictCode = this.getVerdictCode(report.mode, report.overallStatus);
    const md: string[] = [];

    md.push(`# PreFlight AI Report`);
    md.push(``);
    md.push(`**Mode**: \`${report.mode.toUpperCase()}\`  `);
    md.push(`**Final Verdict**: **${verdictCode}**  `);
    md.push(`**Generated At**: \`${report.generatedAt}\`  `);
    md.push(``);

    md.push(`## Project Summary`);
    md.push(`| Property | Value |`);
    md.push(`| --- | --- |`);
    md.push(`| **Name** | ${report.projectProfile.name} |`);
    md.push(`| **Type** | ${report.projectProfile.projectType} |`);
    md.push(`| **Languages** | ${report.projectProfile.languages.join(', ')} |`);
    md.push(`| **Frameworks** | ${report.projectProfile.frameworks.join(', ') || 'None'} |`);
    md.push(`| **Runtime** | ${report.projectProfile.runtime} |`);
    md.push(`| **Databases** | ${report.projectProfile.databases.join(', ') || 'None'} |`);
    md.push(`| **Hosting** | ${report.projectProfile.hosting.join(', ') || 'Generic'} |`);
    md.push(`| **Package Manager** | ${report.projectProfile.packageManager} |`);
    md.push(``);

    md.push(`## Classification`);
    md.push(`- **Domain Signals**: ${report.projectProfile.domainSignals?.join(', ') || 'Standard Web Application'}`);
    md.push(`- **Has Docker**: \`${report.projectProfile.hasDockerfile}\``);
    md.push(`- **Has CI/CD**: \`${report.projectProfile.hasCIConfig}\``);
    md.push(``);

    if (report.aiAnalysis?.riskAnalysis) {
      md.push(`## AI Risk Analysis`);
      md.push(`> ${globalSanitizer.sanitize(report.aiAnalysis.riskAnalysis.summary).sanitizedText}`);
      md.push(``);
      if (report.aiAnalysis.riskAnalysis.riskSignals?.length > 0) {
        md.push(`- **Risk Signals**: ${report.aiAnalysis.riskAnalysis.riskSignals.join(', ')}`);
      }
      md.push(``);
    }

    if (report.aiAnalysis?.testPlan && report.aiAnalysis.testPlan.length > 0) {
      md.push(`## AI Test Plan`);
      md.push(`| Status | Category | Title | Objective |`);
      md.push(`| --- | --- | --- | --- |`);
      for (const item of report.aiAnalysis.testPlan) {
        md.push(`| \`${item.status}\` | ${item.category} | ${item.title} | ${item.objective} |`);
      }
      md.push(``);
    }

    md.push(`## Tests Executed`);
    md.push(`| Status | Target Name | Type | Severity | Duration |`);
    md.push(`| --- | --- | --- | --- | --- |`);
    for (const res of report.results) {
      md.push(`| ${this.formatMdStatus(res.status)} | \`${res.name}\` | \`${res.type}\` | \`${res.severity}\` | ${res.durationMs}ms |`);
    }
    md.push(``);

    md.push(`## Execution Statistics`);
    md.push(`- **Total**: ${report.stats.total}`);
    md.push(`- **Passed**: ${report.stats.passed}`);
    md.push(`- **Failed**: ${report.stats.failed}`);
    md.push(`- **Warnings**: ${report.stats.warned}`);
    md.push(`- **Skipped**: ${report.stats.skipped}`);
    md.push(`- **Duration**: ${report.stats.durationMs}ms`);
    md.push(``);

    const failedResults = report.results.filter(
      (r) => r.status === 'FAIL' || r.status === 'ERROR' || r.status === 'WARN'
    );

    if (failedResults.length > 0) {
      md.push(`## Failed Test Details`);
      for (const fail of failedResults) {
        const rca = report.aiAnalysis?.rootCauseAnalyses?.find(
          (r) => r.resultId === fail.id || r.resultId === fail.targetId
        );

        md.push(`### ${fail.name}`);
        md.push(`- **Purpose**: ${fail.explanation}`);
        md.push(`- **Status**: ${this.formatMdStatus(fail.status)}`);
        md.push(`- **Duration**: ${fail.durationMs}ms`);
        md.push(`- **Severity**: \`${fail.severity}\``);

        const risk = fail.findings && fail.findings.length > 0
          ? fail.findings[0].description
          : `Potential failure under ${fail.severity.toLowerCase()} severity scenarios`;
        md.push(`- **Risk**: ${risk}`);

        if (rca) {
          md.push(`- **AI Analysis**: [${rca.confidence}] ${globalSanitizer.sanitize(rca.possibleRootCause).sanitizedText}`);
          md.push(`- **Suggested Fix**: ${globalSanitizer.sanitize(rca.suggestedFix).sanitizedText}`);
        } else if (fail.remediation) {
          md.push(`- **Suggested Fix**: ${globalSanitizer.sanitize(fail.remediation).sanitizedText}`);
        }

        if (fail.evidence) {
          const evText = globalSanitizer.sanitize(
            fail.evidence.command ? `$ ${fail.evidence.command}\n${fail.evidence.stdout || fail.evidence.stderr}` : fail.evidence.stdout || fail.evidence.stderr
          ).sanitizedText;
          md.push(``);
          md.push(`**Evidence**:`);
          md.push(`\`\`\`text`);
          md.push(evText);
          md.push(`\`\`\``);
        }
        md.push(``);
      }
    }

    if (report.aiAnalysis?.coverageGaps && report.aiAnalysis.coverageGaps.length > 0) {
      md.push(`## AI Analysis & Coverage Gaps`);
      for (const gap of report.aiAnalysis.coverageGaps) {
        md.push(`- **[${gap.severity}] ${gap.area}**: ${globalSanitizer.sanitize(gap.description).sanitizedText}`);
        md.push(`  - *Recommended Action*: ${globalSanitizer.sanitize(gap.recommendedAction).sanitizedText}`);
      }
      md.push(``);
    }

    md.push(`## Final Verdict`);
    md.push(`### ${verdictCode}`);

    return md.join('\n');
  }

  private formatStatusBadge(status: PreflightStatus): string {
    switch (status) {
      case 'PASS':
        return chalk.bgGreen.black.bold(' PASS ');
      case 'FAIL':
        return chalk.bgRed.white.bold(' FAIL ');
      case 'WARN':
        return chalk.bgYellow.black.bold(' WARN ');
      case 'SKIP':
        return chalk.bgGray.white(' SKIP ');
      case 'ERROR':
        return chalk.bgMagenta.white.bold(' ERROR ');
      default:
        return status;
    }
  }

  private formatMdStatus(status: PreflightStatus): string {
    switch (status) {
      case 'PASS':
        return '🟢 `PASS`';
      case 'FAIL':
        return '🔴 `FAIL`';
      case 'WARN':
        return '🟡 `WARN`';
      case 'SKIP':
        return '⚪ `SKIP`';
      case 'ERROR':
        return '🟣 `ERROR`';
      default:
        return `\`${status}\``;
    }
  }

  private formatSeverity(severity: string): string {
    switch (severity.toUpperCase()) {
      case 'CRITICAL':
        return chalk.red.bold('CRITICAL');
      case 'HIGH':
        return chalk.red('HIGH');
      case 'MEDIUM':
        return chalk.yellow('MEDIUM');
      case 'LOW':
        return chalk.blue('LOW');
      case 'INFO':
      default:
        return chalk.gray('INFO');
    }
  }
}
