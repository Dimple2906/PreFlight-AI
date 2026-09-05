export class SecurityError extends Error {
  constructor(message: string) {
    super(`[Security Error] ${message}`);
    this.name = 'SecurityError';
  }
}

export class ExecutionPolicyGuard {
  private static readonly BLOCKED_PATTERNS: RegExp[] = [
    // Destructive filesystem commands
    /rm\s+-rf\b/i,
    /rmdir\s+\/[sS]\b/i,
    /del\s+\/[fF]\s+\/[sS]\b/i,
    /format\s+[a-z]:/i,
    /mkfs\b/i,
    /dd\s+if=/i,

    // Privilege escalation & system modification
    /\bsudo\b/i,
    /\bdoas\b/i,
    /\bchmod\s+777\b/i,
    /\bchown\b/i,

    // Credential extraction & shadow access
    /\/etc\/passwd\b/i,
    /\/etc\/shadow\b/i,

    // Destructive database operations
    /drop\s+database\b/i,
    /truncate\s+table\b/i,

    // Unsafe shell pipe execution
    /\|\s*sh\b/i,
    /\|\s*bash\b/i,
    /\|\s*powershell\b/i,
    /eval\s*\(/i
  ];

  /**
   * Inspect command string against security policy rules
   */
  public evaluateCommand(command: string): { allowed: boolean; reason?: string } {
    if (!command || typeof command !== 'string') {
      return { allowed: false, reason: 'Command string is empty or invalid.' };
    }

    const trimmed = command.trim();

    for (const pattern of ExecutionPolicyGuard.BLOCKED_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          allowed: false,
          reason: `Command matches forbidden destructive/insecure pattern (${pattern.source})`
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Enforce command policy or throw SecurityError
   */
  public validateCommand(command: string): void {
    const result = this.evaluateCommand(command);
    if (!result.allowed) {
      throw new SecurityError(result.reason || 'Command rejected by execution policy guard');
    }
  }
}
