import { CheckDefinition, ProjectProfile, ApplicableCheck } from '../../types';

/**
 * Evaluates whether a CheckDefinition is applicable to a given ProjectProfile.
 * Primarily evaluates declarative CheckPredicates without procedural technology switching.
 * Returns an ApplicableCheck with applicability boolean, reasoning, matched technologies, and evidence.
 */
export function evaluateApplicability(
  check: CheckDefinition,
  profile: ProjectProfile
): ApplicableCheck {
  // 1. Layer 1: Universal checks always apply to all deployment units
  if (check.layer === 'UNIVERSAL') {
    return evaluateUniversalCheck(check, profile);
  }

  // 2. Declarative Predicate Evaluation
  // If the check defines declarative predicates, evaluate them generically
  if (check.predicates) {
    return evaluateDeclarativeCheck(check, profile);
  }

  // 3. Fallback for checks without explicit predicates
  return {
    check,
    applicable: false,
    reason: `Check ${check.id} lacks declarative predicates and could not be evaluated`,
    matchedTechnologies: [],
    evidence: [],
  };
}

function evaluateUniversalCheck(
  check: CheckDefinition,
  profile: ProjectProfile
): ApplicableCheck {
  const matchedTechnologies: string[] = [];
  const evidence: string[] = [];

  if (profile.packageManager && profile.packageManager.packageManager !== 'unknown') {
    matchedTechnologies.push(profile.packageManager.packageManager);
  }
  if (profile.runtime && profile.runtime.name !== 'Unknown') {
    matchedTechnologies.push(profile.runtime.name);
  }

  evidence.push(...(profile.rawEvidence || []).slice(0, 3));

  return {
    check,
    applicable: true,
    reason: `Universal deployment requirement applicable across all projects (${check.domain})`,
    matchedTechnologies,
    evidence,
  };
}

/**
 * Generic predicate evaluator.
 * Evaluates projectTypes, frameworks, databases, runtimes, hosting, packageManagers, languages,
 * requiresMonorepo, and requiresCi without any technology-specific procedural switch-cases.
 */
function evaluateDeclarativeCheck(
  check: CheckDefinition,
  profile: ProjectProfile
): ApplicableCheck {
  const p = check.predicates!;
  const matchedTechnologies: string[] = [];
  const evidence: string[] = [];
  const reasons: string[] = [];

  // Project Types
  if (p.projectTypes && p.projectTypes.length > 0) {
    const primary = (profile.projectType?.primaryType || '').toLowerCase();
    const secondary = (profile.projectType?.secondaryTypes || []).map((t) => t.toLowerCase());
    const allTypes = [primary, ...secondary];

    const matchedType = p.projectTypes.find((targetType) => {
      const targetLower = targetType.toLowerCase();
      return allTypes.some((t) => t.includes(targetLower));
    });

    if (!matchedType) {
      return {
        check,
        applicable: false,
        reason: `Project type (${profile.projectType?.primaryType}) does not match required types: ${p.projectTypes.join(', ')}`,
        matchedTechnologies: [],
        evidence: [],
      };
    }

    matchedTechnologies.push(profile.projectType.primaryType);
    if (profile.projectType.evidence) {
      evidence.push(...profile.projectType.evidence);
    }
    reasons.push(`Project type matches ${matchedType}`);
  }

  // Frameworks
  if (p.frameworks && p.frameworks.length > 0) {
    const detectedFrameworks = profile.frameworks?.frameworks || [];
    const matchedFw = detectedFrameworks.find((f) => {
      const fNameLower = f.name.toLowerCase();
      return p.frameworks!.some((targetFw) => fNameLower.includes(targetFw.toLowerCase()));
    });

    if (!matchedFw) {
      return {
        check,
        applicable: false,
        reason: `Required framework not detected (expected one of: ${p.frameworks.join(', ')})`,
        matchedTechnologies: [],
        evidence: [],
      };
    }

    matchedTechnologies.push(matchedFw.name);
    evidence.push(...matchedFw.evidence);
    reasons.push(`Framework ${matchedFw.name} detected`);
  }

  // Databases & ORMs
  if (p.databases && p.databases.length > 0) {
    const detectedDbs = profile.databases?.databases || [];
    const matchedDb = detectedDbs.find((d) => {
      const dNameLower = d.name.toLowerCase();
      return p.databases!.some((targetDb) => dNameLower.includes(targetDb.toLowerCase()));
    });

    if (!matchedDb) {
      return {
        check,
        applicable: false,
        reason: `Required database/ORM not detected (expected one of: ${p.databases.join(', ')})`,
        matchedTechnologies: [],
        evidence: [],
      };
    }

    matchedTechnologies.push(matchedDb.name);
    evidence.push(...matchedDb.evidence);
    reasons.push(`Database/ORM ${matchedDb.name} detected`);
  }

  // Runtimes & Languages
  if (p.runtimes && p.runtimes.length > 0) {
    const runtimeName = (profile.runtime?.name || '').toLowerCase();
    const pm = (profile.packageManager?.packageManager || '').toLowerCase();
    const rawEv = (profile.rawEvidence || []).map((e) => e.toLowerCase());

    const matchedRuntime = p.runtimes.find((targetRt) => {
      const rtLower = targetRt.toLowerCase();
      if (rtLower === 'node.js') {
        return runtimeName.includes('node') || (pm !== 'unknown' && pm !== '');
      }
      if (rtLower === 'python') {
        const langPython = (profile.languages?.languages || []).some(
          (l) => (l.language as string).toLowerCase() === 'python'
        );
        return runtimeName.includes('python') || langPython || rawEv.some((e) => e.includes('python'));
      }
      return runtimeName.includes(rtLower);
    });

    if (!matchedRuntime) {
      return {
        check,
        applicable: false,
        reason: `Required runtime not detected (expected one of: ${p.runtimes.join(', ')})`,
        matchedTechnologies: [],
        evidence: [],
      };
    }

    matchedTechnologies.push(matchedRuntime);
    if (profile.runtime?.evidence) {
      evidence.push(...profile.runtime.evidence);
    }
    reasons.push(`Runtime ${matchedRuntime} detected`);
  }

  // Languages
  if (p.languages && p.languages.length > 0) {
    const detectedLanguages = (profile.languages?.languages || []).map((l) => (l.language as string).toLowerCase());
    const primaryLang = (profile.languages?.primary || '').toLowerCase();
    const rawEv = (profile.rawEvidence || []).map((e) => e.toLowerCase());

    const matchedLang = p.languages.find((targetLang) => {
      const targetLower = targetLang.toLowerCase();
      return (
        primaryLang === targetLower ||
        detectedLanguages.includes(targetLower) ||
        rawEv.some((e) => e.includes(targetLower))
      );
    });

    if (!matchedLang) {
      return {
        check,
        applicable: false,
        reason: `Required language not detected (expected one of: ${p.languages.join(', ')})`,
        matchedTechnologies: [],
        evidence: [],
      };
    }

    matchedTechnologies.push(matchedLang);
    reasons.push(`Language ${matchedLang} detected`);
  }

  // Package Managers
  if (p.packageManagers && p.packageManagers.length > 0) {
    const pm = (profile.packageManager?.packageManager || '').toLowerCase();
    const matchedPm = p.packageManagers.find((targetPm) => pm === targetPm.toLowerCase());

    if (!matchedPm) {
      return {
        check,
        applicable: false,
        reason: `Package manager (${profile.packageManager?.packageManager}) does not match expected: ${p.packageManagers.join(', ')}`,
        matchedTechnologies: [],
        evidence: [],
      };
    }

    matchedTechnologies.push(matchedPm);
    if (profile.packageManager?.evidence) {
      evidence.push(...profile.packageManager.evidence);
    }
    reasons.push(`Package manager ${matchedPm} detected`);
  }

  // Hosting / Deployment Target
  if (p.hosting && p.hosting.length > 0) {
    const hostingItems = profile.hosting?.hosting || [];
    const matchedHosting = hostingItems.find((h) => {
      const hLower = h.name.toLowerCase();
      return p.hosting!.some((targetHost) => hLower.includes(targetHost.toLowerCase()));
    });

    if (!matchedHosting) {
      return {
        check,
        applicable: false,
        reason: `Deployment target not detected (expected one of: ${p.hosting.join(', ')})`,
        matchedTechnologies: [],
        evidence: [],
      };
    }

    matchedTechnologies.push(matchedHosting.name);
    evidence.push(...matchedHosting.evidence);
    reasons.push(`Deployment target ${matchedHosting.name} detected`);
  }

  // Monorepo requirement
  if (p.requiresMonorepo) {
    const isMonorepo =
      Boolean(profile.identity?.isMonorepoRoot) ||
      (profile.projectType?.primaryType || '').toLowerCase().includes('monorepo') ||
      (profile.projectType?.secondaryTypes || []).some((t) => t.toLowerCase().includes('monorepo')) ||
      (profile.rawEvidence || []).some(
        (e) =>
          e.toLowerCase().includes('workspace') ||
          e.toLowerCase().includes('pnpm-workspace') ||
          e.toLowerCase().includes('lerna')
      );

    if (!isMonorepo) {
      return {
        check,
        applicable: false,
        reason: 'Project is not a monorepo workspace container',
        matchedTechnologies: [],
        evidence: [],
      };
    }

    matchedTechnologies.push('Monorepo');
    reasons.push('Monorepo workspace orchestration detected');
  }

  // CI requirement
  if (p.requiresCi) {
    const rawEv = (profile.rawEvidence || []).map((e) => e.toLowerCase());
    const hasCi = rawEv.some((e) => e.includes('github/workflows') || e.includes('.github'));

    if (!hasCi) {
      return {
        check,
        applicable: false,
        reason: 'No CI/CD deployment workflows detected',
        matchedTechnologies: [],
        evidence: [],
      };
    }

    matchedTechnologies.push('GitHub Actions');
    evidence.push(...(profile.rawEvidence || []).filter((e) => e.toLowerCase().includes('github')));
    reasons.push('CI/CD pipeline configuration detected');
  }

  return {
    check,
    applicable: true,
    reason: reasons.join('; ') || 'All declarative predicates matched',
    matchedTechnologies: Array.from(new Set(matchedTechnologies)),
    evidence: Array.from(new Set(evidence)),
  };
}
