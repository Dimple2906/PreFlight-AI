import {
  ProjectProfile,
  DiscoveryResult,
  UnitDeploymentProfile,
  RepositoryDeploymentProfile,
  CheckDefinition,
  CheckSeverity,
  ApplicableCheck,
  DeploymentTargetProfile,
  DeploymentTargetStatus,
  DomainApplicabilityDetail,
} from '../../types';
import { DEPLOYMENT_CHECK_REGISTRY } from '../registry/checks';
import { groupChecks } from '../registry/groups';
import { evaluateApplicability } from './applicability';
import { deduplicateChecks } from './deduplication';

/**
 * Composes a UnitDeploymentProfile for an individual application or sub-project.
 */
export function composeUnitProfile(
  project: ProjectProfile,
  isRoot: boolean
): UnitDeploymentProfile {
  // 1. Evaluate applicability for every check in the registry
  const rawEvaluations: ApplicableCheck[] = DEPLOYMENT_CHECK_REGISTRY.map((check) =>
    evaluateApplicability(check, project)
  );

  // 2. Filter applicable checks
  const applicableEvaluations = rawEvaluations.filter((evalResult) => evalResult.applicable);

  // 3. Deduplicate overlapping checks
  const deduplicatedEvaluations = deduplicateChecks(applicableEvaluations);

  // 4. Group checks
  const groups = groupChecks(deduplicatedEvaluations);

  // 5. Build applicable vs inapplicable domains and domain details
  const applicableDomainsSet = new Set<string>();
  const inapplicableDomainsSet = new Set<string>();
  const domainDetails: DomainApplicabilityDetail[] = [];

  for (const evaluation of rawEvaluations) {
    const domain = evaluation.check.domain;
    const subTechnology = evaluation.check.area || evaluation.check.classification;

    domainDetails.push({
      domain,
      subTechnology,
      applicable: evaluation.applicable,
      reason: evaluation.reason,
      evidence: evaluation.evidence,
    });

    if (evaluation.applicable) {
      applicableDomainsSet.add(domain);
      if (evaluation.check.layer === 'UNIVERSAL') {
        applicableDomainsSet.add('universal');
      }
    } else {
      if (!applicableDomainsSet.has(domain)) {
        inapplicableDomainsSet.add(domain);
      }
    }
  }

  // Remove any domain from inapplicable if it is present in applicable
  for (const domain of applicableDomainsSet) {
    inapplicableDomainsSet.delete(domain);
  }

  // 6. Multi-target deployment representation
  const detectedHosting = project.hosting?.hosting || [];
  const validDetectedHosting = detectedHosting.filter((h) => h.name !== 'Unknown');

  let targetStatus: DeploymentTargetStatus = 'UNKNOWN';
  if (validDetectedHosting.length === 1) {
    targetStatus = 'SINGLE_TARGET';
  } else if (validDetectedHosting.length > 1) {
    targetStatus = 'MULTI_TARGET'; // or CONDITIONAL
  }

  const deploymentTargets: DeploymentTargetProfile[] = validDetectedHosting.map((h) => {
    const targetChecks = deduplicatedEvaluations
      .filter(
        (evalItem) =>
          evalItem.check.layer === 'DEPLOYMENT_TARGET' &&
          (evalItem.check.area.toLowerCase().includes(h.name.toLowerCase()) ||
            evalItem.matchedTechnologies.some((tech) => tech.toLowerCase().includes(h.name.toLowerCase())))
      )
      .map((item) => item.check);

    return {
      name: h.name,
      status: targetStatus,
      confidence: h.confidence,
      evidence: h.evidence,
      applicableChecks: targetChecks,
    };
  });

  // 7. Separate MINIMUM vs COMPLETE profiles
  const minimumChecks: CheckDefinition[] = [];
  const completeChecks: CheckDefinition[] = [];

  for (const item of deduplicatedEvaluations) {
    // COMPLETE profile includes everything applicable
    completeChecks.push(item.check);

    // MINIMUM profile includes only profileLevel === 'MINIMUM'
    if (item.check.profileLevel === 'MINIMUM') {
      minimumChecks.push(item.check);
    }
  }

  // 8. Calculate summary counts & severities
  let automaticCount = 0;
  let partiallyAutomaticCount = 0;
  let manualCount = 0;

  const bySeverity: Record<CheckSeverity, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0,
  };

  for (const item of deduplicatedEvaluations) {
    const check = item.check;
    if (check.automationLevel === 'AUTOMATIC') automaticCount++;
    else if (check.automationLevel === 'PARTIALLY_AUTOMATIC') partiallyAutomaticCount++;
    else if (check.automationLevel === 'MANUAL') manualCount++;

    if (bySeverity[check.severity] !== undefined) {
      bySeverity[check.severity]++;
    }
  }

  return {
    projectName: project.identity.name,
    projectRoot: project.identity.rootPath,
    isRoot,
    project,
    applicableDomains: Array.from(applicableDomainsSet).sort(),
    inapplicableDomains: Array.from(inapplicableDomainsSet).sort(),
    domainDetails,
    targetStatus,
    deploymentTargets,
    minimumChecks,
    completeChecks,
    groups,
    summary: {
      totalApplicableChecks: deduplicatedEvaluations.length,
      minimumCheckCount: minimumChecks.length,
      completeCheckCount: completeChecks.length,
      automaticCount,
      partiallyAutomaticCount,
      manualCount,
      bySeverity,
    },
  };
}

/**
 * Composes a RepositoryDeploymentProfile spanning the repository root and any sub-projects.
 */
export function composeRepositoryProfile(
  discovery: DiscoveryResult
): RepositoryDeploymentProfile {
  const rootProfile = composeUnitProfile(discovery.rootProject, true);
  const subProjectProfiles = (discovery.subProjects || []).map((sub) =>
    composeUnitProfile(sub, false)
  );

  // Compute unique checks across the whole repository
  const uniqueCheckIds = new Set<string>();
  for (const check of rootProfile.completeChecks) {
    uniqueCheckIds.add(check.id);
  }
  for (const sub of subProjectProfiles) {
    for (const check of sub.completeChecks) {
      uniqueCheckIds.add(check.id);
    }
  }

  const isRootApplication = discovery.rootProject.identity.hasPackageJson;
  const totalApplications = discovery.summary.isMonorepo
    ? (isRootApplication ? 1 + subProjectProfiles.length : subProjectProfiles.length)
    : 1;

  return {
    rootProfile,
    subProjectProfiles,
    summary: {
      totalApplications,
      isMonorepo: discovery.summary.isMonorepo,
      totalUniqueChecks: uniqueCheckIds.size,
      timestamp: new Date().toISOString(),
    },
  };
}
