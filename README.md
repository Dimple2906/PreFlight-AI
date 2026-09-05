# PreFlight AI ✈️

> **CLI Production Readiness Gatekeeper for Software Projects.**  
> *"Don't just ask whether the application works. Discover how it can fail before it reaches production."*

[![npm version](https://img.shields.io/npm/v/preflight-ai.svg)](https://www.npmjs.com/package/preflight-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 1. What is PreFlight AI?

**PreFlight AI** is an open-source CLI developer tool designed to act as an automated production readiness gatekeeper. It evaluates software projects before release through **deterministic adversarial QA testing** and **deployment readiness verification**, augmented by an **adaptive AI reasoning layer**.

---

## 2. Why PreFlight AI Exists

Traditional happy-path test suites verify that your application works under expected conditions. However, production failures frequently stem from unexpected boundaries:
- Unauthenticated administrative endpoints
- Missing rate-limiting headers on auth routes
- Exposed credentials or committed `.env` secret files
- Missing package manager lockfiles (`pnpm-lock.yaml`, `package-lock.json`)
- Broken build scripts or missing environment variable documentation

PreFlight AI actively attacks your project using adversarial QA probes and deployment checks to catch these flaws before your users do.

---

## 3. Installation

Install PreFlight AI globally via npm, pnpm, or yarn:

```bash
npm install -g preflight-ai
```

Verify installation:

```bash
preflight --version
```

---

## 4. Quick Start

Run PreFlight AI inside any software project root directory:

```bash
# Perform adversarial QA testing & coverage gap analysis
preflight test

# Perform deployment readiness checks & release gatekeeping
preflight deploy
```

---

## 5. `preflight test`

The `preflight test` command executes deterministic adversarial QA testing against your project:

```bash
preflight test [options]
```

### Flow
1. **Project Discovery & Inspection**: Detects project structure, languages, frameworks, entrypoints, and domain signals.
2. **Deterministic Execution**: Runs test runners and adversarial security probes (auth guards, SQL injection boundaries, rate limiting, concurrency).
3. **AI Gap Analysis**: Analyzes execution evidence to identify coverage gaps and root causes.
4. **Deterministic Re-Execution**: Evaluates AI-suggested capabilities from the QA registry and re-executes matching tests.
5. **Final Verdict**: Outputs terminal status, JSON schema, or Markdown report with verdict:
   - `🟢 PREFLIGHT PASSED`
   - `🟡 PREFLIGHT PASSED WITH WARNINGS`
   - `🔴 PREFLIGHT FAILED`

---

## 6. `preflight deploy`

The `preflight deploy` command performs pre-release verification:

```bash
preflight deploy [options]
```

### Checks Performed
- **`DEPLOY-STRUCT-001`**: Required project files check.
- **`DEPLOY-ENV-001`**: `.env.example` existence & documentation verification.
- **`DEPLOY-ENV-004`**: Committed `.env` file defect detection.
- **`DEPLOY-SECRETS-001`**: Static source code secret & credential scanner (AWS keys, OpenAI keys, Gemini keys, JWTs, private keys).
- **`DEPLOY-BUILD-001`**: Production build compilation verification.
- **`DEPLOY-RUNTIME-003`**: Package manager lockfile verification.
- **`DEPLOY-GIT-001`**: Git hygiene and `.gitignore` rule verification.

### Verdict Output
- `🟢 GO`
- `🟡 GO WITH WARNINGS`
- `🔴 NO-GO`

---

## 7. Architecture

PreFlight AI is built as a Clean Architecture TypeScript monorepo:

```text
packages/
├── core/                # Shared domain models, types, errors, logger
├── security/            # SecretSanitizer, ExecutionPolicyGuard, PathSecurityGuard, NetworkGuard
├── config/              # Configuration loader (.preflightrc.json)
├── discovery/           # Deterministic filesystem & environment inspector
├── classifier/          # Project & framework classifier with confidence scoring
├── qa-engine/           # Adversarial QA testing engine & test registry
├── deploy-engine/       # Deployment readiness checks & check registry
├── ai-engine/           # Gemini AI provider & payload sanitizer
└── reporter/            # ReportEngine (Terminal, JSON v1.0, Markdown)
apps/
└── cli/                 # Commander CLI application & services
```

---

## 8. The Role of AI

> **CRITICAL GUARANTEE**: AI is **NEVER** the authority for PASS/FAIL decisions.

- **Deterministic Execution is Authority**: Actual test runners, exit codes, and HTTP probe responses dictate PASS/FAIL.
- **AI as Adaptive Reasoning Advisor**: The Gemini reasoning layer analyzes execution evidence post-execution to:
  1. Identify root causes of failures.
  2. Recommend missing coverage gaps.
  3. Suggest remediation code fixes.
  4. Recommend additional registry test capabilities for deterministic re-execution.
- **Offline Fallback**: If `--no-ai` is passed, or if `GEMINI_API_KEY` is missing, PreFlight falls back seamlessly to offline reasoning without failing CLI runs.

---

## 9. Security & Privacy

PreFlight AI is engineered with defense-in-depth security:

1. **Centralized Secret Sanitization (`SecretSanitizer`)**: All API keys, JWTs, passwords, tokens, and private keys are replaced with `[REDACTED]` before leaving process memory or appearing in reports/prompts.
2. **Execution Policy Guard (`ExecutionPolicyGuard`)**: Blocks destructive system commands (`rm -rf`, `format`, `sudo`, `drop database`, shell injection pipes).
3. **Path Security Guard (`PathSecurityGuard`)**: Prevents path traversal outside project root.
4. **Process Executor (`ProcessExecutor`)**: Enforces 30s max timeouts, 5MB max output buffer limits, and strips parent environment secrets from child processes.
5. **Network Guard (`NetworkGuard`)**: Restricts network test calls strictly to `localhost` and explicitly approved endpoints.

---

## 10. Example Output

### Terminal Output
```text
===========================================================
  PREFLIGHT AI - TEST READINESS REPORT
===========================================================

  VERDICT: 🔴 PREFLIGHT FAILED
  Target Project:  ShopX
  Project Type:    web-app (typescript, javascript)
  Frameworks:      nextjs, express
  Runtime:         node
  Duration:        450ms

Execution Results:
┌──────────┬────────────────────────────────┬──────────┬────────────┬────────────┐
│ Status   │ Target Name                    │ Type     │ Severity   │ Duration   │
├──────────┼────────────────────────────────┼──────────┼────────────┼────────────┤
│  FAIL    │ Missing Authorization Header   │ test     │ HIGH       │ 45ms       │
├──────────┼────────────────────────────────┼──────────┼────────────┼────────────┤
│  PASS    │ Unit & Integration Test Suite  │ test     │ INFO       │ 120ms      │
└──────────┴────────────────────────────────┴──────────┴────────────┴────────────┘

Summary: 1 Passed | 1 Failed | 0 Warned | 0 Skipped
Verdict: 🔴 PREFLIGHT FAILED
```

### JSON Schema Output (`preflight test --json`)
```json
{
  "version": "1.0",
  "project": { "name": "ShopX", "projectType": "web-app" },
  "summary": { "total": 2, "passed": 1, "failed": 1 },
  "verdict": { "mode": "test", "status": "FAIL", "code": "🔴 PREFLIGHT FAILED" }
}
```

### Markdown File Output (`preflight test --report report.md`)
Generates GitHub-flavored Markdown file formatted for CI/CD job summaries.

---

## 11. Development

Clone the repository and install dependencies:

```bash
git clone https://github.com/preflight-ai/preflight.git
cd preflight
pnpm install
```

Build and test:

```bash
pnpm build        # Compile all TypeScript packages
pnpm typecheck    # Typecheck workspace
pnpm test         # Run 57 unit, integration, and security tests
```

---

## 12. Roadmap

- [x] Deterministic Adversarial QA Testing Engine
- [x] Deployment Readiness Gatekeeper (`preflight deploy`)
- [x] Multi-Format Reports (Terminal, JSON v1.0, Markdown)
- [x] Gemini AI Reasoning & Coverage Gap Analysis
- [ ] GitHub Actions Gatekeeper Workflow Action
- [ ] Webhook Gatekeeper Server (`apps/server`)
- [ ] Mobile Client App integration with stable v1.0 JSON API

---

## License

[MIT](LICENSE) © PreFlight AI Team
