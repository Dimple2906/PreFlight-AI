import { ProjectProfile, Logger } from '@preflight/core';
import { SecretSanitizer } from '@preflight/security';

export interface DeployExecutionContext {
  projectRoot: string;
  profile: ProjectProfile;
  logger: Logger;
  sanitizer: SecretSanitizer;
}
