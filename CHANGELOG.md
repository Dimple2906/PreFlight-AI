# Changelog

All notable changes to **PreFlight AI** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-05

### Added
- **Adversarial QA Engine (`preflight test`)**: Deterministic testing for missing auth headers, rate-limiting, SQL injection boundaries, concurrency limits, and input validation.
- **Deployment Readiness Engine (`preflight deploy`)**: Production build verification, committed `.env` defect detection, static source secret scanner, package manager lockfile validation, and `.gitignore` hygiene checks.
- **Reporting System (`@preflight/reporter`)**: Terminal banners, stable v1.0 machine-readable JSON schema, and GitHub-Flavored Markdown report generation (`--report report.md`).
- **Adaptive AI Reasoning Layer (`@preflight/ai-engine`)**: Gemini integration for root cause analysis, coverage gap identification, and deterministic re-execution loop.
- **Security & Hardening Suite (`@preflight/security`)**: SecretSanitizer (`[REDACTED]`), ExecutionPolicyGuard, PathSecurityGuard, ProcessExecutor, and NetworkGuard.
- **CLI Commands**: `preflight test`, `preflight deploy`, `preflight scan`, `preflight doctor`, `preflight version`, `preflight help`.
