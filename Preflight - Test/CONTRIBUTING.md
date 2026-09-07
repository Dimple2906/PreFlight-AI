# Contributing to PreFlight AI ✈️

Thank you for your interest in contributing to PreFlight AI!

## Development Workflow

1. **Fork and Clone**:
   ```bash
   git clone https://github.com/your-username/preflight.git
   cd preflight
   ```

2. **Install Dependencies**:
   ```bash
   pnpm install
   ```

3. **Build and Typecheck**:
   ```bash
   pnpm build
   pnpm typecheck
   ```

4. **Run Test Suites**:
   ```bash
   pnpm test
   ```

## Coding Conventions

- **Clean Architecture & SOLID**: Keep packages strictly decoupled (`packages/core`, `packages/security`, `packages/qa-engine`, etc.).
- **Deterministic Authority**: AI reasoning must remain advisory. Execution results must drive PASS/FAIL status.
- **Security First**: All new execution code must pass through `ProcessExecutor`, `ExecutionPolicyGuard`, `PathSecurityGuard`, and `SecretSanitizer`.
- **Zero Secret Commits**: Never commit API keys, `.env` secret values, or private credentials.

## Pull Request Guidelines

- Ensure `pnpm build`, `pnpm typecheck`, and `pnpm test` pass with 0 errors.
- Include unit/integration tests for any new checks or capabilities.
