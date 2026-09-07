# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability within PreFlight AI or any of its workspace packages, please report it responsibly by emailing **security@preflight-ai.org** or creating a private security advisory on GitHub.

Do **NOT** report security vulnerabilities through public GitHub issues.

## PreFlight AI Security Principles

1. **Centralized Secret Sanitization**: All credentials, tokens, JWTs, AWS keys, and private keys are sanitized with `[REDACTED]` prior to display or transport.
2. **Execution Policy Guard**: PreFlight blocks destructive commands (`rm -rf`, `format`, `sudo`, `drop database`, shell pipes).
3. **Path Traversal Prevention**: File reads and writes are restricted to `projectRoot`.
4. **Process Execution Safety**: Timeouts (30s max) and 5MB buffer limits prevent process hanging and memory exhaustion.
5. **Network Host Restrictions**: Probing targets are strictly restricted to `localhost` and explicitly whitelisted endpoints.
