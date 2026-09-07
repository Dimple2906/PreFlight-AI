#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { runDeployEngine, generateMarkdownReport } from './deploy/engine';
import { EngineReport } from './types';

/**
 * PreFlight AI CLI Entrypoint
 * Command usage:
 *   preflight [deploy] [path] [--json] [--output=<file>] [--skip-build]
 *
 * Exit codes:
 *   0 = Deployment Ready (all critical/high checks passed)
 *   1 = Deployment Blocked (blocked by deterministic check failures)
 *   2 = Engine/Runtime error or invalid invocation
 */
export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const args = argv;

  // Safely populate GEMINI_API_KEY from .env if not already set in process.env
  if (!process.env.GEMINI_API_KEY && fs.existsSync('.env')) {
    try {
      const envLines = fs.readFileSync('.env', 'utf-8').split('\n');
      for (const line of envLines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('GEMINI_API_KEY=')) {
          process.env.GEMINI_API_KEY = trimmed.substring('GEMINI_API_KEY='.length).trim();
          break;
        }
      }
    } catch {
      // Ignore reading errors
    }
  }

  // Flags parsing
  const isJson = args.includes('--json');
  const skipBuild = args.includes('--skip-build');
  const noAi = args.includes('--no-ai');
  const helpFlag = args.includes('--help') || args.includes('-h');

  let outputFile: string | null = null;
  const outputArg = args.find((a) => a.startsWith('--output=') || a.startsWith('-o='));
  if (outputArg) {
    outputFile = outputArg.split('=')[1];
  } else {
    const outputIdx = args.findIndex((a) => a === '--output' || a === '-o');
    if (outputIdx !== -1 && args[outputIdx + 1] && !args[outputIdx + 1].startsWith('-')) {
      outputFile = args[outputIdx + 1];
    }
  }

  // Help command
  if (helpFlag) {
    if (!isJson) {
      console.log(`
PreFlight AI — Deployment Safety CLI

Usage:
  preflight [command] [path] [options]

Commands:
  deploy [path]     Run preflight deployment safety checks on target repository (default: current directory)
  check  [path]     Alias for deploy

Options:
  --json            Output machine-readable EngineReport JSON only
  --output=<file>   Generate and save a Markdown deployment safety report to file
  --skip-build      Skip executing project build command
  --no-ai           Disable Gemini AI root-cause analysis
  --help, -h        Show this help message

Exit codes:
  0: Deployment Ready
  1: Deployment Blocked (critical/high check failure)
  2: Internal error or invalid arguments
`);
    }
    return 0;
  }

  // Positionals (command, path)
  const nonFlags = args.filter((a) => !a.startsWith('-'));
  let command = 'deploy';
  let targetPath = '.';

  if (nonFlags.length > 0) {
    if (['deploy', 'check', 'run'].includes(nonFlags[0])) {
      command = nonFlags[0];
      if (nonFlags[1]) {
        targetPath = nonFlags[1];
      }
    } else {
      targetPath = nonFlags[0];
    }
  }

  const resolvedRoot = path.resolve(targetPath);

  try {
    const report: EngineReport = await runDeployEngine(resolvedRoot, {
      skipBuildCommand: skipBuild,
      enableAiAnalysis: !noAi,
    });

    // Write Markdown report if requested
    if (outputFile) {
      try {
        const mdContent = generateMarkdownReport(report);
        const resolvedOut = path.resolve(outputFile);
        fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
        fs.writeFileSync(resolvedOut, mdContent, 'utf-8');
      } catch (err: any) {
        if (!isJson) {
          console.error(`Warning: Failed to write report file to ${outputFile}: ${err?.message || err}`);
        }
      }
    }

    // Output JSON mode
    if (isJson) {
      console.log(JSON.stringify(report, null, 2));
      if (report.status === 'ERROR') {
        return 2;
      }
      return report.summary.deploymentReady ? 0 : 1;
    }

    // Human-Readable Console Output Mode
    renderHumanOutput(report);

    if (report.status === 'ERROR') {
      return 2;
    }
    return report.summary.deploymentReady ? 0 : 1;
  } catch (err: any) {
    if (isJson) {
      console.log(
        JSON.stringify(
          {
            status: 'ERROR',
            error: err?.message || String(err),
            deploymentReady: false,
          },
          null,
          2
        )
      );
    } else {
      console.error(`\n[FATAL ERROR] PreFlight CLI failed to execute: ${err?.message || String(err)}`);
    }
    return 2;
  }
}

function formatRuntime(runtime?: { name?: string; version?: string }): string {
  if (!runtime || !runtime.name || runtime.name === 'Unknown') {
    return 'Unknown';
  }
  if (!runtime.version || runtime.version === 'UNKNOWN' || runtime.version.trim() === '') {
    return runtime.name;
  }
  return `${runtime.name} (${runtime.version})`;
}

/**
 * Clean terminal presenter (pure presentation, no business logic)
 */
function renderHumanOutput(report: EngineReport) {
  const root = report.discovery?.rootProject;
  const isMonorepo = report.discovery?.summary?.isMonorepo;
  const subProjects = report.discovery?.subProjects || [];
  const isRootApp = root?.identity?.hasPackageJson;

  console.log('================================================================================');
  console.log('                       PREFLIGHT AI - DEPLOYMENT SAFETY REPORT                  ');
  console.log('================================================================================');
  console.log(`Repository:      ${report.rootPath}`);

  if (isMonorepo) {
    console.log(`Structure:       Monorepo / Multi-project workspace (${report.discovery.summary.totalApplications} applications)`);
    if (isRootApp) {
      const fw = root?.frameworks?.frameworks?.map((f) => f.name).join(', ') || 'Unknown';
      const runtime = formatRuntime(root?.runtime);
      const pm = root?.packageManager?.packageManager || 'unknown';
      const hosting = root?.hosting?.hosting?.map((h) => h.name).join(', ') || 'Unknown';
      const pType = root?.projectType?.primaryType || 'unknown';
      console.log(`Root App:        ${root?.identity?.name} [${pType} | ${fw} | ${runtime} | ${pm} | ${hosting}]`);
    } else {
      console.log(`Root Container:  No root package.json (workspace container)`);
    }
    console.log('Discovered Applications:');
    for (const sub of subProjects) {
      const sFw = sub.frameworks?.frameworks?.map((f) => f.name).join(', ') || 'Unknown';
      const sRuntime = formatRuntime(sub.runtime);
      const sPm = sub.packageManager?.packageManager || 'unknown';
      const sHosting = sub.hosting?.hosting?.map((h) => h.name).join(', ') || 'Unknown';
      const sType = sub.projectType?.primaryType || 'unknown';
      console.log(`  • ${sub.identity.name} (${sub.identity.rootPath})`);
      console.log(`    Type: ${sType} | Framework: ${sFw} | Runtime: ${sRuntime} | PM: ${sPm} | Hosting: ${sHosting}`);
    }
  } else {
    const fw = root?.frameworks?.frameworks?.map((f) => f.name).join(', ') || 'Unknown';
    const runtime = formatRuntime(root?.runtime);
    const pm = root?.packageManager?.packageManager || 'unknown';
    const hosting = root?.hosting?.hosting?.map((h) => h.name).join(', ') || 'Unknown';
    const pType = root?.projectType?.primaryType || 'unknown';

    console.log(`Project Type:    ${pType}`);
    console.log(`Framework:       ${fw}`);
    console.log(`Runtime:         ${runtime}`);
    console.log(`Package Manager: ${pm}`);
    console.log(`Hosting Target:  ${hosting}`);
  }

  const aiStatus = report.aiAnalysis?.status || 'UNAVAILABLE';
  console.log(`AI Analysis:     ${aiStatus === 'AVAILABLE' ? 'Available (Gemini)' : 'Unavailable'}`);
  console.log('--------------------------------------------------------------------------------');

  // Summary counts
  const s = report.summary;
  console.log('CHECKS SUMMARY:');
  console.log(`  Total Checks Evaluated: ${s.total}`);
  console.log(`  [PASS]    Passed:   ${s.passed}`);
  console.log(`  [FAIL]    Failed:   ${s.failed}`);
  console.log(`  [WARN]    Warnings: ${s.warnings}`);
  console.log(`  [SKIP]    Skipped:  ${s.skipped}`);
  console.log(`  [ERROR]   Errors:   ${s.errors}`);
  console.log('--------------------------------------------------------------------------------');

  // Failed checks and blockers
  const failures = report.checks.filter((c) => c.status === 'FAIL' || c.status === 'ERROR');
  if (failures.length > 0) {
    console.log('FAILED CHECKS & REMEDIATION:');
    for (const f of failures) {
      console.log(`\n  • [${f.severity}] [${f.status}] ${f.checkId}: ${f.name}`);
      console.log(`    Why: ${f.message}`);
      if (f.subProjectName && f.subProjectName !== root?.identity?.name) {
        console.log(`    Sub-project: ${f.subProjectName}`);
      }
      if (f.evidence && f.evidence.length > 0) {
        for (const ev of f.evidence.slice(0, 3)) {
          console.log(`    Evidence: ${ev}`);
        }
      }
      if (f.remediation) {
        console.log(`    Fix: ${f.remediation.summary}`);
        if (f.remediation.steps && f.remediation.steps.length > 0) {
          console.log(`    Step: ${f.remediation.steps[0]}`);
        }
      }
      if (f.aiAnalysis) {
        console.log(`    [AI Root Cause]: ${f.aiAnalysis.rootCause}`);
        console.log(`    [AI Risk]:       ${f.aiAnalysis.risk}`);
        console.log(`    [AI Guidance]:   ${f.aiAnalysis.remediation}`);
      }
    }
    console.log('--------------------------------------------------------------------------------');
  }

  // Warnings requiring operational review (non-blocking)
  const warnings = report.checks.filter((c) => c.status === 'WARN');
  if (warnings.length > 0) {
    console.log('WARNINGS & OPERATIONAL REVIEW:');
    for (const w of warnings) {
      console.log(`\n  • [${w.severity}] [WARN] ${w.checkId}: ${w.name}`);
      console.log(`    Why: ${w.message}`);
      if (w.subProjectName && w.subProjectName !== root?.identity?.name) {
        console.log(`    Sub-project: ${w.subProjectName}`);
      }
      if (w.evidence && w.evidence.length > 0) {
        for (const ev of w.evidence.slice(0, 3)) {
          console.log(`    Evidence: ${ev}`);
        }
      }
      if (w.remediation) {
        console.log(`    Guidance: ${w.remediation.summary}`);
        if (w.remediation.guidance) {
          console.log(`    Risk: ${w.remediation.guidance}`);
        }
        if (w.remediation.steps && w.remediation.steps.length > 0) {
          console.log(`    Step: ${w.remediation.steps[0]}`);
        }
      }
      if (w.aiAnalysis) {
        console.log(`    [AI Root Cause]: ${w.aiAnalysis.rootCause}`);
        console.log(`    [AI Risk]:       ${w.aiAnalysis.risk}`);
        console.log(`    [AI Guidance]:   ${w.aiAnalysis.remediation}`);
      }
    }
    console.log('--------------------------------------------------------------------------------');
  }

  // Deployment Readiness Verdict
  if (s.deploymentReady) {
    console.log('VERDICT: [DEPLOYMENT READY]');
    console.log('All critical deployment safety checks passed.');
    console.log(`Completed in ${report.durationMs}ms`);
  } else {
    console.log('VERDICT: [DEPLOYMENT BLOCKED]');
    console.log(`Deployment is blocked due to ${s.critical} CRITICAL / ${s.high} HIGH severity failures.`);
    if (s.blockers.length > 0) {
      console.log('Blockers:');
      for (const b of s.blockers) {
        console.log(`  - ${b}`);
      }
    }
  }
  console.log('================================================================================\n');
}

// Run CLI directly if executed as main
if (require.main === module) {
  main().then((code) => {
    process.exit(code);
  });
}
