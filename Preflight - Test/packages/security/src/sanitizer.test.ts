import { describe, it, expect } from 'vitest';
import { SecretSanitizer } from './sanitizer.js';

describe('SecretSanitizer', () => {
  it('should redact OpenAI and AWS API keys', () => {
    const sanitizer = new SecretSanitizer();
    const raw = 'Failed to connect using key sk-1234567890abcdef1234567890abcdef and AWS key AKIAIOSFODNN7EXAMPLE';
    const result = sanitizer.sanitize(raw);

    expect(result.sanitizedText).not.toContain('sk-1234567890abcdef1234567890abcdef');
    expect(result.sanitizedText).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(result.redactedCount).toBeGreaterThanOrEqual(2);
  });

  it('should redact custom registered .env secrets', () => {
    const sanitizer = new SecretSanitizer();
    sanitizer.registerEnvSecrets({
      DATABASE_PASSWORD: 'super_secret_db_pass_99',
      API_KEY: 'custom-api-token-999'
    });

    const raw = 'Error in connection to DB with password super_secret_db_pass_99';
    const result = sanitizer.sanitize(raw);

    expect(result.sanitizedText).not.toContain('super_secret_db_pass_99');
    expect(result.sanitizedText).toContain('[REDACTED]');
  });
});
