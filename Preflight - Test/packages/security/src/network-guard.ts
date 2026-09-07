import { SecurityError } from './execution-guard.js';

export class NetworkGuard {
  private static readonly LOCAL_HOSTS = new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    '0.0.0.0'
  ]);

  private static readonly BLOCKED_METADATA_IPS = new Set([
    '169.254.169.254',
    'fd00:ec2::254'
  ]);

  /**
   * Validate that target URL is a safe local or explicitly allowed test endpoint
   */
  public static validateTargetUrl(rawUrl: string, allowedHosts: string[] = []): URL {
    if (!rawUrl) {
      throw new SecurityError('Target URL cannot be empty.');
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new SecurityError(`Invalid target URL format: '${rawUrl}'`);
    }

    // Only allow HTTP/HTTPS protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new SecurityError(`Forbidden protocol '${parsed.protocol}'. Only HTTP/HTTPS protocols are permitted.`);
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block cloud metadata endpoints (e.g. AWS IMDS)
    if (NetworkGuard.BLOCKED_METADATA_IPS.has(hostname)) {
      throw new SecurityError(`Access to cloud metadata endpoint '${hostname}' is strictly forbidden.`);
    }

    const isLocal = NetworkGuard.LOCAL_HOSTS.has(hostname);
    const isAllowedHost = allowedHosts.map((h) => h.toLowerCase()).includes(hostname);

    if (!isLocal && !isAllowedHost) {
      throw new SecurityError(`Target host '${hostname}' is not in approved target allowlist.`);
    }

    return parsed;
  }
}
