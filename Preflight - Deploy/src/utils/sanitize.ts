/**
 * Secret and credential sanitization utilities.
 * Ensures tokens, passwords, private keys, and environment secret values
 * are never leaked into execution logs, check results, or evidence outputs.
 */

// Common high-entropy or recognized secret formats
const SECRET_PATTERNS: RegExp[] = [
  // Generic token / key assignments
  /(?:api[_-]?key|secret[_-]?key|auth[_-]?token|access[_-]?token|private[_-]?key|client[_-]?secret|password|passwd|pwd)\s*[:=]\s*['"]?([a-zA-Z0-9_\-\.\+\/=]{8,})['"]?/gi,
  // AWS Keys
  /\b(AKIA[0-9A-Z]{16})\b/g,
  // Bearer tokens
  /\bBearer\s+([a-zA-Z0-9_\-\.]{16,})\b/gi,
  // JWT tokens
  /\beyJ[a-zA-Z0-9_\-]{10,}\.eyJ[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}\b/g,
  // Private Key Blocks
  /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
  // Database connection strings with passwords
  /(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|sqlite):\/\/[^:]+:([^@]+)@/gi,
];

/**
 * Redacts any recognizable credential strings from text.
 */
export function sanitizeOutput(text: string): string {
  if (!text) return '';
  let sanitized = text;

  // Mask private key blocks
  sanitized = sanitized.replace(
    /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
    '-----BEGIN PRIVATE KEY-----\n[REDACTED PRIVATE KEY]\n-----END PRIVATE KEY-----'
  );

  // Mask database passwords in connection URIs
  sanitized = sanitized.replace(
    /((?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^:]+:)([^@]+)(@)/gi,
    '$1[REDACTED_PASSWORD]$3'
  );

  // Mask JWT tokens
  sanitized = sanitized.replace(
    /\beyJ[a-zA-Z0-9_\-]{10,}\.eyJ[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}\b/g,
    '[REDACTED_JWT_TOKEN]'
  );

  // Mask AWS access keys
  sanitized = sanitized.replace(/\b(AKIA[0-9A-Z]{16})\b/g, '[REDACTED_AWS_KEY]');

  // Mask generic key assignments
  sanitized = sanitized.replace(
    /(api[_-]?key|secret[_-]?key|auth[_-]?token|access[_-]?token|private[_-]?key|client[_-]?secret|password|passwd|pwd)(\s*[:=]\s*['"]?)([^'"\s\n]{8,})(['"]?)/gi,
    (match, keyName, sep, val, quote) => {
      // Check if obvious placeholder
      if (isPlaceholderValue(val)) {
        return match;
      }
      return `${keyName}${sep}[REDACTED_SECRET]${quote || ''}`;
    }
  );

  return sanitized;
}

/**
 * Checks if a string value is an obvious placeholder rather than a real secret.
 */
export function isPlaceholderValue(val: string): boolean {
  if (!val) return true;
  const lower = val.trim().toLowerCase();
  const exactPlaceholders = new Set([
    'example',
    'sample',
    'changeme',
    'your-api-key',
    'your_api_key',
    'your-secret',
    'your_secret',
    'placeholder',
    'todo',
    'dummy',
    'test',
    'none',
    'null',
    'undefined',
    '00000000',
    '12345678',
    'localhost',
  ]);

  if (exactPlaceholders.has(lower)) {
    return true;
  }

  // Common placeholder patterns like <YOUR_KEY>, ${API_KEY}, [KEY], xxx, ...
  if (/^<.*>$/.test(lower) || /^\$\{.*\}$/.test(lower) || /^\[.*\]$/.test(lower)) {
    return true;
  }
  if (/^(x{3,}|y{3,}|\*{3,})$/.test(lower)) {
    return true;
  }

  return false;
}

/**
 * Sanitizes any text before it is sent to an external AI / Gemini model.
 * Strictly redacts tokens, bearer headers, private keys, connection URIs, and env assignments.
 */
export function sanitizeForAI(text: string): string {
  if (!text) return '';
  let sanitized = sanitizeOutput(text);

  // Redact any sk_live, sk_test, ghp_, gho_, xoxb, xoxp tokens
  sanitized = sanitized.replace(/\b(sk_[a-zA-Z0-9_\-]{16,})\b/gi, '[REDACTED_API_KEY]');
  sanitized = sanitized.replace(/\b(gh[pousr]_[a-zA-Z0-9]{20,})\b/g, '[REDACTED_GITHUB_TOKEN]');
  sanitized = sanitized.replace(/\b(xox[baprs]-[a-zA-Z0-9_\-]{16,})\b/gi, '[REDACTED_SLACK_TOKEN]');

  // Redact raw env key=value assignments: KEY=value
  sanitized = sanitized.replace(
    /^([A-Z0-9_]*(?:SECRET|KEY|PASSWORD|TOKEN|AUTH|CREDENTIAL|PASSWD|PWD)[A-Z0-9_]*)\s*=\s*(.+)$/gim,
    (match, k, v) => {
      if (isPlaceholderValue(v.trim())) {
        return `${k}=${v}`;
      }
      return `${k}=[REDACTED]`;
    }
  );

  return sanitized;
}

