import { describe, it, expect } from 'vitest';
import {
  PreflightError,
  ProjectDiscoveryError,
  ClassificationError,
  ExecutionError,
  ConfigurationError,
  AIProviderError,
  SecurityError
} from '../index.js';

describe('Preflight Application Errors', () => {
  it('should instantiate custom errors with correct codes and safe messages', () => {
    const err = new ProjectDiscoveryError('Failed to inspect path with key sk-1234567890abcdef1234567890abcdef');
    expect(err).toBeInstanceOf(PreflightError);
    expect(err.code).toBe('ERR_PROJECT_DISCOVERY');
    expect(err.message).not.toContain('sk-1234567890abcdef1234567890abcdef');
    expect(err.message).toContain('[REDACTED_SECRET]');
  });

  it('should redact secret values from error details', () => {
    const err = new SecurityError('Access denied', {
      apiKey: 'sk-1234567890abcdef1234567890abcdef',
      user: 'admin'
    });

    expect(err.code).toBe('ERR_SECURITY_VIOLATION');
    expect(err.details?.apiKey).toBe('[REDACTED]');
    expect(err.details?.user).toBe('admin');
  });

  it('should support all typed application error subclasses', () => {
    expect(new ClassificationError('Classify fail').code).toBe('ERR_PROJECT_CLASSIFICATION');
    expect(new ExecutionError('Exec fail').code).toBe('ERR_EXECUTION_FAILURE');
    expect(new ConfigurationError('Config fail').code).toBe('ERR_CONFIGURATION_INVALID');
    expect(new AIProviderError('AI fail').code).toBe('ERR_AI_PROVIDER_FAILURE');
  });
});
