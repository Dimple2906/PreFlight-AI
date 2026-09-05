import { PreflightError } from './base.js';

export class ProjectDiscoveryError extends PreflightError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'ERR_PROJECT_DISCOVERY', details);
  }
}

export class ClassificationError extends PreflightError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'ERR_PROJECT_CLASSIFICATION', details);
  }
}

export class ExecutionError extends PreflightError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'ERR_EXECUTION_FAILURE', details);
  }
}

export class ConfigurationError extends PreflightError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'ERR_CONFIGURATION_INVALID', details);
  }
}

export class AIProviderError extends PreflightError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'ERR_AI_PROVIDER_FAILURE', details);
  }
}

export class SecurityError extends PreflightError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'ERR_SECURITY_VIOLATION', details);
  }
}
