import { ApplicableCheck, AutomationLevel, CheckSeverity } from '../../types';

const SEVERITY_RANK: Record<CheckSeverity, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

const AUTOMATION_RANK: Record<AutomationLevel, number> = {
  AUTOMATIC: 3,
  PARTIALLY_AUTOMATIC: 2,
  MANUAL: 1,
};

/**
 * Deduplicates overlapping checks using dedupKey and exact check ID matching.
 *
 * When multiple checks share the same canonical dedupKey:
 * - Collapses into one canonical check
 * - Merges evidence, reasons, and matched technologies
 * - Preserves all sourceCheckIds
 * - Retains highest severity
 * - Retains strongest automation classification (AUTOMATIC > PARTIALLY_AUTOMATIC > MANUAL)
 * - Deterministic output
 */
export function deduplicateChecks(applicableChecks: ApplicableCheck[]): ApplicableCheck[] {
  const dedupMap = new Map<string, ApplicableCheck>();

  for (const item of applicableChecks) {
    const key = item.check.dedupKey || item.check.id;

    if (dedupMap.has(key)) {
      const canonical = dedupMap.get(key)!;

      // Merge source IDs
      const sourceIds = new Set<string>(canonical.sourceCheckIds || [canonical.check.id]);
      sourceIds.add(item.check.id);
      if (item.sourceCheckIds) {
        for (const id of item.sourceCheckIds) sourceIds.add(id);
      }
      canonical.sourceCheckIds = Array.from(sourceIds);

      // Merge evidence
      canonical.evidence = Array.from(new Set([...canonical.evidence, ...item.evidence]));

      // Merge matched technologies
      canonical.matchedTechnologies = Array.from(
        new Set([...canonical.matchedTechnologies, ...item.matchedTechnologies])
      );

      // Merge reasons
      if (!canonical.reason.includes(item.reason)) {
        canonical.reason = `${canonical.reason}; ${item.reason}`;
      }

      // Preserve highest severity
      const currentSevRank = SEVERITY_RANK[canonical.check.severity] || 0;
      const incomingSevRank = SEVERITY_RANK[item.check.severity] || 0;
      if (incomingSevRank > currentSevRank) {
        canonical.check = {
          ...canonical.check,
          severity: item.check.severity,
        };
      }

      // Preserve strongest automation classification
      const currentAutoRank = AUTOMATION_RANK[canonical.check.automationLevel] || 0;
      const incomingAutoRank = AUTOMATION_RANK[item.check.automationLevel] || 0;
      if (incomingAutoRank > currentAutoRank) {
        canonical.check = {
          ...canonical.check,
          automationLevel: item.check.automationLevel,
        };
      }

      continue;
    }

    dedupMap.set(key, {
      check: { ...item.check },
      applicable: item.applicable,
      reason: item.reason,
      matchedTechnologies: [...item.matchedTechnologies],
      evidence: [...item.evidence],
      sourceCheckIds: [item.check.id],
    });
  }

  return Array.from(dedupMap.values());
}
