export type LogLevel = 'silent' | 'normal' | 'verbose' | 'debug';

const LEVEL_WEIGHTS: Record<LogLevel, number> = {
  silent: 0,
  normal: 1,
  verbose: 2,
  debug: 3
};

export class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = 'normal') {
    this.level = level;
  }

  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  public getLevel(): LogLevel {
    return this.level;
  }

  public info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('normal')) {
      console.log(`[INFO] ${this.sanitize(message)}`, ...this.sanitizeArgs(args));
    }
  }

  public warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('normal')) {
      console.warn(`[WARN] ${this.sanitize(message)}`, ...this.sanitizeArgs(args));
    }
  }

  public error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('normal')) {
      console.error(`[ERROR] ${this.sanitize(message)}`, ...this.sanitizeArgs(args));
    }
  }

  public verbose(message: string, ...args: unknown[]): void {
    if (this.shouldLog('verbose')) {
      console.log(`[VERBOSE] ${this.sanitize(message)}`, ...this.sanitizeArgs(args));
    }
  }

  public debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${this.sanitize(message)}`, ...this.sanitizeArgs(args));
    }
  }

  private shouldLog(targetLevel: LogLevel): boolean {
    return LEVEL_WEIGHTS[this.level] >= LEVEL_WEIGHTS[targetLevel];
  }

  private sanitize(input: string): string {
    if (!input) return '';
    return input
      .replace(/sk-[A-Za-z0-9]{32,64}/g, '[REDACTED_SECRET]')
      .replace(/AKIA[0-9A-Z]{16}/g, '[REDACTED_SECRET]')
      .replace(/AIzaSy[A-Za-z0-9_-]{33}/g, '[REDACTED_SECRET]')
      .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, '[REDACTED_TOKEN]');
  }

  private sanitizeArgs(args: unknown[]): unknown[] {
    return args.map(arg => {
      if (typeof arg === 'string') return this.sanitize(arg);
      if (typeof arg === 'object' && arg !== null) {
        return JSON.parse(this.sanitize(JSON.stringify(arg)));
      }
      return arg;
    });
  }
}

export const defaultLogger = new Logger('normal');
