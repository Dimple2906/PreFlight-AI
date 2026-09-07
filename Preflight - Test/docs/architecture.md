# PreFlight AI Architecture & Domain Design

## System Overview

PreFlight AI is a production readiness gatekeeper that enforces deterministic execution as the ultimate authority for project PASS/FAIL status.

```text
CLI / API -> Project Discovery -> Project Classifier -> Execution Engines (QA / Deploy) -> Secret Sanitizer -> AI Reasoning Advisor -> Report Engine
```

## Guiding Principles

1. **Deterministic Authority**: PASS/FAIL is computed solely from command exit codes, static assertions, and system checks.
2. **AI Advisory Role**: AI interprets logs, identifies root causes, highlights coverage gaps, and suggests extra checks without mutating execution authority.
3. **Secret Protection**: All stdout/stderr, environment files, and AI payloads are sanitized through `@preflight/security` before leaving the local machine or hitting the console.
4. **Client Agnostic Core**: Modular workspace packages allow web, CLI, and future mobile (iQOO) clients to consume the engine via clean APIs.
