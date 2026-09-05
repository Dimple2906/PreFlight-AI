import fg from 'fast-glob';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DeployCheck } from '../../registry/base-check.js';
import { DeployExecutionContext } from '../../context/deploy-context.js';
import { ProjectProfile, ExecutionResult } from '@preflight/core';

export class DeploySecrets001StaticSecretScan extends DeployCheck {
  public readonly id = 'DEPLOY-SECRETS-001';
  public readonly name = 'Static Source Secret & Credential Scanner';
  public readonly category = 'secrets';
  public readonly purpose = 'Scan local source code files for hardcoded API keys, private keys, or tokens before deployment';
  public readonly severity = 'CRITICAL' as const;
  public readonly remediation = 'Remove hardcoded credentials from source code and load via environment variables.';

  public isApplicable(profile: ProjectProfile): boolean {
    return true;
  }

  public async execute(ctx: DeployExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    const sourceFiles = await fg(['src/**/*.{ts,js,jsx,tsx,json}', 'lib/**/*.{ts,js}', 'config/**/*.{ts,js}'], {
      cwd: ctx.projectRoot,
      ignore: ['**/node_modules/**', '**/dist/**']
    });

    const secretPatterns = [
      { name: 'AWS Access Key ID', regex: /AKIA[0-9A-Z]{16}/g },
      { name: 'OpenAI API Key', regex: /sk-[A-Za-z0-9]{32,64}/g },
      { name: 'Gemini API Key', regex: /AIzaSy[A-Za-z0-9_-]{33}/g },
      { name: 'Private Key Block', regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g }
    ];

    const findingsDetails: string[] = [];

    for (const relFile of sourceFiles) {
      const fullPath = path.join(ctx.projectRoot, relFile);
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          for (const pat of secretPatterns) {
            if (pat.regex.test(line)) {
              findingsDetails.push(`File: ${relFile}\nLine: ${i + 1}\nType: ${pat.name}\nValue: [REDACTED]`);
            }
          }
        }
      } catch (err) {
        // Skip unreadable files
      }
    }

    const durationMs = Date.now() - startTime;

    if (findingsDetails.length > 0) {
      return this.createResult(
        'FAIL',
        durationMs,
        `Static secret scan detected ${findingsDetails.length} potential hardcoded credential pattern(s).`,
        findingsDetails.join('\n\n'),
        'Critical security defect: Hardcoded credentials detected in source code.'
      );
    }

    return this.createResult(
      'PASS',
      durationMs,
      'Static secret scan complete. 0 hardcoded credentials detected in source code.',
      'Scanned source files: 0 secret patterns matched.',
      ''
    );
  }
}
