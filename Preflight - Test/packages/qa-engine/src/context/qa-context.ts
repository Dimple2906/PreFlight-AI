import { ProjectProfile, Logger } from '@preflight/core';
import { SecretSanitizer } from '@preflight/security';

export interface QAExecutionContext {
  projectRoot: string;
  profile: ProjectProfile;
  targetUrl?: string;
  timeoutMs: number;
  maxConcurrency: number;
  environment: Record<string, string>;
  logger: Logger;
  sanitizer: SecretSanitizer;
}
