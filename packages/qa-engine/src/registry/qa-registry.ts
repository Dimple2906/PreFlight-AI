import { ProjectProfile } from '@preflight/core';
import { AdversarialTest } from './base-test.js';
import { Auth001MissingCredentials } from '../tests/authentication/auth-001.js';
import { Auth002InvalidCredentials } from '../tests/authentication/auth-002.js';
import { Auth003ExpiredToken } from '../tests/authentication/auth-003.js';
import { Auth004AuthorizationBoundary } from '../tests/authentication/auth-004.js';
import { Input001EmptyInput, Input003NegativeValue } from '../tests/input/input-001.js';
import { Input006MalformedJson } from '../tests/input/input-006.js';
import { Conc001ConcurrentRequests } from '../tests/concurrency/conc-001.js';
import { Sec001SensitiveErrorLeakage } from '../tests/security/sec-001.js';
import { Sec002SecretDetectionProbe } from '../tests/security/sec-002.js';
import { Rate001RateLimitProbe } from '../tests/security/rate-001.js';
import { Api001HealthCheckProbe } from '../tests/security/api-001.js';
import { Db001DatabaseIntegrityProbe } from '../tests/security/db-001.js';
import { Res001TimeoutResilienceProbe } from '../tests/security/res-001.js';
import { Dep001DependencyRiskProbe } from '../tests/security/dep-001.js';

export interface TestCapabilityDescriptor {
  id: string;
  name: string;
  category: string;
  description: string;
}

export interface RecommendationValidationResult {
  valid: boolean;
  test?: AdversarialTest;
  reason?: string;
}

export class QARegistry {
  private tests: Map<string, AdversarialTest> = new Map();
  private aliasMap: Map<string, string> = new Map();

  constructor() {
    this.registerDefaultTests();
    this.initAliases();
  }

  public register(test: AdversarialTest): void {
    this.tests.set(test.id, test);
    this.tests.set(test.id.toLowerCase(), test);
  }

  public registerAlias(alias: string, targetId: string): void {
    this.aliasMap.set(alias.toLowerCase(), targetId);
  }

  public findTest(idOrAlias: string): AdversarialTest | undefined {
    if (!idOrAlias) return undefined;
    const clean = idOrAlias.toLowerCase().trim();

    if (this.tests.has(clean)) {
      return this.tests.get(clean);
    }

    const resolvedId = this.aliasMap.get(clean);
    if (resolvedId && this.tests.has(resolvedId)) {
      return this.tests.get(resolvedId);
    }

    // Fuzzy matching for canonical capability names
    for (const [key, test] of this.tests.entries()) {
      if (key.includes(clean) || clean.includes(key)) {
        return test;
      }
    }

    return undefined;
  }

  public getApplicableTests(profile: ProjectProfile): AdversarialTest[] {
    const applicable: AdversarialTest[] = [];
    const seen = new Set<string>();

    for (const test of this.tests.values()) {
      if (!seen.has(test.id) && test.isApplicable(profile)) {
        seen.add(test.id);
        applicable.push(test);
      }
    }
    return applicable;
  }

  public getCapabilitiesList(): TestCapabilityDescriptor[] {
    const list: TestCapabilityDescriptor[] = [];
    const seen = new Set<string>();

    for (const test of this.tests.values()) {
      if (!seen.has(test.id)) {
        seen.add(test.id);
        list.push({
          id: test.id,
          name: test.name,
          category: test.category,
          description: test.purpose
        });
      }
    }
    return list;
  }

  public validateRecommendation(recommendationId: string, profile: ProjectProfile): RecommendationValidationResult {
    const test = this.findTest(recommendationId);
    if (!test) {
      return {
        valid: false,
        reason: 'No compatible deterministic executor available in registry.'
      };
    }

    if (!test.isApplicable(profile)) {
      return {
        valid: false,
        reason: `Test '${test.name}' is not applicable to this project profile.`
      };
    }

    return {
      valid: true,
      test
    };
  }

  private registerDefaultTests(): void {
    this.register(new Auth001MissingCredentials());
    this.register(new Auth002InvalidCredentials());
    this.register(new Auth003ExpiredToken());
    this.register(new Auth004AuthorizationBoundary());
    this.register(new Input001EmptyInput());
    this.register(new Input003NegativeValue());
    this.register(new Input006MalformedJson());
    this.register(new Conc001ConcurrentRequests());
    this.register(new Sec001SensitiveErrorLeakage());
    this.register(new Sec002SecretDetectionProbe());
    this.register(new Rate001RateLimitProbe());
    this.register(new Api001HealthCheckProbe());
    this.register(new Db001DatabaseIntegrityProbe());
    this.register(new Res001TimeoutResilienceProbe());
    this.register(new Dep001DependencyRiskProbe());
  }

  private initAliases(): void {
    // Auth aliases
    this.registerAlias('auth-boundary', 'AUTH-001');
    this.registerAlias('authentication-boundary', 'AUTH-001');
    this.registerAlias('qa-auth-missing', 'AUTH-001');
    this.registerAlias('qa-auth-invalid', 'AUTH-002');
    this.registerAlias('qa-auth-expired', 'AUTH-003');
    this.registerAlias('authorization-boundary', 'AUTH-004');
    this.registerAlias('authz-boundary', 'AUTH-004');
    this.registerAlias('qa-authz-boundary', 'AUTH-004');

    // Input aliases
    this.registerAlias('input-validation', 'INPUT-001');
    this.registerAlias('qa-input-empty', 'INPUT-001');
    this.registerAlias('qa-input-negative', 'INPUT-003');
    this.registerAlias('qa-input-malformed-json', 'INPUT-006');

    // Concurrency aliases
    this.registerAlias('concurrency', 'CONC-001');
    this.registerAlias('race-condition', 'CONC-001');
    this.registerAlias('qa-conc-requests', 'CONC-001');

    // Security & Secrets
    this.registerAlias('error-handling', 'SEC-001');
    this.registerAlias('qa-sec-error-leak', 'SEC-001');
    this.registerAlias('secret-detection', 'SEC-002');
    this.registerAlias('qa-secret-detection', 'SEC-002');

    // Rate limiting & API
    this.registerAlias('rate-limit', 'RATE-001');
    this.registerAlias('rate-limiting', 'RATE-001');
    this.registerAlias('qa-rate-limit', 'RATE-001');
    this.registerAlias('api-health', 'API-001');
    this.registerAlias('health-check', 'API-001');
    this.registerAlias('api-contract', 'API-001');
    this.registerAlias('qa-api-health', 'API-001');

    // DB & Resilience
    this.registerAlias('database-integrity', 'DB-001');
    this.registerAlias('sql-injection', 'DB-001');
    this.registerAlias('qa-database-integrity', 'DB-001');
    this.registerAlias('timeout', 'RES-001');
    this.registerAlias('timeout-handling', 'RES-001');
    this.registerAlias('resource-exhaustion', 'RES-001');
    this.registerAlias('qa-timeout-resilience', 'RES-001');

    // Dependency
    this.registerAlias('dependency-risk', 'DEP-001');
    this.registerAlias('qa-dependency-risk', 'DEP-001');
  }
}
