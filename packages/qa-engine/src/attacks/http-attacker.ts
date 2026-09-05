import { SecretSanitizer, NetworkGuard } from '@preflight/security';

export interface HttpResponseProbe {
  status: number;
  statusText: string;
  durationMs: number;
  headers: Record<string, string>;
  bodyText: string;
}

export class HttpAttacker {
  private sanitizer: SecretSanitizer;

  constructor(sanitizer?: SecretSanitizer) {
    this.sanitizer = sanitizer || new SecretSanitizer();
  }

  public async probe(
    url: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
      timeoutMs?: number;
      allowedHosts?: string[];
    } = {}
  ): Promise<HttpResponseProbe> {
    const startTime = Date.now();

    // Enforce Network Security Guard validation
    try {
      NetworkGuard.validateTargetUrl(url, options.allowedHosts);
    } catch (err: any) {
      return {
        status: 0,
        statusText: 'SECURITY_BLOCKED',
        durationMs: Date.now() - startTime,
        headers: {},
        bodyText: this.sanitizer.sanitize(err.message || String(err)).sanitizedText
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 10000);

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body,
        signal: controller.signal
      });

      const bodyRaw = await response.text();
      const durationMs = Date.now() - startTime;

      const headersObj: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        headersObj[key] = val;
      });

      return {
        status: response.status,
        statusText: response.statusText,
        durationMs,
        headers: headersObj,
        bodyText: this.sanitizer.sanitize(bodyRaw).sanitizedText
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      return {
        status: 0,
        statusText: 'CONNECTION_ERROR',
        durationMs,
        headers: {},
        bodyText: this.sanitizer.sanitize(err.message || String(err)).sanitizedText
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  public async probeConcurrent(
    url: string,
    count: number,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
      timeoutMs?: number;
      allowedHosts?: string[];
    } = {}
  ): Promise<HttpResponseProbe[]> {
    const promises = Array.from({ length: count }, () => this.probe(url, options));
    return Promise.all(promises);
  }
}
