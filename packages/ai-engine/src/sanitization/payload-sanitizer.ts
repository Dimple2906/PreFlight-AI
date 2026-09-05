import { SecretSanitizer } from '@preflight/security';
import { ProjectProfile, ExecutionResult } from '@preflight/core';

export class PayloadSanitizer {
  private secretSanitizer: SecretSanitizer;

  constructor(secretSanitizer?: SecretSanitizer) {
    this.secretSanitizer = secretSanitizer || new SecretSanitizer();
  }

  public sanitizeProfile(profile: ProjectProfile): Record<string, unknown> {
    return {
      name: profile.name,
      languages: profile.languages,
      frameworks: profile.frameworks,
      runtime: profile.runtime,
      databases: profile.databases,
      architecture: profile.architecture,
      projectType: profile.projectType,
      hosting: profile.hosting,
      packageManager: profile.packageManager,
      hasDockerfile: profile.hasDockerfile,
      hasCIConfig: profile.hasCIConfig,
      domainSignals: profile.domainSignals,
      dependenciesCount: Object.keys(profile.dependencies || {}).length,
      devDependenciesCount: Object.keys(profile.devDependencies || {}).length
    };
  }

  public sanitizeResults(results: ExecutionResult[]): Record<string, unknown>[] {
    return results.map(res => ({
      id: res.id,
      targetId: res.targetId,
      name: res.name,
      type: res.type,
      status: res.status,
      severity: res.severity,
      durationMs: res.durationMs,
      explanation: this.secretSanitizer.sanitize(res.explanation).sanitizedText,
      evidence: {
        command: res.evidence.command,
        exitCode: res.evidence.exitCode,
        stdoutSnippet: this.secretSanitizer.sanitize(res.evidence.stdout.slice(0, 300)).sanitizedText,
        stderrSnippet: this.secretSanitizer.sanitize(res.evidence.stderr.slice(0, 300)).sanitizedText
      }
    }));
  }
}
