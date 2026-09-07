import { DiscoveryResult, RepositoryDeploymentProfile, UnitDeploymentProfile } from '../../types';
import { composeRepositoryProfile } from './composer';

/**
 * Main entry point for Phase 2 Deployment Classification.
 * Consumes the Phase 1 DiscoveryResult and produces a complete RepositoryDeploymentProfile.
 */
export function classifyDeployment(discoveryResult: DiscoveryResult): RepositoryDeploymentProfile {
  return composeRepositoryProfile(discoveryResult);
}

/**
 * Formats a RepositoryDeploymentProfile into a human-readable CLI summary table.
 */
export function formatDeploymentProfileReport(profile: RepositoryDeploymentProfile): string {
  const lines: string[] = [];

  lines.push('================================================================================');
  lines.push('                   PREFLIGHT AI - DEPLOYMENT CLASSIFICATION                    ');
  lines.push('================================================================================');
  lines.push(`Total Applications: ${profile.summary.totalApplications} | Monorepo: ${profile.summary.isMonorepo ? 'YES' : 'NO'}`);
  lines.push(`Total Repository Unique Checks: ${profile.summary.totalUniqueChecks}`);
  lines.push('--------------------------------------------------------------------------------');

  const formatUnit = (unit: UnitDeploymentProfile, label: string) => {
    lines.push(`\n[${label}] ${unit.projectName} (${unit.projectRoot})`);
    lines.push(`  Target Status:        ${unit.targetStatus}`);
    if (unit.deploymentTargets && unit.deploymentTargets.length > 0) {
      lines.push(`  Deployment Targets:   ${unit.deploymentTargets.map((t) => `${t.name} (${t.applicableChecks.length} checks)`).join(', ')}`);
    }
    lines.push(`  Applicable Domains:   ${unit.applicableDomains.join(', ')}`);
    lines.push(`  Inapplicable Domains: ${unit.inapplicableDomains.join(', ')}`);
    lines.push(`  Checks: Minimum: ${unit.summary.minimumCheckCount} | Complete: ${unit.summary.completeCheckCount}`);
    lines.push(
      `  Automation: Automatic: ${unit.summary.automaticCount} | Partial: ${unit.summary.partiallyAutomaticCount} | Manual: ${unit.summary.manualCount}`
    );
    lines.push(
      `  Severities: CRITICAL: ${unit.summary.bySeverity.CRITICAL} | HIGH: ${unit.summary.bySeverity.HIGH} | MEDIUM: ${unit.summary.bySeverity.MEDIUM} | LOW: ${unit.summary.bySeverity.LOW} | INFO: ${unit.summary.bySeverity.INFO}`
    );

    lines.push('  Groups & Checks:');
    for (const group of unit.groups) {
      lines.push(`    • [${group.layer}] ${group.name} (${group.checks.length} checks)`);
      for (const item of group.checks) {
        const auto = item.check.automationLevel[0];
        const sev = item.check.severity.padEnd(8);
        const level = item.check.profileLevel === 'MINIMUM' ? '[MIN]' : '[ALL]';
        lines.push(`        - ${level} [${sev}] [${auto}] ${item.check.id}: ${item.check.name}`);
        lines.push(`            Reason: ${item.reason}`);
        if (item.sourceCheckIds && item.sourceCheckIds.length > 1) {
          lines.push(`            Merged IDs: [${item.sourceCheckIds.join(', ')}]`);
        }
      }
    }
  };

  formatUnit(profile.rootProfile, 'ROOT PROJECT');

  for (let i = 0; i < profile.subProjectProfiles.length; i++) {
    formatUnit(profile.subProjectProfiles[i], `SUB-PROJECT #${i + 1}`);
  }

  lines.push('\n================================================================================');
  return lines.join('\n');
}
