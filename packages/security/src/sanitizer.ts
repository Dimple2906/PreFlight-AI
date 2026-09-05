export interface SanitizationResult {
  sanitizedText: string;
  redactedCount: number;
}

export class SecretSanitizer {
  private customSecrets: Set<string> = new Set();
  private secretPatterns: RegExp[] = [
    // AWS Access Key ID
    /AKIA[0-9A-Z]{16}/g,
    // AWS Secret Access Key
    /(?:aws_secret_access_key|aws_secret_key|secret_key)\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})["']?/gi,
    // OpenAI API Keys
    /sk-[A-Za-z0-9]{32,64}/g,
    /sk-proj-[A-Za-z0-9_-]{30,100}/g,
    // Gemini / Google API Keys
    /AIzaSy[A-Za-z0-9_-]{33}/g,
    // GitHub Tokens (ghp, gho, ghu, ghs, ghr, github_pat)
    /gh[pousr]_[A-Za-z0-9_]{36,255}/g,
    /github_pat_[A-Za-z0-9_]{22,255}/g,
    // JWT Tokens
    /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    // Bearer authorization tokens
    /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
    // Generic Private Keys
    /-----BEGIN (?:RSA |EC |PGP |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |PGP |OPENSSH )?PRIVATE KEY-----/g,
    // Database Connection Strings with Passwords
    /(mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis):\/\/([^:]+):([^@]+)@/gi,
    // Key/Password assignments in strings or configs
    /(?:api[_-]?key|password|pass|secret|auth[_-]?token|private[_-]?key)\s*[:=]\s*["']?([^"'\s;\n]{6,})["']?/gi
  ];

  /**
   * Register known secret values (e.g. from loaded .env files or process.env)
   */
  public registerSecret(secretValue: string): void {
    if (secretValue && secretValue.trim().length >= 4) {
      this.customSecrets.add(secretValue.trim());
    }
  }

  /**
   * Register key-value pairs from .env contents
   */
  public registerEnvSecrets(envRecord: Record<string, string>): void {
    for (const [key, val] of Object.entries(envRecord)) {
      if (!val || val.trim().length < 4) continue;
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('key') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('password') ||
        lowerKey.includes('pass') ||
        lowerKey.includes('auth') ||
        lowerKey.includes('cred') ||
        lowerKey.includes('private') ||
        lowerKey.includes('url') ||
        lowerKey.includes('uri')
      ) {
        this.registerSecret(val);
      }
    }
  }

  /**
   * Sanitize a text string by replacing secrets with [REDACTED]
   */
  public sanitize(text: string): SanitizationResult {
    if (!text) return { sanitizedText: '', redactedCount: 0 };
    let sanitized = text;
    let redactedCount = 0;

    // 1. Sanitize registered custom secrets
    for (const secret of this.customSecrets) {
      if (sanitized.includes(secret)) {
        const regex = new RegExp(this.escapeRegExp(secret), 'g');
        const matches = sanitized.match(regex);
        redactedCount += matches ? matches.length : 0;
        sanitized = sanitized.replace(regex, '[REDACTED]');
      }
    }

    // 2. Sanitize regex pattern matches
    for (const pattern of this.secretPatterns) {
      const matches = sanitized.match(pattern);
      if (matches) {
        redactedCount += matches.length;
        sanitized = sanitized.replace(pattern, '[REDACTED]');
      }
    }

    return { sanitizedText: sanitized, redactedCount };
  }

  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export const globalSanitizer = new SecretSanitizer();
