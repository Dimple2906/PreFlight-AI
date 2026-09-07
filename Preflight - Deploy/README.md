# PreFlight AI — Deployment Engine

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js->=18.0.0-green.svg)](https://nodejs.org/)
[![Checks](https://img.shields.io/badge/Checks-56%20Evaluated-brightgreen.svg)]()
[![Tests](https://img.shields.io/badge/Tests-328%2F328%20PASS-brightgreen.svg)]()

> **Standalone Deployment Safety & Preflight Verification Engine**  
> Autonomous, repository-agnostic safety gatekeeper that catches fatal cloud deployment blockers before code ships to production.

---

## 1. What Is PreFlight AI?

Modern development velocity has skyrocketed thanks to generative AI assistants (Copilot, Cursor, Gemini, Claude) and modern full-stack scaffolding frameworks. While AI can produce syntactically valid code in seconds that builds cleanly on a developer's local laptop (`npm run build` succeeds), **code that builds locally frequently fails catastrophically when packaged or deployed to cloud container environments, serverless platforms, or staging servers**.

Common production deployment blockers include:
- Undocumented environment variables missing from target container manifests.
- Missing or misconfigured production build directories (`dist`, `build`, `.next`, `out`).
- Runtime and engine drift between developer workstations and container hosts.
- Hardcoded localhost network calls (`http://localhost:5000`) baked into production bundles.
- Leaked credentials, API keys, or private tokens committed to source control.
- Git repository hygiene issues (uncommitted changes, untracked critical manifests).

**PreFlight AI Deployment Engine** solves this problem by performing an automated, deterministic pre-deployment safety analysis across any target repository. It operates completely **read-only**, automatically discovering application structures (single projects and monorepos), selecting relevant checks from a registry of 36+ battle-tested rules, and calculating an authoritative deployment verdict: **`[DEPLOYMENT READY]`** (exit code 0) or **`[DEPLOYMENT BLOCKED]`** (exit code 1).

---

## 2. Objective

The objective of the PreFlight AI Deployment Engine is to provide:
1. **Zero-Configuration Autonomous Discovery**: Automatically detect repository topology, package managers, programming languages, application frameworks, databases, and hosting targets without requiring custom configuration files.
2. **Deterministic Safety Gating**: Deliver repeatable, zero-flakiness evaluations where every PASS, WARN, or FAIL verdict is grounded in concrete filesystem and AST evidence.
3. **Context-Aware Scoping**: In monorepo or multi-application workspaces, isolate root container checks (git hygiene, lockfiles) from nested child applications (frontend build output, backend server ports), eliminating false positives.
4. **Intelligent Localhost & Risk Discrimination**: Differentiate dangerous server-to-server loopback binds from benign developer fallback CORS arrays.
5. **Privacy-Preserving AI Diagnosis**: When failures or warnings occur, optionally invoke Google Gemini to generate root-cause explanations and concrete remediation steps, while automatically redacting sensitive tokens and API keys *before* external transmission.

---

## 3. What It Does

PreFlight AI executes a comprehensive suite of static analysis, filesystem inspection, configuration parsing, and AST heuristics:

- **Repository & Project Discovery**: Scans repository roots recursively to locate project markers, package manifests, and configuration boundaries.
- **Single-Project & Monorepo Detection**: Distinguishes standalone repositories from monorepos with multiple nested services.
- **Nested Application Discovery**: Identifies microservices and sub-applications at arbitrary directory depths without hardcoded folder names.
- **Framework Detection**: Detects Next.js, Vite, React, Express, NestJS, Fastify, Vue, Svelte, Django, Spring Boot, etc.
- **Runtime Detection**: Identifies Node.js, Python, Java, Go, Ruby, and PHP runtimes.
- **Package Manager Detection**: Identifies npm, pnpm, yarn, bun, pip, poetry, maven, and gradle.
- **Hosting Target Detection**: Detects deployment platforms including Vercel, AWS Lambda, Docker, Railway, Render, Fly.io, Heroku, and Netlify.
- **Deployment Profile Generation**: Produces a unified deployment specification mapping discovered frameworks, runtimes, and targets.
- **Deterministic Deployment Checks**: Evaluates 36 core check definitions organized into Universal, Technology, and Platform layers.
- **Environment-Variable Manifest Checks**: Confirms that required environment variables are declared and documented in `.env.example`.
- **Secret & Key Redaction**: Scans for leaked credentials (Stripe, GitHub PAT, AWS keys, JWTs) and redacts them immediately.
- **Git State & Hygiene Checks**: Verifies working tree status, uncommitted modifications, and tracked critical files.
- **Build Artifact Output Checks**: Confirms that production bundle directories (`dist`, `build`, `.next`, `out`) exist or build commands succeed.
- **Runtime Compatibility Checks**: Validates declared `engines.node` and runtime specifications against hosting environments.
- **Context-Aware Localhost Heuristics**: Distinguishes critical localhost network calls from non-blocking CORS whitelist arrays.
- **SEO & Static Asset Checks**: Verifies `robots.txt` and `sitemap.xml` presence for frontend web applications.
- **Severity Classification**: Maps findings into CRITICAL, HIGH, MEDIUM, LOW, and INFO severities.
- **Standard Result Statuses**: Categorizes check outcomes as PASS, WARN, FAIL, SKIP, or ERROR.
- **Authoritative Deployment Verdict**: Calculates `deploymentReady: true` or `false` based on blocking CRITICAL/HIGH failures.
- **Structured JSON Output**: Emits comprehensive, machine-parsable JSON reports for CI/CD integration.
- **Markdown Report Generation**: Generates clean, standalone Markdown summaries for deployment audit trails.
- **Optional Gemini AI Analysis**: Leverages Google Gemini models to synthesize actionable root-cause diagnoses.
- **AI Context Sanitization**: Redacts tokens, passwords, and sensitive keys from the AI payload before transmission.
- **Strict Read-Only Inspection**: Inspects the target repository without modifying, moving, or writing any files inside it.

---

## 4. Architecture

### Directory Structure

The PreFlight AI Deployment Engine is structured as follows:

```
PreFlight - Deploy/
├── README.md                           # Comprehensive deployment engine guide (this file)
├── FINAL_PREFLIGHT_AI_REPORT.md        # Technical benchmark report & architecture analysis
├── package.json                        # Node.js project manifest & scripts
├── pnpm-lock.yaml                      # Deterministic dependency lockfile
├── tsconfig.json                       # TypeScript compiler configuration (ES2022 / NodeNext)
├── .gitignore                          # Repository hygiene rules (excludes node_modules, dist, .env)
├── .env.example                        # Template for optional GEMINI_API_KEY
├── Preflight Local test files/         # Automated regression & integration test suites
│   ├── phase1_regression.js            # Discovery & detector regression tests (33 assertions)
│   ├── phase2_hardening.js             # Deployment classification tests (40 assertions)
│   ├── phase2_runner.js                # Check runner & execution tests (53 assertions)
│   ├── phase3_registry.js              # Check registry & applicability tests (84 assertions)
│   ├── phase4_engine.js                # Engine composition & monorepo tests (29 assertions)
│   ├── phase5_engine.js                # End-to-end integration & CLI contract tests (52 assertions)
│   └── phase6_ai.js                    # Gemini AI resilience & sanitization tests (37 assertions)
└── src/                                # Core TypeScript source code
    ├── cli.ts                          # CLI entry point, argument parsing, output formatting
    ├── test.ts                         # Test runner harness executing all test suites
    ├── types/                          # Unified TypeScript interfaces & type definitions
    │   └── index.ts                    # EngineReport, CheckDefinition, ProjectProfile types
    ├── ai/                             # AI integration layer
    │   └── gemini.ts                   # Gemini client, prompt engineering, response validation
    ├── deploy/                         # Deployment engine core
    │   ├── engine.ts                   # Master deployment engine coordinator & markdown reporter
    │   ├── adaptive.ts                 # Adaptive execution module
    │   ├── classification/             # Profile & applicability classification
    │   │   ├── applicability.ts        # Dynamic rule applicability filtering
    │   │   ├── classifier.ts           # Architecture & deployment layer classifier
    │   │   ├── composer.ts             # Multi-project check composition
    │   │   └── deduplication.ts        # Check deduplication across workspaces
    │   ├── registry/                   # Deployment check definitions
    │   │   ├── checks.ts               # Complete registry of 36 deployment check modules
    │   │   ├── groups.ts               # Check group hierarchies & metadata
    │   │   └── index.ts                # Fast lookup maps and filtering utilities
    │   └── checks/                     # Check category stubs
    ├── discovery/                      # Repository structure & technology discovery
    │   ├── classifier.ts               # Workspace classification & fact building
    │   ├── profiles.ts                 # Technology profiling & language detection
    │   ├── project.ts                  # Manifest parsing & project identity resolution
    │   └── detectors/                  # Specialized technology signature detectors
    │       ├── database.ts             # Database detection (Prisma, Mongoose, PostgreSQL, etc.)
    │       ├── framework.ts            # Framework detection (Next.js, Vite, React, Express, etc.)
    │       ├── hosting.ts              # Hosting platform detection (Vercel, Docker, AWS, etc.)
    │       ├── project-type.ts         # Project type detection (Web, API, Library, CLI)
    │       └── runtime.ts              # Runtime environment detection (Node.js, Python, Java)
    └── utils/                          # Cross-cutting utility modules
        ├── command.ts                  # Safe command execution with timeouts
        ├── filesystem.ts               # Fast indexed filesystem traversals & caching
        ├── git.ts                      # Git repository status & ignore inspection
        ├── package.ts                  # Package manifest parsing & dependency queries
        └── sanitize.ts                 # Secret detection, token masking & output sanitization
```

---

## 5. Workflow

The end-to-end execution flow follows a deterministic, 13-step pipeline:

```
1. User provides target repository path via CLI
                         ↓
2. CLI validates path existence and directory integrity
                         ↓
3. Discovery scans target repository (O(1) indexed filesystem traversal)
                         ↓
4. Single-project or Monorepo structure is identified
                         ↓
5. Framework, Runtime, Package Manager, Database, and Hosting detected
                         ↓
6. Scoped Deployment Profiles generated for container root and child apps
                         ↓
7. Applicable checks selected dynamically from the Check Registry
                         ↓
8. Checks execute against the target repository (Strictly Read-Only)
                         ↓
9. Results aggregated and categorized (PASS / WARN / FAIL / SKIP / ERROR)
                         ↓
10. Severity & Blocker calculation (CRITICAL/HIGH failures trigger blockers)
                         ↓
11. Contextual sanitization masks secrets & credentials
                         ↓
12. Optional Gemini AI analysis analyzes failures/warnings asynchronously
                         ↓
13. Final report rendered (Terminal / JSON / Markdown) & Exit code returned
```

---

## 6. Installation

### Prerequisites
- **Node.js**: Version 18.0.0 or higher.
- **pnpm**: Version 8.x or higher (or npm/yarn).
- **Google Gemini API Key**: *(Optional)* Only required if AI root-cause analysis is desired.

### Windows CMD Installation

Open Command Prompt (`cmd.exe`) and run:

```cmd
:: 1. Navigate to the PreFlight - Deploy directory
cd /d "D:\Preflight-Deployment Development\Preflight - Deploy"

:: 2. Install dependencies using pnpm
pnpm install

:: 3. Compile TypeScript to dist
pnpm build
```

*(Replace `D:\Preflight-Deployment Development\Preflight - Deploy` with your actual local path).*

---

## 7. Environment Configuration

PreFlight AI works completely offline and out-of-the-box for deterministic deployment checks. A Gemini API key is **only** required if you wish to enable AI-powered root-cause diagnosis.

### Setting Up the API Key

1. Copy the example environment template:
   ```cmd
   copy .env.example .env
   ```

2. Open `.env` and insert your Google Gemini API key:
   ```env
   GEMINI_API_KEY=AIzaSy...your_actual_key_here
   ```

### Environment Rules & Guarantees
- **Never Commit Secrets**: `.env` is explicitly excluded in `.gitignore`.
- **Zero-Crash Graceful Degradation**: If `GEMINI_API_KEY` is absent, invalid, or hits a rate limit, the CLI continues normally, reports `AI Analysis: Unavailable`, and outputs the deterministic results.
- **Deterministic Invariance**: The presence or absence of Gemini never modifies check statuses, check counts, or the final deployment verdict.

---

## 8. Basic CLI Usage

Run PreFlight AI by pointing it to any local codebase:

```cmd
node dist\cli.js deploy "<TARGET_REPOSITORY>"
```

*(Where `<TARGET_REPOSITORY>` is the absolute or relative path to the codebase being inspected).*

### Example:
```cmd
node dist\cli.js deploy "C:\projects\my-web-app"
```

---

## 9. All Supported CLI Options

| Command / Option | Syntax | Description | Example |
| :--- | :--- | :--- | :--- |
| **deploy** | `node dist\cli.js deploy [path]` | Runs preflight safety checks on target path (default: `.`) | `node dist\cli.js deploy "D:\my-project"` |
| **check** | `node dist\cli.js check [path]` | Alias for `deploy` | `node dist\cli.js check "D:\my-project"` |
| **--no-ai** | `--no-ai` | Disables Gemini AI analysis, running only deterministic checks | `node dist\cli.js deploy "D:\my-project" --no-ai` |
| **--json** | `--json` | Outputs machine-readable `EngineReport` JSON to stdout | `node dist\cli.js deploy "D:\my-project" --json` |
| **--output** | `--output=<file>` or `-o <file>` | Generates and saves a detailed Markdown report to disk | `node dist\cli.js deploy "D:\my-project" --output=report.md` |
| **--skip-build** | `--skip-build` | Skips executing project build scripts during checks | `node dist\cli.js deploy "D:\my-project" --skip-build` |
| **--help** | `--help`, `-h` | Displays CLI usage instructions and available options | `node dist\cli.js --help` |

---

## 10. Live Demo: HireReady Monorepo

We tested PreFlight AI against a complex, real-world full-stack monorepo: **HireReady** (`D:\Hireready - preflight copy`), which contains an Express backend and a Vite/React frontend nested inside a subfolder.

### Demo Command:
```cmd
node dist\cli.js deploy "D:\Hireready - preflight copy"
```

### Verified Live Output:
```text
================================================================================
                       PREFLIGHT AI - DEPLOYMENT SAFETY REPORT                  
================================================================================
Repository:      D:\Hireready - preflight copy
Structure:       Monorepo / Multi-project workspace (2 applications)
Root Container:  No root package.json (workspace container)
Discovered Applications:
  • back-end (D:\Hireready - preflight copy\HireReady-Final\back-end)
    Type: API/backend | Framework: Express | Runtime: Node.js | PM: npm | Hosting: Unknown
  • hireready-frontend (D:\Hireready - preflight copy\HireReady-Final\hireready-frontend)
    Type: web application | Framework: Vite, React | Runtime: Node.js | PM: npm | Hosting: Vercel
AI Analysis:     Available (Gemini)
--------------------------------------------------------------------------------
CHECKS SUMMARY:
  Total Checks Evaluated: 56
  [PASS]    Passed:   50
  [FAIL]    Failed:   0
  [WARN]    Warnings: 5
  [SKIP]    Skipped:  1
  [ERROR]   Errors:   0
--------------------------------------------------------------------------------
WARNINGS & OPERATIONAL REVIEW:

  • [HIGH] [WARN] universal.build.artifact_output_path: Production output directory configured
    Why: No compiled distribution directory (dist/build/.next/out) found locally. Ensure build step runs before deployment packaging.
    Sub-project: back-end
    Guidance: Configure output directory path for generated build artifacts.
    [AI Root Cause]: The build artifact directory (dist, build, out) was not found locally during the deployment readiness check...

  • [MEDIUM] [WARN] DEP-BUILD-003: No hardcoded localhost/127.0.0.1 in production source
    Why: Hardcoded localhost/127.0.0.1 references detected in 2 production source file(s). This may be intentional for local development/CORS...
    Sub-project: back-end
    Evidence: middleware/errorMiddleware.js:11: "http://localhost:5173",

  • [MEDIUM] [WARN] tech.runtime.node.version_compat: Node.js version compatibility
    Why: engines.node version requirement is unconfigured in package.json.
    Sub-project: back-end

  • [MEDIUM] [WARN] tech.runtime.node.version_compat: Node.js version compatibility
    Why: engines.node version requirement is unconfigured in package.json.
    Sub-project: hireready-frontend

  • [LOW] [WARN] DEP-SEO-001: Robots.txt and sitemap discovery presence
    Why: No robots.txt or sitemap.xml discovered in public directories.
    Sub-project: hireready-frontend
--------------------------------------------------------------------------------
VERDICT: [DEPLOYMENT READY]
All critical deployment safety checks passed.
Completed in ~4s
================================================================================
```

---

## 11. Demo Without AI (Deterministic Mode)

To verify the deterministic engine in complete isolation from external network dependencies:

```cmd
node dist\cli.js deploy "D:\Hireready - preflight copy" --no-ai
```

The scan executes in under 2 seconds, evaluating all 56 checks with identical deterministic verdicts.

---

## 12. JSON Output

For automated CI/CD pipeline integration, use the `--json` flag:

```cmd
node dist\cli.js deploy "D:\Hireready - preflight copy" --json
```

The emitted JSON conforms to the `EngineReport` schema, including:
- `repositoryRoot` & `structure` details.
- Discovered sub-project profiles and metadata.
- Array of all 56 executed checks with individual `checkId`, `status`, `severity`, `message`, and `evidence`.
- Aggregated `summary` with `passed`, `failed`, `warnings`, `deploymentReady`, and `blockers`.
- `aiAnalysis` payload containing structured root-cause explanations and remediations.

---

## 13. Automated Testing Battery

The deployment engine is validated by 7 automated test suites comprising 328 distinct assertions with a **100% pass rate**.

### Running the Test Battery:
```cmd
cd /d "D:\Preflight-Deployment Development\Preflight - Deploy"
pnpm test
```

*(Runs `pnpm build && node ./dist/test.js`)*

### Test Suite Breakdown:

| Test Suite File | Focus Area | Assertions Verified | Status |
| :--- | :--- | :--- | :--- |
| **phase1_regression.js** | Project identity, monorepo discovery, framework detectors | **33 / 33** | ✅ PASS |
| **phase2_hardening.js** | Deployment profile classification & scoping rules | **40 / 40** | ✅ PASS |
| **phase2_runner.js** | Check runner & execution tests | **53 / 53** | ✅ PASS |
| **phase3_registry.js** | Check registry integrity, aliases, and applicability | **84 / 84** | ✅ PASS |
| **phase4_engine.js** | Engine composition, monorepo aggregation, blockers | **29 / 29** | ✅ PASS |
| **phase5_engine.js** | End-to-end engine integration, exit codes, Markdown reports | **52 / 52** | ✅ PASS |
| **phase6_ai.js** | Gemini integration, secret sanitization, error resilience | **37 / 37** | ✅ PASS |
| **TOTAL** | **Comprehensive Full-Engine Test Suite** | **328 / 328** | **100% PASS** |

---

## 14. Five-Minute Judge Demo / Quick Start

For judges and evaluators wishing to test and verify PreFlight AI in under 5 minutes:

### Step 1: Open Terminal & Navigate
```cmd
cd /d "D:\Preflight-Deployment Development\Preflight - Deploy"
```

### Step 2: Install & Build
```cmd
pnpm install
pnpm build
```

### Step 3: Run the 328-Assertion Test Battery
```cmd
pnpm test
```
*(Observe all 7 test suites pass cleanly with 328/328 verified assertions).*

### Step 4: Run Deployment Scan on the Real-World Target
```cmd
node dist\cli.js deploy "D:\Hireready - preflight copy"
```

### Step 5: Observe the Result
Observe the CLI autonomously identify both the Express backend and React frontend, evaluate 56 deployment checks, provide Gemini AI contextual advice, and output:
```text
VERDICT: [DEPLOYMENT READY]
All critical deployment safety checks passed.
```

---

## 15. Exit Codes & CI/CD Contract

PreFlight AI adheres to strict Unix exit-code conventions:

| Exit Code | Verdict | Meaning | CI/CD Action |
| :--- | :--- | :--- | :--- |
| **`0`** | **DEPLOYMENT READY** | All critical and high deployment checks passed. May contain non-blocking warnings. | Release allowed to proceed. |
| **`1`** | **DEPLOYMENT BLOCKED** | One or more CRITICAL or HIGH checks failed (fatal blockers). | Deployment pipeline must abort. |
| **`2`** | **FATAL ENGINE ERROR** | Invalid invocation, non-existent target path, or unhandled engine exception. | Pipeline infrastructure error. |

---

## 16. Real Verified Results

Benchmark conducted on a standard Windows 11 development workstation:

| Target Codebase | Topology | Evaluated Checks | Verdict | Execution Time |
| :--- | :--- | :--- | :--- | :--- |
| **HireReady Full-Stack** | Nested Monorepo (Express + React) | 56 checks (50 PASS, 0 FAIL, 5 WARN, 1 SKIP) | **DEPLOYMENT READY** | 1.9s (offline) / 4.2s (with AI) |
| **Automated Test Battery** | 7 Synthetic & Regression Suites | 328 total assertions | **100% PASS** | ~8 seconds |

---

## 17. Example Failure / Blocked Scenario

When PreFlight AI detects a fatal deployment issue (such as uncommitted changes on a production release branch, missing mandatory secrets without defaults, or invalid serverless bundle sizes):

1. The check status is marked **`[FAIL]`** with severity **`CRITICAL`** or **`HIGH`**.
2. The check ID is appended to `summary.blockers`.
3. `summary.deploymentReady` is set to `false`.
4. The terminal prints:
   ```text
   --------------------------------------------------------------------------------
   VERDICT: [DEPLOYMENT BLOCKED]
   Deployment blocked by 1 critical failure(s):
     • [CRITICAL] universal.env.required_keys: Missing mandatory production environment variables
   --------------------------------------------------------------------------------
   ```
5. The process terminates with **exit code 1**, halting CI/CD deployment pipelines immediately.

### Check Status Taxonomy:
- **PASS**: The deployment safety requirement is fully satisfied.
- **WARN**: Operational improvement recommended (e.g., missing robots.txt, unconfigured engines.node); does not block release.
- **FAIL**: Deployment blocker detected; release must not proceed.
- **SKIP**: Check is not applicable to the detected project profile.
- **ERROR**: Execution of the check failed internally.

---

## 18. AI Safety & Privacy Guarantees

PreFlight AI implements robust privacy and resilience protections for external AI calls:

1. **Pre-Flight Sanitization**: Before check failure data is packaged for Google Gemini, `sanitizeForAI()` intercepts the payload and redacts:
   - Stripe API keys (`sk_live_...`, `rk_live_...`)
   - GitHub Personal Access Tokens (`ghp_...`, `github_pat_...`)
   - AWS access credentials (`AKIA...`)
   - Plaintext passwords and connection strings (`postgres://user:pass@host`)
   - JWT tokens (`eyJ...`)
2. **Deterministic Sovereignty**: The LLM is never permitted to determine check statuses or alter exit codes. It acts purely as a contextual diagnostic advisor.
3. **Graceful Fallback**: Network failures or invalid API keys result in `AI Analysis: Unavailable` without interrupting or corrupting the deployment assessment.

---

## 19. Read-Only Safety Guarantee

PreFlight AI enforces a strict **zero-mutation contract**:
- It **never** writes temporary files into the target repository.
- It **never** alters existing source code, manifests, or lockfiles.
- It **never** creates or modifies Git branches, tags, or commits in the target repository.
- Live verification confirmed that the HireReady target repository remained 100% identical before and after scanning.

---

## 20. Limitations & Boundaries

To ensure transparent evaluation:
- **Warning Discretion**: Warnings (such as unconfigured `engines.node` or missing build output directories) highlight operational risks, but do not block deployments unless classified as HIGH/CRITICAL.
- **Static Inferences**: Technology detection is based on repository evidence (manifests, config files, package dependencies). Unusual custom-built project layouts may default to conservative classifications.
- **Build Execution**: When build commands are evaluated, compilation speed depends on project size and local machine performance (can be bypassed using `--skip-build`).

---

## 21. Troubleshooting & FAQ

#### Q: `pnpm : File ... cannot be loaded because running scripts is disabled on this system`
**A**: Windows PowerShell execution policy restricts script execution. Use `pnpm.cmd` instead of `pnpm`, or run commands in standard Command Prompt (`cmd.exe`).

#### Q: `AI Analysis: Unavailable` appears in the report.
**A**: PreFlight AI could not locate a valid `GEMINI_API_KEY`. Verify that `.env` exists in the `PreFlight - Deploy` directory and contains `GEMINI_API_KEY=your_key`, or run with `--no-ai` if AI analysis is not needed.

#### Q: How do I test another local project?
**A**: Pass any absolute or relative path to the deploy command:
```cmd
node dist\cli.js deploy "C:\Users\username\Documents\my-other-project"
```

#### Q: What if the target repository has no Git repository initialized?
**A**: PreFlight AI will flag Git hygiene checks with a non-blocking `[WARN]`, allowing developers to inspect untracked directories safely.

---

## 22. Project Verification Status

- **TypeScript Compilation**: ✅ PASS (`pnpm typecheck` zero errors)
- **Production Build**: ✅ PASS (`pnpm build` compiled to `dist/`)
- **Automated Test Suites**: ✅ 7 / 7 PASSED
- **Total Assertions**: ✅ 328 / 328 VERIFIED (100% Pass Rate)
- **HireReady Real-World Benchmark**: ✅ 56 Checks Evaluated, [DEPLOYMENT READY]
- **Target Repository State**: ✅ Clean / Completely Unmodified
- **Git Push Readiness**: ✅ Clean local folder, no secrets, no temporary artifacts tracked

---

## 23. Development & Maintenance Notes

For developers extending the deployment engine:
1. **Adding New Checks**: Define check metadata in `src/deploy/registry/checks.ts`, register applicability rules in `src/deploy/classification/applicability.ts`, and implement check logic in `src/deploy/engine.ts`.
2. **Rebuilding**: Execute `pnpm build` after modifying TypeScript sources.
3. **Running Tests**: Run `pnpm test` to execute the entire 7-phase regression and integration suite.

---

## 24. Final Quick Command Reference

| Action | Windows Command Prompt (`cmd.exe`) |
| :--- | :--- |
| **Install Dependencies** | `pnpm install` |
| **Typecheck Source** | `pnpm run typecheck` |
| **Compile Build** | `pnpm run build` |
| **Run All 328 Tests** | `pnpm test` |
| **Scan Local Repository** | `node dist\cli.js deploy "<path-to-repo>"` |
| **Scan Without AI (Offline)** | `node dist\cli.js deploy "<path-to-repo>" --no-ai` |
| **Emit JSON Report** | `node dist\cli.js deploy "<path-to-repo>" --json` |
| **Generate Markdown File** | `node dist\cli.js deploy "<path-to-repo>" --output=report.md` |
| **HireReady Live Benchmark** | `node dist\cli.js deploy "D:\Hireready - preflight copy"` |

---
*Developed by the PreFlight AI Team. Built for dependable, automated software releases.*
