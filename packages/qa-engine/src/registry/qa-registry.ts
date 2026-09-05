import { ProjectProfile } from '@preflight/core';
import { AdversarialTest } from './base-test.js';
import { Auth001MissingCredentials } from '../tests/authentication/auth-001.js';
import { Auth002InvalidCredentials } from '../tests/authentication/auth-002.js';
import { Auth003ExpiredToken } from '../tests/authentication/auth-003.js';
import { Input001EmptyInput, Input003NegativeValue } from '../tests/input/input-001.js';
import { Input006MalformedJson } from '../tests/input/input-006.js';
import { Conc001ConcurrentRequests } from '../tests/concurrency/conc-001.js';
import { Sec001SensitiveErrorLeakage } from '../tests/security/sec-001.js';

export class QARegistry {
  private tests: Map<string, AdversarialTest> = new Map();

  constructor() {
    this.registerDefaultTests();
  }

  public register(test: AdversarialTest): void {
    this.tests.set(test.id, test);
  }

  public getApplicableTests(profile: ProjectProfile): AdversarialTest[] {
    const applicable: AdversarialTest[] = [];
    for (const test of this.tests.values()) {
      if (test.isApplicable(profile)) {
        applicable.push(test);
      }
    }
    return applicable;
  }

  private registerDefaultTests(): void {
    this.register(new Auth001MissingCredentials());
    this.register(new Auth002InvalidCredentials());
    this.register(new Auth003ExpiredToken());
    this.register(new Input001EmptyInput());
    this.register(new Input003NegativeValue());
    this.register(new Input006MalformedJson());
    this.register(new Conc001ConcurrentRequests());
    this.register(new Sec001SensitiveErrorLeakage());
  }
}
