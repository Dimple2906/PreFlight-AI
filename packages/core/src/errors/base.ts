export abstract class PreflightError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    const safeMessage = PreflightError.sanitizeMessage(message);
    super(safeMessage);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details ? PreflightError.sanitizeObject(details) : undefined;
    this.timestamp = new Date().toISOString();
    Object.setPrototypeOf(this, new.target.prototype);
  }

  protected static sanitizeMessage(input: string): string {
    if (!input) return '';
    return input
      .replace(/sk-[A-Za-z0-9]{32,64}/g, '[REDACTED_SECRET]')
      .replace(/AKIA[0-9A-Z]{16}/g, '[REDACTED_SECRET]')
      .replace(/AIzaSy[A-Za-z0-9_-]{33}/g, '[REDACTED_SECRET]')
      .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, '[REDACTED_TOKEN]')
      .replace(/(mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis):\/\/([^:]+):([^@]+)@/gi, '$1://$2:[REDACTED]@');
  }

  protected static sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('key') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('password') ||
        lowerKey.includes('pass')
      ) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof val === 'string') {
        sanitized[key] = PreflightError.sanitizeMessage(val);
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }
}
