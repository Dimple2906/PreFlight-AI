import { CheckDefinition, CheckCategory, DeploymentLayer, UnitDeploymentProfile } from '../../types';
import { DEPLOYMENT_CHECK_REGISTRY } from './checks';
import { evaluateApplicability } from '../classification/applicability';
import { deduplicateChecks } from '../classification/deduplication';

/**
 * Fast lookup maps initialized from master check registry.
 */
const checksById = new Map<string, CheckDefinition>();
const checksByAlias = new Map<string, CheckDefinition>();

function initLookupMaps() {
  checksById.clear();
  checksByAlias.clear();
  for (const check of DEPLOYMENT_CHECK_REGISTRY) {
    checksById.set(check.id, check);
    if (check.aliases) {
      for (const alias of check.aliases) {
        checksByAlias.set(alias, check);
      }
    }
  }
}

initLookupMaps();

/**
 * Returns all registered check definitions in the registry.
 */
export function getAllChecks(): CheckDefinition[] {
  return [...DEPLOYMENT_CHECK_REGISTRY];
}

/**
 * Finds a check definition by its primary ID or backward-compatible alias.
 */
export function getCheckById(id: string): CheckDefinition | undefined {
  return checksById.get(id) || checksByAlias.get(id);
}

/**
 * Returns all checks matching a specific CheckCategory.
 */
export function getChecksByCategory(category: CheckCategory): CheckDefinition[] {
  return DEPLOYMENT_CHECK_REGISTRY.filter((check) => check.category === category);
}

/**
 * Returns all checks belonging to a specific DeploymentLayer.
 */
export function getChecksByLayer(layer: DeploymentLayer): CheckDefinition[] {
  return DEPLOYMENT_CHECK_REGISTRY.filter((check) => check.layer === layer);
}

/**
 * Returns all checks belonging to a specific CheckDomain.
 */
export function getChecksByDomain(domain: string): CheckDefinition[] {
  return DEPLOYMENT_CHECK_REGISTRY.filter((check) => check.domain === domain);
}

/**
 * Evaluates and returns all applicable checks for a given deployment profile (or project profile).
 */
export function getApplicableChecks(profile: any): CheckDefinition[] {
  // If given a UnitDeploymentProfile, completeChecks already contains applicable deduplicated checks
  if (profile && Array.isArray(profile.completeChecks)) {
    return profile.completeChecks;
  }

  // If given a ProjectProfile, evaluate dynamically
  const evaluations = DEPLOYMENT_CHECK_REGISTRY.map((check) => evaluateApplicability(check, profile));
  const applicable = evaluations.filter((e) => e.applicable);
  const deduplicated = deduplicateChecks(applicable);
  return deduplicated.map((e) => e.check);
}

/**
 * Returns only the MINIMUM profile checks for a given profile.
 */
export function getMinimumChecks(profile: any): CheckDefinition[] {
  if (profile && Array.isArray(profile.minimumChecks)) {
    return profile.minimumChecks;
  }
  return getApplicableChecks(profile).filter((c) => c.profileLevel === 'MINIMUM');
}

/**
 * Returns the COMPLETE profile checks for a given profile.
 */
export function getCompleteChecks(profile: any): CheckDefinition[] {
  if (profile && Array.isArray(profile.completeChecks)) {
    return profile.completeChecks;
  }
  return getApplicableChecks(profile);
}

/**
 * Validates the entire check catalog for development/testing safety:
 * - Detects duplicate primary IDs
 * - Ensures all checks have mandatory non-empty metadata
 * - Ensures valid severity, automation, profileLevel, and layer
 */
export function validateRegistryIntegrity(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const seenIds = new Set<string>();

  for (const check of DEPLOYMENT_CHECK_REGISTRY) {
    // 1. Check ID uniqueness
    if (seenIds.has(check.id)) {
      errors.push(`Duplicate check ID detected: ${check.id}`);
    }
    seenIds.add(check.id);

    // 2. Required fields
    if (!check.name || check.name.trim() === '') {
      errors.push(`Check ${check.id} has empty name`);
    }
    if (!check.description || check.description.trim() === '') {
      errors.push(`Check ${check.id} has empty description`);
    }
    if (!check.layer) {
      errors.push(`Check ${check.id} missing layer`);
    }
    if (!check.domain) {
      errors.push(`Check ${check.id} missing domain`);
    }
    if (!check.severity) {
      errors.push(`Check ${check.id} missing severity`);
    }
    if (!check.automationLevel) {
      errors.push(`Check ${check.id} missing automationLevel`);
    }
    if (!check.profileLevel) {
      errors.push(`Check ${check.id} missing profileLevel`);
    }
    if (!check.expectedBehavior) {
      errors.push(`Check ${check.id} missing expectedBehavior`);
    }
    if (!check.passCondition) {
      errors.push(`Check ${check.id} missing passCondition`);
    }
    if (!check.failCondition) {
      errors.push(`Check ${check.id} missing failCondition`);
    }
    if (!check.source) {
      errors.push(`Check ${check.id} missing source`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export { REJECTED_DEPLOYMENT_CHECKS } from './checks';

/**
 * Returns all rejected candidate checks and their technical rejection rationales.
 */
export function getRejectedChecks() {
  const { REJECTED_DEPLOYMENT_CHECKS } = require('./checks');
  return [...REJECTED_DEPLOYMENT_CHECKS];
}
