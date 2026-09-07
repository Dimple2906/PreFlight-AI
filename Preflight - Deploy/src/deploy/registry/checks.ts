import { CheckDefinition, RejectedCheckDefinition } from '../../types';

/**
 * Candidate checks evaluated from research and knowledge bases that were
 * explicitly rejected from the deployment check registry, along with technical rationale.
 */
export const REJECTED_DEPLOYMENT_CHECKS: RejectedCheckDefinition[] = [
  {
    id: 'INF-TEST-001',
    name: 'Clean Automated Test Suite Execution Pass',
    source: 'deploy_checklist.pdf (page 60)',
    reason: 'OUT_OF_SCOPE_UNIT_TEST',
    rationale: 'PreFlight deployment-readiness CLI inspects deployment configuration, infrastructure manifests, and release artifacts. Executing application unit and integration test suites is the domain of test runners (Jest, Vitest, PyTest) during earlier CI pipeline stages, not deployment safety checks.',
    originalCategory: 'CI_CD',
    recommendedLayer: 'CI/CD Pipeline Test Stage'
  },
  {
    id: 'INF-LINT-001',
    name: 'Static Type Checking and Linter Validation',
    source: 'deploy_checklist.pdf (page 61)',
    reason: 'OUT_OF_SCOPE_LINTING',
    rationale: 'Code style enforcement, ESLint lint rules, and pure static type-checking passes are pre-commit and CI lint stage responsibilities. PreFlight focuses strictly on build and deployment configuration boundaries, artifact presence, and cloud runtime safety.',
    originalCategory: 'BUILD',
    recommendedLayer: 'Pre-commit / CI Code Quality Stage'
  },
  {
    id: 'INF-SEC-001',
    name: 'Dependency Known Critical CVE Audit',
    source: 'deploy_checklist.pdf (page 62)',
    reason: 'OUT_OF_SCOPE_REMOTE_NETWORK',
    rationale: 'Querying external remote CVE vulnerability databases (npm audit, Snyk, OSV) requires unauthenticated or authenticated outbound network calls and vulnerability feeds. PreFlight enforces deterministic local file and configuration boundary inspections without non-deterministic live network dependencies.',
    originalCategory: 'SECURITY',
    recommendedLayer: 'Security Scanner / SCA Pipeline Stage'
  }
];

/**
 * Master catalog of all deployment check definitions.
 * Categorized by the Five-Layer Composition Model:
 * 1. UNIVERSAL
 * 2. PROJECT_TYPE
 * 3. TECHNOLOGY (Languages, Frameworks, Runtimes, Databases, ORMs, Tooling)
 * 4. DEPLOYMENT_TARGET (Hosting / Cloud Providers)
 * 5. INFRASTRUCTURE / OPERATIONAL (CI/CD, Containers, Orchestration, IaC)
 *
 * Each check is declarative:
 * - layer, domain, area, classification
 * - category, executionType, remediation, evidenceRequirements, tags
 * - severity, automationLevel, profileLevel
 * - dedupKey (optional canonical requirement identifier)
 * - predicates (declarative requirement selectors)
 * - aliases (backward-compatible IDs and standard aliases)
 * - expectedBehavior, passCondition, failCondition, source
 */
export const DEPLOYMENT_CHECK_REGISTRY: CheckDefinition[] = [
  {
    id: "universal.git.clean_state",
    name: "Git clean deployment commit",
    category: "GIT",
    layer: "UNIVERSAL",
    domain: "git",
    area: "vcs",
    classification: "UNIVERSAL",
    description: "Verifies the deployment source is committed and has a recognized deployment commit SHA.",
    severity: "HIGH",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "COMMAND",
    remediation: {
      "summary": "Commit all working directory modifications and staging index changes prior to deployment release.",
      "guidance": "Deploying uncommitted changes leads to non-reproducible builds where local debug edits contaminate production.",
      "steps": [
            "Run \"git status\" to inspect uncommitted files.",
            "Stage intended modifications via \"git add .\"",
            "Create release commit via \"git commit -m \\\"chore: release\\\"\"."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["git status output","HEAD commit SHA"],
    tags: ["git","universal","vcs"],
    aliases: ["universal.git.clean_state","DEP-GIT-001","UNI-001"],
    expectedBehavior: "Working tree must be completely clean (HEAD matches working directory).",
    passCondition: "git status --porcelain returns exit code 0 with an empty string output.",
    failCondition: "git status --porcelain returns one or more lines of output indicating staged or unstaged file modifications, deletions, or renames on tracked files.",
    source: "Git Documentation (Worktree & Index Reference); Twelve-Factor App (I. Codebase).",
  },
  {
    id: "universal.git.tracked_files",
    name: "Required repository files tracked",
    category: "GIT",
    layer: "UNIVERSAL",
    domain: "git",
    area: "vcs",
    classification: "UNIVERSAL",
    description: "Ensures essential source and configuration files are tracked in version control and not ignored.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "FILESYSTEM",
    remediation: {
      "summary": "Ensure core application source files and manifests are tracked in version control.",
      "guidance": "Essential files like package.json or source manifests missing from git causes missing build dependencies on CI runners.",
      "steps": [
            "Check .gitignore for over-broad ignore patterns.",
            "Add missing core manifests via \"git add -f <file>\"."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["tracked files tree","manifest existence"],
    tags: ["git","universal","tracking"],
    aliases: ["universal.git.tracked_files","DEP-GIT-002"],
    expectedBehavior: "Deployable artifact must satisfy Required repository files tracked requirements.",
    passCondition: "All configuration parameters and files for Required repository files tracked are valid.",
    failCondition: "Missing or invalid configuration detected for Required repository files tracked.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "universal.env.manifest_presence",
    name: "Environment variable declaration presence",
    category: "ENVIRONMENT",
    layer: "UNIVERSAL",
    domain: "environment",
    area: "configuration",
    classification: "UNIVERSAL",
    description: "Ensures required production environment variables or template files (.env.example) are declared.",
    severity: "CRITICAL",
    automationLevel: "PARTIALLY_AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Provide an environment template file (.env.example or schema) declaring all required production environment variables.",
      "guidance": "Without an environment template or schema, deployment targets cannot verify whether all required configuration variables are present.",
      "steps": [
            "Create .env.example declaring all required environment keys.",
            "Document expected values or secret store locations for each key."
      ],
      "autoFixable": true
},
    evidenceRequirements: [".env.example or schema manifest"],
    tags: ["environment","universal","config"],
    aliases: ["universal.env.manifest_presence","DEP-ENV-001","UNI-005"],
    expectedBehavior: "All non-defaulted environment variables used in code must be declared in .env.example or hosting configuration manifests.",
    passCondition: "100% of runtime environment variable references without inline defaults are declared in .env.example or platform deployment descriptors.",
    failCondition: "Application source files access environment variables that are missing from .env.example and missing from explicit platform deployment manifests, where the variable does not have an inline fallback/default value.",
    source: "Twelve-Factor App (III. Config).",
  },
  {
    id: "universal.env.no_committed_secrets",
    name: "No committed sensitive credentials or .env files",
    category: "SECURITY",
    layer: "UNIVERSAL",
    domain: "environment",
    area: "security",
    classification: "UNIVERSAL",
    description: "Prevents committed live secret files (.env, private keys, service tokens) from entering build pipeline.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "STATIC",
    remediation: {
      "summary": "Remove committed private credential files and raw secrets from git history.",
      "guidance": "Committed secrets (.env, id_rsa, service account JSON) allow anyone with repository read access to compromise infrastructure.",
      "steps": [
            "Add .env* (except .env.example) to .gitignore.",
            "Untrack secret files using \"git rm --cached <file>\".",
            "Rotate any exposed credentials immediately."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["scanned repo files list","gitignore content"],
    tags: ["security","universal","secrets"],
    aliases: ["universal.env.no_committed_secrets","DEP-ENV-002","UNI-003"],
    expectedBehavior: "All sensitive credentials must be loaded at runtime via environment variables or secret management systems.",
    passCondition: "Zero hardcoded private keys, vendor API tokens, or high- entropy credential assignments found outside of explicitly ignored test mocks.",
    failCondition: "Repository files contain unmasked, unencrypted vendor- specific API credentials, private key headers, or high-entropy assignments to variable names containing SECRET, PASSWORD, PRIVATE_KEY, or TOKEN.",
    source: "OWASP Top 10 (A02:2021-Cryptographic Failures); GitHub Secret Scanning Documentation.",
  },
  {
    id: "universal.dependencies.lockfile_present",
    name: "Dependency lockfile consistency",
    category: "DEPENDENCIES",
    layer: "UNIVERSAL",
    domain: "dependencies",
    area: "dependencies",
    classification: "UNIVERSAL",
    description: "Verifies that a reproducible lockfile exists and matches project dependency definitions.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "FILESYSTEM",
    remediation: {
      "summary": "Generate and commit a deterministic package manager lockfile (package-lock.json, pnpm-lock.yaml, yarn.lock, etc.).",
      "guidance": "Missing lockfiles result in non-deterministic dependency resolution during deployment, causing unexpected dependency version drift.",
      "steps": [
            "Run your package manager installation locally (e.g. npm install, pnpm install).",
            "Commit the generated lockfile to version control."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["lockfile path and signature"],
    tags: ["dependencies","universal","lockfile"],
    dedupKey: "dependencies.lockfile_integrity",
    aliases: ["universal.dependencies.lockfile_present","DEP-DEPS-001","UNI-006"],
    expectedBehavior: "Lockfile must exist, be committed to Git, and be completely synchronized with the manifest file.",
    passCondition: "A valid lockfile exists for the detected package manager, is tracked in Git, and accurately reflects all dependencies declared in the primary package manifest.",
    failCondition: "Primary dependency manifest exists, but no corresponding lockfile exists; or the manifest file modification timestamp is newer than the lockfile and the lockfile is missing newly added direct dependencies.",
    source: "Official documentation for npm, Cargo, Poetry, Composer, Bundler.",
  },
  {
    id: "universal.dependencies.no_conflict_lockfiles",
    name: "No conflicting multiple lockfiles",
    category: "DEPENDENCIES",
    layer: "UNIVERSAL",
    domain: "dependencies",
    area: "dependencies",
    classification: "UNIVERSAL",
    description: "Guarantees the deployment target installs dependencies deterministically with a single unambiguous package manager.",
    severity: "HIGH",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "FILESYSTEM",
    remediation: {
      "summary": "Remove redundant lockfiles from conflicting package managers.",
      "guidance": "Having multiple lockfiles (e.g. package-lock.json alongside yarn.lock or pnpm-lock.yaml) causes build runners to guess or invoke conflicting installation tools.",
      "steps": [
            "Identify the primary project package manager.",
            "Delete secondary lockfiles from repository.",
            "Ensure only single corresponding lockfile is tracked."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["detected lockfile list"],
    tags: ["dependencies","universal","lockfile"],
    aliases: ["universal.dependencies.no_conflict_lockfiles","DEP-DEPS-002","PKG-002"],
    expectedBehavior: "Exactly one lockfile must be present matching the intended package manager.",
    passCondition: "Exactly one authoritative lockfile exists in the repository.",
    failCondition: "More than one lockfile type exists simultaneously in the repository root.",
    source: "Corepack Documentation; Vercel Buildpack Specifications.",
  },
  {
    id: "universal.runtime.declared",
    name: "Runtime declaration known",
    category: "RUNTIME",
    layer: "UNIVERSAL",
    domain: "runtime",
    area: "runtime",
    classification: "UNIVERSAL",
    description: "Confirms the target execution runtime (e.g. Node.js version, Python version, Go toolchain) is explicitly declared.",
    severity: "HIGH",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Declare explicit execution runtime version in package.json engines, .nvmrc, runtime.txt, or Dockerfile.",
      "guidance": "Undeclared runtime versions default to arbitrary cloud platform versions, leading to syntax errors or API incompatibilities.",
      "steps": [
            "Add \"engines\": { \"node\": \">=20.0.0\" } to package.json or write version to .nvmrc / runtime.txt."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["runtime manifest declaration"],
    tags: ["runtime","universal","version"],
    aliases: ["universal.runtime.declared","DEP-RUNTIME-001"],
    expectedBehavior: "Deployable artifact must satisfy Runtime declaration known requirements.",
    passCondition: "All configuration parameters and files for Runtime declaration known are valid.",
    failCondition: "Missing or invalid configuration detected for Runtime declaration known.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "universal.build.config_valid",
    name: "Production build configuration valid",
    category: "BUILD",
    layer: "UNIVERSAL",
    domain: "build",
    area: "build",
    classification: "UNIVERSAL",
    description: "Verifies the build pipeline has a valid build command or artifact target defined.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Define an unambiguous production build script in package.json or build tool configuration.",
      "guidance": "A missing or broken build command prevents deployment pipelines from creating production distribution bundles.",
      "steps": [
            "Ensure \"scripts.build\" exists in package.json and compiles source files."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["package.json scripts.build"],
    tags: ["build","universal","scripts"],
    aliases: ["universal.build.config_valid","DEP-BUILD-001","NODE-002"],
    expectedBehavior: "package.json must contain a scripts.start definition pointing to the application production entrypoint.",
    passCondition: "package.json defines a valid scripts.start command that executes a compiled production entrypoint with node.",
    failCondition: "package.json contains no scripts.start entry, and no server.js file exists in the repository root.",
    source: "npm CLI Documentation (npm-start specification).",
  },
  {
    id: "universal.build.artifact_output_path",
    name: "Production output directory configured",
    category: "BUILD",
    layer: "UNIVERSAL",
    domain: "build",
    area: "build",
    classification: "UNIVERSAL",
    description: "Validates that the production artifact/distribution directory is properly specified.",
    severity: "HIGH",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "CONFIG",
    remediation: {
      "summary": "Configure output directory path for generated build artifacts.",
      "guidance": "Hosting targets require a defined distribution directory (dist, out, .next, build) to serve assets.",
      "steps": [
            "Confirm output directory setting in bundler configuration (vite.config, next.config, tsconfig, etc.)."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["bundler output dir declaration"],
    tags: ["build","universal","artifacts"],
    aliases: ["universal.build.artifact_output_path","DEP-BUILD-002"],
    expectedBehavior: "Deployable artifact must satisfy Production output directory configured requirements.",
    passCondition: "All configuration parameters and files for Production output directory configured are valid.",
    failCondition: "Missing or invalid configuration detected for Production output directory configured.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "project_type.web.start_command",
    name: "Web production start command",
    category: "PROJECT_TYPE",
    layer: "PROJECT_TYPE",
    domain: "web",
    area: "process",
    classification: "WEB_APPLICATION",
    description: "Ensures a production start script exists to serve web requests.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Define a production start script (e.g. \"npm start\") in package.json.",
      "guidance": "Web servers in containerized or PaaS environments must know the exact daemon execution command.",
      "steps": [
            "Add \"start\": \"node dist/server.js\" or equivalent to package.json scripts."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["package.json scripts.start"],
    tags: ["web","project-type","start"],
    aliases: ["project_type.web.start_command","DEP-WEB-001"],
    predicates: {
      "projectTypes": [
            "web application",
            "fullstack",
            "frontend"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy Web production start command requirements.",
    passCondition: "All configuration parameters and files for Web production start command are valid.",
    failCondition: "Missing or invalid configuration detected for Web production start command.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "project_type.web.port_binding",
    name: "Web port binding configuration",
    category: "PROJECT_TYPE",
    layer: "PROJECT_TYPE",
    domain: "web",
    area: "network",
    classification: "WEB_APPLICATION",
    description: "Verifies server listens on PORT environment variable rather than hardcoded localhost.",
    severity: "HIGH",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "AST",
    remediation: {
      "summary": "Bind web server port using process.env.PORT instead of hardcoded localhost port.",
      "guidance": "Cloud platforms dynamically allocate container ports via the PORT environment variable.",
      "steps": [
            "Update server listen call to use \"process.env.PORT || 3000\"."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["server listen port binding expression"],
    tags: ["web","network","port"],
    dedupKey: "network.port_binding",
    aliases: ["project_type.web.port_binding","DEP-WEB-002","EXPR-001"],
    predicates: {
      "projectTypes": [
            "web application",
            "fullstack",
            "frontend"
      ]
},
    expectedBehavior: "Containerized web services must bind to 0.0.0.0.",
    passCondition: "Server listen explicitly passes '0.0.0.0' or reads the host interface dynamically from an environment variable (e.g., process.env.HOST || '0.0.0.0').",
    failCondition: "The server listen method explicitly binds to 'localhost' or '127.0.0.1', or Fastify is invoked without setting host: '0.0.0.0' inside a container deployment.",
    source: "Fastify Documentation (Getting Started - Server address); Docker Networking Fundamentals.",
  },
  {
    id: "project_type.web.health_endpoint",
    name: "Web application health check route",
    category: "PROJECT_TYPE",
    layer: "PROJECT_TYPE",
    domain: "web",
    area: "observability",
    classification: "WEB_APPLICATION",
    description: "Ensures an HTTP health endpoint is available for ingress load-balancers.",
    severity: "MEDIUM",
    automationLevel: "PARTIALLY_AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "AST",
    remediation: {
      "summary": "Implement a dedicated HTTP health check endpoint (e.g. /healthz or /api/health).",
      "guidance": "Orchestrators and load balancers rely on lightweight health endpoints for zero-downtime rolling updates.",
      "steps": [
            "Add a GET /healthz route returning 200 OK."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["health endpoint route declaration"],
    tags: ["web","observability","health"],
    aliases: ["project_type.web.health_endpoint","DEP-WEB-003"],
    predicates: {
      "projectTypes": [
            "web application",
            "fullstack"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy Web application health check route requirements.",
    passCondition: "All configuration parameters and files for Web application health check route are valid.",
    failCondition: "Missing or invalid configuration detected for Web application health check route.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "project_type.web.asset_caching",
    name: "Static asset caching & compression",
    category: "PROJECT_TYPE",
    layer: "PROJECT_TYPE",
    domain: "web",
    area: "performance",
    classification: "WEB_APPLICATION",
    description: "Verifies cache-control headers and static asset delivery configuration.",
    severity: "LOW",
    automationLevel: "PARTIALLY_AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "CONFIG",
    remediation: {
      "summary": "Configure Cache-Control headers for immutable hashed static assets.",
      "guidance": "Missing cache headers degrade frontend performance and increase bandwidth costs.",
      "steps": [
            "Add Cache-Control: public, max-age=31536000, immutable for hashed assets in server or hosting config."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["cache-control configuration"],
    tags: ["web","performance","cache"],
    aliases: ["project_type.web.asset_caching","DEP-WEB-004"],
    predicates: {
      "projectTypes": [
            "web application",
            "fullstack",
            "frontend"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy Static asset caching & compression requirements.",
    passCondition: "All configuration parameters and files for Static asset caching & compression are valid.",
    failCondition: "Missing or invalid configuration detected for Static asset caching & compression.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "project_type.api.port_binding",
    name: "API host & port binding",
    category: "PROJECT_TYPE",
    layer: "PROJECT_TYPE",
    domain: "api",
    area: "network",
    classification: "API_BACKEND",
    description: "Ensures backend server binds to 0.0.0.0 and dynamically respects PORT.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "AST",
    remediation: {
      "summary": "Ensure API backend binds to 0.0.0.0 and dynamically respects PORT.",
      "guidance": "Binding to 127.0.0.1 prevents container ingress routers from forwarding requests to the service.",
      "steps": [
            "Set host to \"0.0.0.0\" and port to process.env.PORT in server.listen()."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["server listen host and port parameters"],
    tags: ["api","network","port"],
    dedupKey: "network.port_binding",
    aliases: ["project_type.api.port_binding","DEP-API-001","EXPR-002"],
    predicates: {
      "projectTypes": [
            "API/backend",
            "service",
            "microservice",
            "fullstack"
      ]
},
    expectedBehavior: "Application must bind to process.env.PORT.",
    passCondition: "Port is bound via process.env.PORT (e.g., const PORT = process.env.PORT || 3000).",
    failCondition: "The listening port is hardcoded as an integer literal without an environment fallback (e.g., app.listen(3000)).",
    source: "Twelve-Factor App (VII. Port Binding).",
  },
  {
    id: "project_type.api.cors_configuration",
    name: "API CORS allowed origins configuration",
    category: "PROJECT_TYPE",
    layer: "PROJECT_TYPE",
    domain: "api",
    area: "security",
    classification: "API_BACKEND",
    description: "Checks that production CORS origins are configured via environment and not open wildcard.",
    severity: "HIGH",
    automationLevel: "PARTIALLY_AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "AST",
    remediation: {
      "summary": "Parameterize CORS allowed origins instead of using open wildcard in production.",
      "guidance": "Using Access-Control-Allow-Origin: * on authenticated APIs exposes users to cross-site request hijacking.",
      "steps": [
            "Configure CORS middleware to read allowed origins from an environment variable."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["CORS configuration middleware AST"],
    tags: ["api","security","cors"],
    aliases: ["project_type.api.cors_configuration","DEP-API-002"],
    predicates: {
      "projectTypes": [
            "API/backend",
            "service",
            "microservice",
            "fullstack"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy API CORS allowed origins configuration requirements.",
    passCondition: "All configuration parameters and files for API CORS allowed origins configuration are valid.",
    failCondition: "Missing or invalid configuration detected for API CORS allowed origins configuration.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "project_type.api.graceful_shutdown",
    name: "SIGTERM/SIGINT graceful shutdown handling",
    category: "PROJECT_TYPE",
    layer: "PROJECT_TYPE",
    domain: "api",
    area: "process",
    classification: "API_BACKEND",
    description: "Verifies server terminates active connections cleanly when orchestrator sends SIGTERM.",
    severity: "MEDIUM",
    automationLevel: "PARTIALLY_AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "AST",
    remediation: {
      "summary": "Add SIGTERM and SIGINT process event listeners to gracefully drain active HTTP connections.",
      "guidance": "Abruptly killing the process during rolling deployments causes 502 Bad Gateway errors for clients in-flight.",
      "steps": [
            "Listen to process.on(\"SIGTERM\") and invoke server.close() followed by closing database pools."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["SIGTERM handler declaration"],
    tags: ["api","reliability","shutdown"],
    aliases: ["project_type.api.graceful_shutdown","DEP-API-003","EXPR-004"],
    predicates: {
      "projectTypes": [
            "API/backend",
            "service",
            "microservice",
            "fullstack"
      ]
},
    expectedBehavior: "Server must handle SIGTERM and cleanly close active network listeners.",
    passCondition: "Application binds process.on('SIGTERM') and invokes server connection draining and database pool termination.",
    failCondition: "No signal handlers exist for SIGTERM in backend HTTP entrypoint files.",
    source: "Kubernetes Documentation (Pod Lifecycle - Termination); Node.js Process Documentation.",
  },
  {
    id: "project_type.cli.bin_entrypoint",
    name: "CLI executable binary entrypoint",
    category: "PROJECT_TYPE",
    layer: "PROJECT_TYPE",
    domain: "cli",
    area: "distribution",
    classification: "CLI",
    description: "Ensures the executable file referenced in package.json bin exists and has executable shebang.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "FILESYSTEM",
    remediation: {
      "summary": "Ensure executable referenced in package.json bin exists and contains #!/usr/bin/env node shebang.",
      "guidance": "Missing shebang or binary target causes \"command not found\" errors when consumers execute via npx or global install.",
      "steps": [
            "Add #!/usr/bin/env node at the very top of the bin target file and verify file exists."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["bin entrypoint file existence and shebang header"],
    tags: ["cli","distribution","binary"],
    aliases: ["project_type.cli.bin_entrypoint","DEP-CLI-001","TYP-CLI-001"],
    predicates: {
      "projectTypes": [
            "CLI",
            "command-line",
            "tool"
      ]
},
    expectedBehavior: "First line of executable CLI file must declare a valid shebang directive.",
    passCondition: "The entrypoint begins with a valid portable shebang: #!/usr/bin/env node.",
    failCondition: "The declared CLI entrypoint file does not start with #!/usr/bin/env <runtime>.",
    source: "POSIX Executable Script Standards; npm Documentation (package.json bin field).",
  },
  {
    id: "project_type.cli.package_metadata",
    name: "CLI version and description metadata",
    category: "PROJECT_TYPE",
    layer: "PROJECT_TYPE",
    domain: "cli",
    area: "packaging",
    classification: "CLI",
    description: "Ensures CLI has valid semantic versioning and metadata for global/npx execution.",
    severity: "HIGH",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "CONFIG",
    remediation: {
      "summary": "Populate package.json with valid version, description, and license metadata.",
      "guidance": "Publishing CLI packages without semver and description causes publishing failures or unsearchable packages on npm.",
      "steps": [
            "Add version, description, and license fields to package.json."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["package.json metadata fields"],
    tags: ["cli","packaging","metadata"],
    aliases: ["project_type.cli.package_metadata","DEP-CLI-002","TYP-CLI-002"],
    predicates: {
      "projectTypes": [
            "CLI",
            "command-line",
            "tool"
      ]
},
    expectedBehavior: "Target binary file must exist on disk with executable permissions set.",
    passCondition: "The binary target exists on disk and POSIX permissions evaluate to executable.",
    failCondition: "The file declared in bin does not exist on disk, or lacks executable permissions (chmod+x).",
    source: "npm CLI Documentation (bin field specification).",
  },
  {
    id: "project_type.library.entrypoints",
    name: "Library entrypoints (main / module / types)",
    category: "PROJECT_TYPE",
    layer: "PROJECT_TYPE",
    domain: "library",
    area: "packaging",
    classification: "LIBRARY",
    description: "Verifies main, module, and TypeScript declaration files referenced in package.json exist after build.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Verify main, module, and types fields in package.json point to valid build target files.",
      "guidance": "Incorrect entrypoint pointers cause downstream consumers to encounter module resolution errors upon import.",
      "steps": [
            "Ensure dist/index.js and dist/index.d.ts match main and types declarations."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["package.json exports/main/module/types definitions"],
    tags: ["library","packaging","entrypoints"],
    aliases: ["project_type.library.entrypoints","DEP-LIB-001"],
    predicates: {
      "projectTypes": [
            "library",
            "package",
            "module",
            "sdk"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy Library entrypoints (main / module / types) requirements.",
    passCondition: "All configuration parameters and files for Library entrypoints (main / module / types) are valid.",
    failCondition: "Missing or invalid configuration detected for Library entrypoints (main / module / types).",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "project_type.library.npm_publish_files",
    name: "Package publishing files whitelist / .npmignore",
    category: "PROJECT_TYPE",
    layer: "PROJECT_TYPE",
    domain: "library",
    area: "distribution",
    classification: "LIBRARY",
    description: "Ensures only compiled artifacts are published and source test suites are excluded.",
    severity: "HIGH",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "CONFIG",
    remediation: {
      "summary": "Configure \"files\" whitelist or .npmignore to prevent leaking tests, mocks, or local config.",
      "guidance": "Publishing without a whitelist pollutes npm bundles and risks leaking internal credentials or development keys.",
      "steps": [
            "Add \"files\": [\"dist\", \"README.md\"] to package.json."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["package.json files field or .npmignore"],
    tags: ["library","distribution","packaging"],
    aliases: ["project_type.library.npm_publish_files","DEP-LIB-002","TYP-LIB-001"],
    predicates: {
      "projectTypes": [
            "library",
            "package",
            "module",
            "sdk"
      ]
},
    expectedBehavior: "The files field in package.json must whitelist the compiled output artifacts directory.",
    passCondition: "files includes the compiled output folder, and the files referenced in main and types exist within that folder.",
    failCondition: "The files field in package.json omits the compiled distribution directory referenced by main or types.",
    source: "npm Documentation (package.json files field).",
  },
  {
    id: "project_type.worker.entrypoint",
    name: "Worker process entrypoint",
    category: "PROJECT_TYPE",
    layer: "PROJECT_TYPE",
    domain: "worker",
    area: "process",
    classification: "WORKER",
    description: "Ensures background queue worker or job process has an executable entrypoint.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "FILESYSTEM",
    remediation: {
      "summary": "Ensure worker process has an executable entrypoint script declared in process manager or package.json.",
      "guidance": "Background workers need dedicated executable targets distinct from web HTTP entrypoints.",
      "steps": [
            "Add a script (e.g. \"worker\": \"node dist/worker.js\") or declare Procfile worker process."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["worker script target file"],
    tags: ["worker","process","entrypoint"],
    aliases: ["project_type.worker.entrypoint","DEP-WRK-001"],
    predicates: {
      "projectTypes": [
            "worker",
            "job",
            "background",
            "queue"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy Worker process entrypoint requirements.",
    passCondition: "All configuration parameters and files for Worker process entrypoint are valid.",
    failCondition: "Missing or invalid configuration detected for Worker process entrypoint.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "project_type.worker.queue_connection",
    name: "Worker message queue / Redis configuration",
    category: "PROJECT_TYPE",
    layer: "PROJECT_TYPE",
    domain: "worker",
    area: "infrastructure",
    classification: "WORKER",
    description: "Validates queue URL and connection strings are parameterized via environment variables.",
    severity: "CRITICAL",
    automationLevel: "PARTIALLY_AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Ensure queue connection URI (REDIS_URL, AMQP_URL, SQS_QUEUE_URL) is parameterized via environment variables.",
      "guidance": "Hardcoded queue endpoints prevent workers from connecting to cloud-managed queues in production.",
      "steps": [
            "Parameterize queue connection strings using process.env."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["queue connection parameters"],
    tags: ["worker","infrastructure","queue"],
    aliases: ["project_type.worker.queue_connection","DEP-WRK-002"],
    predicates: {
      "projectTypes": [
            "worker",
            "job",
            "background",
            "queue"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy Worker message queue / Redis configuration requirements.",
    passCondition: "All configuration parameters and files for Worker message queue / Redis configuration are valid.",
    failCondition: "Missing or invalid configuration detected for Worker message queue / Redis configuration.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "project_type.worker.shutdown_idempotency",
    name: "Worker graceful job drain & idempotency",
    category: "PROJECT_TYPE",
    layer: "PROJECT_TYPE",
    domain: "worker",
    area: "reliability",
    classification: "WORKER",
    description: "Ensures in-flight tasks finish processing or release locks gracefully on container restart.",
    severity: "MEDIUM",
    automationLevel: "MANUAL",
    profileLevel: "COMPLETE",
    executionType: "MANUAL",
    remediation: {
      "summary": "Verify worker job processing handles retries idempotently and drains queue listeners on SIGTERM.",
      "guidance": "Non-idempotent background jobs cause duplicate side-effects (e.g. sending duplicate emails or billing twice) during crashes.",
      "steps": [
            "Use idempotency keys or transaction locks for external side effects in worker tasks."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["idempotency logic and graceful drain handler"],
    tags: ["worker","reliability","idempotency"],
    aliases: ["project_type.worker.shutdown_idempotency","DEP-WRK-003"],
    predicates: {
      "projectTypes": [
            "worker",
            "job",
            "background",
            "queue"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy Worker graceful job drain & idempotency requirements.",
    passCondition: "All configuration parameters and files for Worker graceful job drain & idempotency are valid.",
    failCondition: "Missing or invalid configuration detected for Worker graceful job drain & idempotency.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "project_type.static.output_directory",
    name: "Static export publish directory",
    category: "PROJECT_TYPE",
    layer: "PROJECT_TYPE",
    domain: "static",
    area: "build",
    classification: "STATIC_FRONTEND",
    description: "Ensures static HTML/CSS/JS export directory is generated by build script.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Ensure static HTML build command produces files into configured output directory.",
      "guidance": "Static web hosts (Netlify, Cloudflare Pages, S3) will return 404 if the publish directory does not match the build output.",
      "steps": [
            "Align build script target output folder (e.g. dist, out) with hosting publish configuration."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["output directory build target"],
    tags: ["static","build","output"],
    aliases: ["project_type.static.output_directory","DEP-STATIC-001"],
    predicates: {
      "projectTypes": [
            "static frontend"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy Static export publish directory requirements.",
    passCondition: "All configuration parameters and files for Static export publish directory are valid.",
    failCondition: "Missing or invalid configuration detected for Static export publish directory.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "project_type.static.spa_routing_fallback",
    name: "SPA 404 / 200 rewrite fallback",
    category: "PROJECT_TYPE",
    layer: "PROJECT_TYPE",
    domain: "static",
    area: "routing",
    classification: "STATIC_FRONTEND",
    description: "Checks for single page app rewrite rules to index.html for client-side routing.",
    severity: "HIGH",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "CONFIG",
    remediation: {
      "summary": "Configure 404/index.html rewrite fallback rules for Single Page Application routing.",
      "guidance": "Without rewrite rules, reloading any non-root route on a static CDN returns 404 Not Found.",
      "steps": [
            "Add rewrite rule directing unmatched routes to /index.html in vercel.json, netlify.toml, or cloud configuration."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["SPA fallback rewrite rules"],
    tags: ["static","routing","spa"],
    aliases: ["project_type.static.spa_routing_fallback","DEP-STATIC-002"],
    predicates: {
      "projectTypes": [
            "static frontend"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy SPA 404 / 200 rewrite fallback requirements.",
    passCondition: "All configuration parameters and files for SPA 404 / 200 rewrite fallback are valid.",
    failCondition: "Missing or invalid configuration detected for SPA 404 / 200 rewrite fallback.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "project_type.desktop.binary_packaging",
    name: "Desktop app packaging configuration",
    category: "DESKTOP",
    layer: "PROJECT_TYPE",
    domain: "desktop",
    area: "distribution",
    classification: "DESKTOP",
    description: "Verifies electron-builder, tauri.conf.json, or packaging targets exist for desktop distribution.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Configure electron-builder or tauri.conf.json packaging targets and release bundles.",
      "guidance": "Desktop applications cannot be distributed without target OS artifact bundlers configured.",
      "steps": [
            "Configure electron-builder config in package.json or create src-tauri/tauri.conf.json."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["desktop packaging configuration file"],
    tags: ["desktop","packaging","electron","tauri"],
    aliases: ["project_type.desktop.binary_packaging","DEP-DSK-001"],
    predicates: {
      "projectTypes": [
            "desktop",
            "electron",
            "tauri"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy Desktop app packaging configuration requirements.",
    passCondition: "All configuration parameters and files for Desktop app packaging configuration are valid.",
    failCondition: "Missing or invalid configuration detected for Desktop app packaging configuration.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "project_type.desktop.code_signing",
    name: "Desktop platform code signing certificates",
    category: "DESKTOP",
    layer: "PROJECT_TYPE",
    domain: "desktop",
    area: "security",
    classification: "DESKTOP",
    description: "Validates code signing identity parameters for OS distribution (Windows Authenticode / macOS Notarization).",
    severity: "HIGH",
    automationLevel: "MANUAL",
    profileLevel: "COMPLETE",
    executionType: "CONFIG",
    remediation: {
      "summary": "Configure OS code signing certificates and notarization credentials for desktop binaries.",
      "guidance": "Unsigned desktop binaries are blocked or quarantined by Windows SmartScreen and macOS Gatekeeper.",
      "steps": [
            "Provide CSC_LINK/CSC_KEY_PASSWORD for Windows or APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD for macOS in CI."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["code signing configuration parameters"],
    tags: ["desktop","security","codesigning"],
    aliases: ["project_type.desktop.code_signing","DEP-DSK-002"],
    predicates: {
      "projectTypes": [
            "desktop",
            "electron",
            "tauri"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy Desktop platform code signing certificates requirements.",
    passCondition: "All configuration parameters and files for Desktop platform code signing certificates are valid.",
    failCondition: "Missing or invalid configuration detected for Desktop platform code signing certificates.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "tech.runtime.node.version_compat",
    name: "Node.js version compatibility",
    category: "RUNTIME",
    layer: "TECHNOLOGY",
    domain: "runtime",
    area: "nodejs",
    classification: "NODE_JS",
    description: "Verifies declared Node.js engines version matches target hosting and tool requirements.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Ensure declared Node.js version matches target hosting environment and library requirements.",
      "guidance": "Mismatches between local Node version and target runtime cause runtime syntax failures or missing stdlib APIs.",
      "steps": [
            "Align package.json engines.node with hosting runtime specification."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["engines.node declaration"],
    tags: ["nodejs","runtime","version"],
    aliases: ["tech.runtime.node.version_compat","DEP-NODE-001","NODE-001"],
    predicates: {
      "runtimes": [
            "Node.js"
      ]
},
    expectedBehavior: "package.json should declare an explicit Node engine constraint (e.g., \"engines\": { \"node\": \">=20.0.0\" }).",
    passCondition: "engines.node is declared in package.json using a valid semver range and matches .nvmrc or .node-version if present.",
    failCondition: "No Node engine version is specified anywhere in package.json (engines.node), .nvmrc, or .node-version.",
    source: "Node.js Documentation (package.json engines field); Vercel Runtime Documentation.",
  },
  {
    id: "tech.runtime.node.prod_dependencies",
    name: "Node production dependencies completeness",
    category: "DEPENDENCIES",
    layer: "TECHNOLOGY",
    domain: "dependencies",
    area: "nodejs",
    classification: "NODE_JS",
    description: "Ensures required production libraries are in dependencies rather than devDependencies.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Move runtime-critical libraries from devDependencies to dependencies in package.json.",
      "guidance": "In production builds (NODE_ENV=production), devDependencies are omitted, causing missing module errors at startup.",
      "steps": [
            "Inspect runtime imports and ensure all imported libraries are under \"dependencies\"."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["package.json dependencies block"],
    tags: ["nodejs","dependencies","production"],
    aliases: ["tech.runtime.node.prod_dependencies","DEP-NODE-002","NODE-003"],
    predicates: {
      "runtimes": [
            "Node.js"
      ]
},
    expectedBehavior: "All modules required in production runtime code must be listed under dependencies.",
    passCondition: "100% of runtime-imported packages are declared under package.json -> dependencies.",
    failCondition: "A module imported in production entrypoint files is listed in devDependencies instead of dependencies.",
    source: "Node.js Package Maintenance Guidelines; npm documentation.",
  },
  {
    id: "tech.runtime.python.version_compat",
    name: "Python version and runtime compatibility",
    category: "RUNTIME",
    layer: "TECHNOLOGY",
    domain: "runtime",
    area: "python",
    classification: "PYTHON",
    description: "Verifies Python version declaration in runtime.txt or pyproject.toml.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Specify explicit Python version in runtime.txt or pyproject.toml.",
      "guidance": "Undeclared Python versions default to platform defaults, leading to bytecode incompatibilities.",
      "steps": [
            "Write \"python-3.11.x\" to runtime.txt or specify python version in pyproject.toml."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["runtime.txt or pyproject.toml python version"],
    tags: ["python","runtime","version"],
    aliases: ["tech.runtime.python.version_compat","DEP-PY-001","PY-001"],
    predicates: {
      "runtimes": [
            "Python"
      ],
      "languages": [
            "Python"
      ]
},
    expectedBehavior: "An authoritative Python version declaration in .python-version or pyproject.toml.",
    passCondition: "An explicit Python version is pinned (e.g., 3.11.8) and consistent across all version configuration files.",
    failCondition: "No Python version constraint is declared across any standard version file or package manifest.",
    source: "Python Packaging User Guide; Heroku / Render Python Support Documentation.",
  },
  {
    id: "tech.runtime.python.dependency_manifest",
    name: "Python requirements manifest presence",
    category: "DEPENDENCIES",
    layer: "TECHNOLOGY",
    domain: "dependencies",
    area: "python",
    classification: "PYTHON",
    description: "Ensures requirements.txt, Pipfile.lock, or poetry.lock exists for reproducible builds.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "FILESYSTEM",
    remediation: {
      "summary": "Ensure requirements.txt, Pipfile.lock, or poetry.lock is present and pinned.",
      "guidance": "Deploying Python projects without pinned dependency versions causes pip to install newer breaking packages.",
      "steps": [
            "Run \"pip freeze > requirements.txt\" or commit poetry.lock."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["requirements.txt or poetry.lock"],
    tags: ["python","dependencies","manifest"],
    aliases: ["tech.runtime.python.dependency_manifest","DEP-PY-002","PY-002"],
    predicates: {
      "runtimes": [
            "Python"
      ],
      "languages": [
            "Python"
      ]
},
    expectedBehavior: "All production dependencies must be locked to exact versions.",
    passCondition: "A modern lockfile (poetry.lock, uv.lock, Pipfile.lock) is tracked, or requirements.txt contains strict == pins with package hashes.",
    failCondition: "requirements.txt contains bare package names without version specifiers, or uses loose ranges (>=, *) in a deployed service without a lockfile.",
    source: "Python Packaging User Guide (Lockfiles).",
  },
  {
    id: "tech.framework.nextjs.build_target",
    name: "Next.js build script & configuration",
    category: "BUILD",
    layer: "TECHNOLOGY",
    domain: "framework",
    area: "nextjs",
    classification: "NEXT_JS",
    description: "Verifies \"next build\" command exists and next.config configuration is syntactically valid.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Ensure package.json defines \"build\": \"next build\" and next.config is valid.",
      "guidance": "Next.js requires the next build command to compile server routes and client bundles.",
      "steps": [
            "Add \"build\": \"next build\" to package.json scripts."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["package.json build script and next.config"],
    tags: ["nextjs","framework","build"],
    aliases: ["tech.framework.nextjs.build_target","DEP-FW-NEXT-001","NEXT-002"],
    predicates: {
      "frameworks": [
            "Next.js"
      ]
},
    expectedBehavior: "output: 'standalone' configured in Next.js config for containerized deployments.",
    passCondition: "next.config.js configures output: 'standalone' and the container entrypoint launches node .next/standalone/server.js.",
    failCondition: "A Dockerfile exists in the repository, but next.config.* does not set output: 'standalone'.",
    source: "Next.js Official Deployment Documentation (Docker Image Configuration).",
  },
  {
    id: "tech.framework.nextjs.standalone_output",
    name: "Next.js output standalone deployment mode",
    category: "CONFIGURATION",
    layer: "TECHNOLOGY",
    domain: "framework",
    area: "nextjs",
    classification: "NEXT_JS",
    description: "Checks output: \"standalone\" configuration for containerized or self-hosted Next.js deployments.",
    severity: "MEDIUM",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "CONFIG",
    remediation: {
      "summary": "Set output: \"standalone\" in next.config.js for containerized deployments.",
      "guidance": "Standalone output automatically traces dependencies and yields a 10x smaller Docker container image.",
      "steps": [
            "Add output: \"standalone\" to next.config.js."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["next.config.js output property"],
    tags: ["nextjs","docker","standalone"],
    aliases: ["tech.framework.nextjs.standalone_output","DEP-FW-NEXT-002","NEXT-002"],
    predicates: {
      "frameworks": [
            "Next.js"
      ]
},
    expectedBehavior: "output: 'standalone' configured in Next.js config for containerized deployments.",
    passCondition: "next.config.js configures output: 'standalone' and the container entrypoint launches node .next/standalone/server.js.",
    failCondition: "A Dockerfile exists in the repository, but next.config.* does not set output: 'standalone'.",
    source: "Next.js Official Deployment Documentation (Docker Image Configuration).",
  },
  {
    id: "tech.framework.nextjs.env_prefix",
    name: "Next.js public environment variable prefix validation",
    category: "SECURITY",
    layer: "TECHNOLOGY",
    domain: "framework",
    area: "nextjs",
    classification: "NEXT_JS",
    description: "Ensures client-accessed environment variables use NEXT_PUBLIC_ prefix to prevent leaking secrets.",
    severity: "HIGH",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "AST",
    remediation: {
      "summary": "Ensure client-accessed environment variables use the NEXT_PUBLIC_ prefix.",
      "guidance": "Next.js excludes non-prefixed environment variables from browser bundles to avoid leaking server secrets.",
      "steps": [
            "Prefix client-side environment variable references with NEXT_PUBLIC_."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["client component env references"],
    tags: ["nextjs","security","env"],
    aliases: ["tech.framework.nextjs.env_prefix","DEP-FW-NEXT-003","NEXT-001"],
    predicates: {
      "frameworks": [
            "Next.js"
      ]
},
    expectedBehavior: "Sensitive credentials must not be prefixed with NEXT_PUBLIC_.",
    passCondition: "Only non-sensitive, explicitly public client configuration parameters carry the NEXT_PUBLIC_ prefix.",
    failCondition: "An environment variable containing secret indicators (SECRET, KEY, PRIVATE, PASSWORD) has the NEXT_PUBLIC_ prefix while being assigned sensitive values.",
    source: "Next.js Documentation (Environment Variables & Bundling).",
  },
  {
    id: "tech.framework.react.vite_build",
    name: "Vite production bundle build configuration",
    category: "BUILD",
    layer: "TECHNOLOGY",
    domain: "framework",
    area: "vite",
    classification: "VITE",
    description: "Verifies vite build produces valid production static bundle.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Ensure \"build\": \"vite build\" exists and produces valid dist directory.",
      "guidance": "Vite projects require building production bundles to convert JSX and modern JS into browser-compatible assets.",
      "steps": [
            "Add \"build\": \"vite build\" to package.json scripts."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["package.json scripts.build and vite.config"],
    tags: ["vite","react","build"],
    aliases: ["tech.framework.react.vite_build","DEP-FW-VITE-001"],
    predicates: {
      "frameworks": [
            "Vite",
            "React"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy Vite production bundle build configuration requirements.",
    passCondition: "All configuration parameters and files for Vite production bundle build configuration are valid.",
    failCondition: "Missing or invalid configuration detected for Vite production bundle build configuration.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "tech.framework.express.entrypoint",
    name: "Express server production entrypoint",
    category: "CONFIGURATION",
    layer: "TECHNOLOGY",
    domain: "framework",
    area: "express",
    classification: "EXPRESS",
    description: "Ensures production start command points to compiled JavaScript entrypoint (e.g. dist/index.js).",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Ensure production start script points to compiled JavaScript entrypoint (e.g. node dist/server.js).",
      "guidance": "Running dev tools like ts-node or nodemon in production degrades throughput and increases memory overhead.",
      "steps": [
            "Set start script to run \"node dist/index.js\" rather than ts-node."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["package.json scripts.start"],
    tags: ["express","framework","entrypoint"],
    aliases: ["tech.framework.express.entrypoint","DEP-FW-EXPR-001"],
    predicates: {
      "frameworks": [
            "Express"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy Express server production entrypoint requirements.",
    passCondition: "All configuration parameters and files for Express server production entrypoint are valid.",
    failCondition: "Missing or invalid configuration detected for Express server production entrypoint.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "tech.framework.fastify.production_logging",
    name: "Fastify / API production logger configuration",
    category: "CONFIGURATION",
    layer: "TECHNOLOGY",
    domain: "framework",
    area: "backend",
    classification: "FASTIFY",
    description: "Verifies structured JSON logging is enabled for production observability.",
    severity: "LOW",
    automationLevel: "PARTIALLY_AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "AST",
    remediation: {
      "summary": "Enable structured JSON logging in production Fastify instance.",
      "guidance": "Unstructured console logs make log ingestion, searching, and alerting inefficient in cloud monitoring tools.",
      "steps": [
            "Initialize Fastify with { logger: true } or pino structured logger."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["Fastify logger configuration"],
    tags: ["fastify","observability","logging"],
    aliases: ["tech.framework.fastify.production_logging","DEP-FW-FAST-001"],
    predicates: {
      "frameworks": [
            "Fastify"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy Fastify / API production logger configuration requirements.",
    passCondition: "All configuration parameters and files for Fastify / API production logger configuration are valid.",
    failCondition: "Missing or invalid configuration detected for Fastify / API production logger configuration.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "tech.orm.prisma.schema_validity",
    name: "Prisma schema and client generation",
    category: "DATABASE",
    layer: "TECHNOLOGY",
    domain: "orm",
    area: "prisma",
    classification: "PRISMA",
    description: "Verifies prisma generate runs during build step and schema.prisma defines valid provider.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "FILESYSTEM",
    remediation: {
      "summary": "Ensure prisma/schema.prisma exists and \"prisma generate\" runs during build step.",
      "guidance": "If prisma generate is omitted from the build phase, PrismaClient fails at runtime with missing engine binary.",
      "steps": [
            "Add \"postinstall\": \"prisma generate\" or include in build script."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["prisma/schema.prisma existence and build/postinstall scripts"],
    tags: ["prisma","orm","schema"],
    aliases: ["tech.orm.prisma.schema_validity","DEP-ORM-PRISMA-001","ORM-PRIS-001"],
    predicates: {
      "databases": [
            "Prisma"
      ]
},
    expectedBehavior: "prisma generate must execute before application build or compilation.",
    passCondition: "prisma generate is explicitly defined in the build script (e.g., \"build\": \"prisma generate && tsc\") or executed directly in the Dockerfile build stage.",
    failCondition: "Neither package.json scripts nor Dockerfile execution steps run prisma generate prior to building or starting the application.",
    source: "Prisma Documentation (Deploying to Production - Generate).",
  },
  {
    id: "tech.orm.prisma.migration_status",
    name: "Prisma production migration script",
    category: "DATABASE",
    layer: "TECHNOLOGY",
    domain: "orm",
    area: "prisma",
    classification: "PRISMA",
    description: "Checks for \"prisma migrate deploy\" deployment hook rather than development \"prisma db push\".",
    severity: "HIGH",
    automationLevel: "PARTIALLY_AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "CONFIG",
    remediation: {
      "summary": "Use \"prisma migrate deploy\" in release pipeline rather than \"prisma db push\".",
      "guidance": "Running db push in production can accidentally alter or drop existing customer database columns.",
      "steps": [
            "Add \"prisma migrate deploy\" to release phase or pre-deployment migration script."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["migration deployment command in scripts or procfile"],
    tags: ["prisma","database","migrations"],
    aliases: ["tech.orm.prisma.migration_status","DEP-ORM-PRISMA-002","ORM-PRIS-002"],
    predicates: {
      "databases": [
            "Prisma"
      ]
},
    expectedBehavior: "Production migrations must execute via prisma migrate deploy.",
    passCondition: "Production migration step is executed using strictly prisma migrate deploy.",
    failCondition: "Deployment or startup scripts contain prisma migrate dev or prisma db push.",
    source: "Prisma Documentation (Prisma Migrate in Production).",
  },
  {
    id: "tech.orm.prisma.database_url_env",
    name: "Prisma DATABASE_URL configuration",
    category: "ENVIRONMENT",
    layer: "TECHNOLOGY",
    domain: "orm",
    area: "prisma",
    classification: "PRISMA",
    description: "Ensures DATABASE_URL or DIRECT_URL is defined in deployment environment configuration.",
    severity: "CRITICAL",
    automationLevel: "PARTIALLY_AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Provide DATABASE_URL and DIRECT_URL environment variables for Prisma connections.",
      "guidance": "Prisma Client cannot connect to the database if the connection string variable is missing from target environment.",
      "steps": [
            "Define DATABASE_URL in cloud hosting environment secrets."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["DATABASE_URL declared in env template"],
    tags: ["prisma","environment","database"],
    aliases: ["tech.orm.prisma.database_url_env","DEP-ORM-PRISMA-003"],
    predicates: {
      "databases": [
            "Prisma"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy Prisma DATABASE_URL configuration requirements.",
    passCondition: "All configuration parameters and files for Prisma DATABASE_URL configuration are valid.",
    failCondition: "Missing or invalid configuration detected for Prisma DATABASE_URL configuration.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "tech.database.postgresql.connection_pool",
    name: "PostgreSQL connection pooling configuration",
    category: "DATABASE",
    layer: "TECHNOLOGY",
    domain: "database",
    area: "postgresql",
    classification: "POSTGRESQL",
    description: "Checks connection pool limits and serverless connection pooling parameters (e.g. PgBouncer/Supabase/Neon).",
    severity: "HIGH",
    automationLevel: "PARTIALLY_AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "CONFIG",
    remediation: {
      "summary": "Configure PostgreSQL connection pooling limits or use a connection proxy (PgBouncer, Supabase pooler).",
      "guidance": "Serverless functions opening direct connections quickly exceed PostgreSQL max_connections limits.",
      "steps": [
            "Connect through a connection pooler URL (port 6543 / PgBouncer) and configure max connections."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["connection pool configuration parameters"],
    tags: ["postgresql","database","connection-pool"],
    aliases: ["tech.database.postgresql.connection_pool","DEP-DB-PG-001","DB-004"],
    predicates: {
      "databases": [
            "PostgreSQL"
      ]
},
    expectedBehavior: "Connection pool limits must be explicitly configured per instance.",
    passCondition: "Maximum pool size is explicitly configured and constrained to safe limits per instance (5–10).",
    failCondition: "Application uses default unbounded pool size or sets a pool size greater than the target database tier maximum allowable limit.",
    source: "Prisma Documentation (Connection Management); PostgreSQL Documentation (Connections and Memory).",
  },
  {
    id: "tech.database.postgresql.ssl_mode",
    name: "PostgreSQL production SSL connection mode",
    category: "DATABASE",
    layer: "TECHNOLOGY",
    domain: "database",
    area: "postgresql",
    classification: "POSTGRESQL",
    description: "Verifies database connection enables SSL/TLS encryption for remote production databases.",
    severity: "HIGH",
    automationLevel: "PARTIALLY_AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "CONFIG",
    remediation: {
      "summary": "Enable SSL/TLS encryption (sslmode=require) for remote PostgreSQL database connections.",
      "guidance": "Unencrypted database connections expose queries and customer records to network eavesdropping.",
      "steps": [
            "Append ?sslmode=require to DATABASE_URL or set ssl: { rejectUnauthorized: true } in client pool."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["ssl connection options in connection string or pool config"],
    tags: ["postgresql","database","security","ssl"],
    aliases: ["tech.database.postgresql.ssl_mode","DEP-DB-PG-002","DB-002"],
    predicates: {
      "databases": [
            "PostgreSQL"
      ]
},
    expectedBehavior: "Database connection must enforce TLS/SSL encryption for all remote hosts.",
    passCondition: "Connection string or driver configuration mandates SSL encryption (sslmode=require or sslmode=verify-full).",
    failCondition: "DATABASE_URL explicitly sets sslmode=disable or lacks SSL parameters when connecting to remote cloud database hostnames.",
    source: "PostgreSQL Documentation (SSL Support); AWS RDS PostgreSQL SSL Guidelines.",
  },
  {
    id: "tech.database.mongodb.uri_configuration",
    name: "MongoDB connection URI configuration",
    category: "DATABASE",
    layer: "TECHNOLOGY",
    domain: "database",
    area: "mongodb",
    classification: "MONGODB",
    description: "Verifies MONGODB_URI connection string is provided via environment variables with safe credentials.",
    severity: "CRITICAL",
    automationLevel: "PARTIALLY_AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Parameterize MONGODB_URI via environment variables without hardcoded passwords.",
      "guidance": "Hardcoded MongoDB connection strings leak credentials to source control.",
      "steps": [
            "Read connection string from process.env.MONGODB_URI."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["MONGODB_URI environment reference"],
    tags: ["mongodb","database","env"],
    aliases: ["tech.database.mongodb.uri_configuration","DEP-DB-MONGO-001"],
    predicates: {
      "databases": [
            "MongoDB",
            "Mongoose"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy MongoDB connection URI configuration requirements.",
    passCondition: "All configuration parameters and files for MongoDB connection URI configuration are valid.",
    failCondition: "Missing or invalid configuration detected for MongoDB connection URI configuration.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "tech.cache.redis.url_configuration",
    name: "Redis cache connection string configuration",
    category: "DATABASE",
    layer: "TECHNOLOGY",
    domain: "cache",
    area: "redis",
    classification: "REDIS",
    description: "Ensures REDIS_URL is parameterized and handles connection reconnection gracefully.",
    severity: "HIGH",
    automationLevel: "PARTIALLY_AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Configure REDIS_URL via environment variables and enable auto-reconnect logic.",
      "guidance": "Unparameterized Redis connections break between environments or crash workers when temporary blips occur.",
      "steps": [
            "Read REDIS_URL from process.env and provide retryStrategy in client configuration."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["REDIS_URL environment reference"],
    tags: ["redis","cache","database"],
    aliases: ["tech.cache.redis.url_configuration","DEP-DB-REDIS-001","DB-005"],
    predicates: {
      "databases": [
            "Redis"
      ]
},
    expectedBehavior: "Remote Redis instances must use rediss:// protocol and mandate authentication.",
    passCondition: "Redis URL enforces TLS using the rediss:// protocol and supplies valid authentication credentials.",
    failCondition: "Remote Redis host connection string uses unencrypted redis:// without credentials, or explicitly disables authentication.",
    source: "Redis Security Documentation; Upstash Security Guide.",
  },
  {
    id: "tech.tooling.npm.ci_mode",
    name: "npm reproducible CI installation mode",
    category: "DEPENDENCIES",
    layer: "TECHNOLOGY",
    domain: "package-manager",
    area: "npm",
    classification: "NPM",
    description: "Ensures deployment build scripts use \"npm ci\" rather than \"npm install\" for deterministic installs.",
    severity: "HIGH",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "CONFIG",
    remediation: {
      "summary": "Use \"npm ci\" instead of \"npm install\" in continuous integration and deployment pipelines.",
      "guidance": "npm ci enforces strict lockfile synchronization and never modifies package-lock.json on CI servers.",
      "steps": [
            "Replace \"npm install\" with \"npm ci\" in CI workflow and build scripts."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["CI script command references"],
    tags: ["npm","package-manager","ci"],
    aliases: ["tech.tooling.npm.ci_mode","DEP-PKG-NPM-001","PKG-001"],
    predicates: {
      "packageManagers": [
            "npm"
      ]
},
    expectedBehavior: "Dependency installation must be frozen (npm ci, --frozen- lockfile, or --immutable).",
    passCondition: "Deployment scripts use npm ci or the package manager's explicit frozen lockfile install flag.",
    failCondition: "Deployment script or Dockerfile runs npm install, pnpm install, or yarn install without frozen lockfile verification.",
    source: "npm Documentation (npm-ci); pnpm CLI Documentation.",
  },
  {
    id: "tech.tooling.pnpm.frozen_lockfile",
    name: "pnpm frozen lockfile installation",
    category: "DEPENDENCIES",
    layer: "TECHNOLOGY",
    domain: "package-manager",
    area: "pnpm",
    classification: "PNPM",
    description: "Ensures CI runs \"pnpm install --frozen-lockfile\".",
    severity: "HIGH",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "CONFIG",
    remediation: {
      "summary": "Ensure pnpm installs with --frozen-lockfile flag during deployment.",
      "guidance": "Prevents automatic lockfile mutations on CI build machines.",
      "steps": [
            "Use \"pnpm install --frozen-lockfile\" in CI deployment jobs."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["pnpm install flags in CI scripts"],
    tags: ["pnpm","package-manager","ci"],
    aliases: ["tech.tooling.pnpm.frozen_lockfile","DEP-PKG-PNPM-001"],
    predicates: {
      "packageManagers": [
            "pnpm"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy pnpm frozen lockfile installation requirements.",
    passCondition: "All configuration parameters and files for pnpm frozen lockfile installation are valid.",
    failCondition: "Missing or invalid configuration detected for pnpm frozen lockfile installation.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "target.hosting.vercel.config_validity",
    name: "Vercel configuration validity (vercel.json)",
    category: "HOSTING",
    layer: "DEPLOYMENT_TARGET",
    domain: "hosting",
    area: "vercel",
    classification: "VERCEL",
    description: "Validates vercel.json structure, headers, rewrites, and framework preset compatibility.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Ensure vercel.json is structurally valid JSON and matches Vercel deployment specifications.",
      "guidance": "Malformed vercel.json causes Vercel deployment builds to abort immediately.",
      "steps": [
            "Validate vercel.json JSON schema and remove obsolete routing properties."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["vercel.json file syntax"],
    tags: ["vercel","hosting","config"],
    aliases: ["target.hosting.vercel.config_validity","DEP-HOST-VERCEL-001"],
    predicates: {
      "hosting": [
            "Vercel"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy Vercel configuration validity (vercel.json) requirements.",
    passCondition: "All configuration parameters and files for Vercel configuration validity (vercel.json) are valid.",
    failCondition: "Missing or invalid configuration detected for Vercel configuration validity (vercel.json).",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "target.hosting.vercel.env_mapping",
    name: "Vercel environment variables mapping",
    category: "HOSTING",
    layer: "DEPLOYMENT_TARGET",
    domain: "hosting",
    area: "vercel",
    classification: "VERCEL",
    description: "Verifies expected project variables are targeted for Production environment in Vercel project settings.",
    severity: "HIGH",
    automationLevel: "MANUAL",
    profileLevel: "COMPLETE",
    executionType: "CONFIG",
    remediation: {
      "summary": "Verify all project environment variables are mapped to the Production environment in Vercel project settings.",
      "guidance": "Variables configured only for \"Preview\" or \"Development\" cause runtime exceptions in Production.",
      "steps": [
            "Check Vercel Project Settings > Environment Variables and ensure Production target checkbox is enabled."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["Vercel environment mapping declaration"],
    tags: ["vercel","hosting","environment"],
    aliases: ["target.hosting.vercel.env_mapping","DEP-HOST-VERCEL-002"],
    predicates: {
      "hosting": [
            "Vercel"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy Vercel environment variables mapping requirements.",
    passCondition: "All configuration parameters and files for Vercel environment variables mapping are valid.",
    failCondition: "Missing or invalid configuration detected for Vercel environment variables mapping.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "target.hosting.netlify.toml_validity",
    name: "Netlify configuration validity (netlify.toml)",
    category: "HOSTING",
    layer: "DEPLOYMENT_TARGET",
    domain: "hosting",
    area: "netlify",
    classification: "NETLIFY",
    description: "Validates netlify.toml build command, publish directory, and redirect headers.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Validate netlify.toml syntax, publish directory, and build command.",
      "guidance": "Syntax errors in netlify.toml cause build failures on Netlify build containers.",
      "steps": [
            "Check [build] command and publish directory in netlify.toml."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["netlify.toml syntax"],
    tags: ["netlify","hosting","config"],
    aliases: ["target.hosting.netlify.toml_validity","DEP-HOST-NETLIFY-001"],
    predicates: {
      "hosting": [
            "Netlify"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy Netlify configuration validity (netlify.toml) requirements.",
    passCondition: "All configuration parameters and files for Netlify configuration validity (netlify.toml) are valid.",
    failCondition: "Missing or invalid configuration detected for Netlify configuration validity (netlify.toml).",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "target.hosting.docker.dockerfile_validity",
    name: "Dockerfile instruction & entrypoint validity",
    category: "HOSTING",
    layer: "DEPLOYMENT_TARGET",
    domain: "hosting",
    area: "docker",
    classification: "DOCKER",
    description: "Ensures Dockerfile defines a non-root user, exposes the service port, and specifies CMD or ENTRYPOINT.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "STATIC",
    remediation: {
      "summary": "Validate Dockerfile syntax, non-root USER directive, and valid CMD or ENTRYPOINT.",
      "guidance": "Running as root in containers creates container breakout security risks; missing CMD causes container crash on launch.",
      "steps": [
            "Add USER node (or non-root user) and ensure CMD [\"node\", \"dist/index.js\"] is specified."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["Dockerfile instructions"],
    tags: ["docker","container","security"],
    aliases: ["target.hosting.docker.dockerfile_validity","DEP-HOST-DOCKER-001"],
    predicates: {
      "hosting": [
            "Docker"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy Dockerfile instruction & entrypoint validity requirements.",
    passCondition: "All configuration parameters and files for Dockerfile instruction & entrypoint validity are valid.",
    failCondition: "Missing or invalid configuration detected for Dockerfile instruction & entrypoint validity.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "target.hosting.docker.dockerignore_present",
    name: "Docker build context exclusions (.dockerignore)",
    category: "HOSTING",
    layer: "DEPLOYMENT_TARGET",
    domain: "hosting",
    area: "docker",
    classification: "DOCKER",
    description: "Checks .dockerignore excludes node_modules, .env, and version control files to prevent bloated images and secret leaks.",
    severity: "HIGH",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "FILESYSTEM",
    remediation: {
      "summary": "Create .dockerignore excluding node_modules, .env, .git, and build artifacts.",
      "guidance": "Without .dockerignore, local node_modules (possibly built for wrong OS architecture) and private secrets are copied into the image context.",
      "steps": [
            "Create .dockerignore with node_modules, .git, and .env entries."
      ],
      "autoFixable": true
},
    evidenceRequirements: [".dockerignore file existence and contents"],
    tags: ["docker","container","build"],
    aliases: ["target.hosting.docker.dockerignore_present","DEP-HOST-DOCKER-002"],
    predicates: {
      "hosting": [
            "Docker"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy Docker build context exclusions (.dockerignore) requirements.",
    passCondition: "All configuration parameters and files for Docker build context exclusions (.dockerignore) are valid.",
    failCondition: "Missing or invalid configuration detected for Docker build context exclusions (.dockerignore).",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "target.hosting.docker.multistage_build",
    name: "Docker multi-stage build optimization",
    category: "HOSTING",
    layer: "DEPLOYMENT_TARGET",
    domain: "hosting",
    area: "docker",
    classification: "DOCKER",
    description: "Verifies multi-stage build pattern separates build tools from minimal production runtime image.",
    severity: "MEDIUM",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "STATIC",
    remediation: {
      "summary": "Adopt multi-stage Docker build to separate build tooling from minimal production runtime image.",
      "guidance": "Single-stage builds produce giant image sizes and leave compiler toolchains in production attack surfaces.",
      "steps": [
            "Define \"FROM node:20-alpine AS builder\" followed by clean \"FROM node:20-alpine AS runner\"."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["Dockerfile multi-stage FROM instructions"],
    tags: ["docker","container","optimization"],
    aliases: ["target.hosting.docker.multistage_build","DEP-HOST-DOCKER-003","DOCK-001"],
    predicates: {
      "hosting": [
            "Docker"
      ]
},
    expectedBehavior: "Production Dockerfiles must isolate compiled artifacts using multi- stage builds.",
    passCondition: "Dockerfile implements multi-stage builds and the runtime image contains only compiled application binaries and production dependencies.",
    failCondition: "Dockerfile contains only a single FROM stage that installs build tools and leaves all source/dev files in the final runtime container image.",
    source: "Docker Documentation (Multi-stage builds best practices).",
  },
  {
    id: "target.hosting.railway.config_validity",
    name: "Railway configuration and start command",
    category: "HOSTING",
    layer: "DEPLOYMENT_TARGET",
    domain: "hosting",
    area: "railway",
    classification: "RAILWAY",
    description: "Verifies railway.json or Procfile specifies valid start command for Railway service deployment.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Verify railway.json or Procfile provides valid start command and health check paths.",
      "guidance": "Missing service configuration on Railway defaults to Nixpacks autodetection which may pick an incorrect entrypoint.",
      "steps": [
            "Create railway.json or Procfile specifying web start process."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["railway.json or Procfile"],
    tags: ["railway","hosting","config"],
    aliases: ["target.hosting.railway.config_validity","DEP-HOST-RAILWAY-001"],
    predicates: {
      "hosting": [
            "Railway"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy Railway configuration and start command requirements.",
    passCondition: "All configuration parameters and files for Railway configuration and start command are valid.",
    failCondition: "Missing or invalid configuration detected for Railway configuration and start command.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "target.hosting.render.yaml_validity",
    name: "Render blueprint validity (render.yaml)",
    category: "HOSTING",
    layer: "DEPLOYMENT_TARGET",
    domain: "hosting",
    area: "render",
    classification: "RENDER",
    description: "Validates render.yaml service definitions, environment configuration, and disk mounts.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Ensure render.yaml Blueprint defines valid service type, startCommand, and envVars.",
      "guidance": "Render blueprints fail to provision if service names or commands are invalid.",
      "steps": [
            "Validate render.yaml against Render Blueprint spec."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["render.yaml Blueprint syntax"],
    tags: ["render","hosting","config"],
    aliases: ["target.hosting.render.yaml_validity","DEP-HOST-RENDER-001"],
    predicates: {
      "hosting": [
            "Render"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy Render blueprint validity (render.yaml) requirements.",
    passCondition: "All configuration parameters and files for Render blueprint validity (render.yaml) are valid.",
    failCondition: "Missing or invalid configuration detected for Render blueprint validity (render.yaml).",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "target.hosting.flyio.toml_validity",
    name: "Fly.io app configuration (fly.toml)",
    category: "HOSTING",
    layer: "DEPLOYMENT_TARGET",
    domain: "hosting",
    area: "flyio",
    classification: "FLY_IO",
    description: "Checks fly.toml app name, internal port, and health check services.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Validate fly.toml app name, internal_port, and health check definitions.",
      "guidance": "Mismatched internal_port causes Fly proxy to return 502 Bad Gateway to incoming traffic.",
      "steps": [
            "Verify [http_service].internal_port matches server port binding in fly.toml."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["fly.toml file syntax and internal_port"],
    tags: ["flyio","hosting","config"],
    aliases: ["target.hosting.flyio.toml_validity","DEP-HOST-FLY-001"],
    predicates: {
      "hosting": [
            "Fly.io"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy Fly.io app configuration (fly.toml) requirements.",
    passCondition: "All configuration parameters and files for Fly.io app configuration (fly.toml) are valid.",
    failCondition: "Missing or invalid configuration detected for Fly.io app configuration (fly.toml).",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "target.hosting.aws.credentials_and_region",
    name: "AWS deployment region & stack declaration",
    category: "HOSTING",
    layer: "DEPLOYMENT_TARGET",
    domain: "hosting",
    area: "aws",
    classification: "AWS",
    description: "Verifies AWS region and account deployment targets are configured without hardcoded access keys.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Ensure AWS deployment region and IAM credentials use environment variables or OpenID Connect (OIDC).",
      "guidance": "Hardcoded AWS Access Key IDs or Secrets in codebases lead to compromised cloud infrastructure.",
      "steps": [
            "Configure AWS_REGION and configure OIDC role assumption in CI/CD pipeline."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["AWS region declaration and lack of hardcoded secrets"],
    tags: ["aws","hosting","security"],
    aliases: ["target.hosting.aws.credentials_and_region","DEP-HOST-AWS-001"],
    predicates: {
      "hosting": [
            "AWS"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy AWS deployment region & stack declaration requirements.",
    passCondition: "All configuration parameters and files for AWS deployment region & stack declaration are valid.",
    failCondition: "Missing or invalid configuration detected for AWS deployment region & stack declaration.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "infra.ci.github_actions.workflow_syntax",
    name: "GitHub Actions deployment workflow syntax",
    category: "CI_CD",
    layer: "INFRASTRUCTURE",
    domain: "infrastructure",
    area: "github_actions",
    classification: "GITHUB_ACTIONS",
    description: "Ensures .github/workflows deployment YAML files are structurally valid and run on release or push.",
    severity: "HIGH",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "CONFIG",
    remediation: {
      "summary": "Verify GitHub Actions workflow YAML files under .github/workflows are structurally valid.",
      "guidance": "Syntax errors in workflow files prevent CI/CD deployment jobs from triggering on git push.",
      "steps": [
            "Validate YAML syntax in all .github/workflows/*.yml files."
      ],
      "autoFixable": false
},
    evidenceRequirements: [".github/workflows YAML syntax"],
    tags: ["github-actions","ci-cd","workflows"],
    aliases: ["infra.ci.github_actions.workflow_syntax","DEP-CI-GHA-001"],
    predicates: {
      "requiresCi": true
},
    expectedBehavior: "Deployable artifact must satisfy GitHub Actions deployment workflow syntax requirements.",
    passCondition: "All configuration parameters and files for GitHub Actions deployment workflow syntax are valid.",
    failCondition: "Missing or invalid configuration detected for GitHub Actions deployment workflow syntax.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "infra.ci.github_actions.secret_references",
    name: "GitHub Actions secrets reference validation",
    category: "CI_CD",
    layer: "INFRASTRUCTURE",
    domain: "infrastructure",
    area: "github_actions",
    classification: "GITHUB_ACTIONS",
    description: "Checks that deployment workflows use secrets.* expressions rather than literal credentials.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "STATIC",
    remediation: {
      "summary": "Ensure CI workflow steps reference secrets via ${{ secrets.* }} rather than hardcoded credentials.",
      "guidance": "Workflow files committed to version control are visible to all repository readers.",
      "steps": [
            "Reference secret keys using ${{ secrets.VARIABLE_NAME }} in workflow YAML."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["workflow secret reference syntax"],
    tags: ["github-actions","security","secrets"],
    aliases: ["infra.ci.github_actions.secret_references","DEP-CI-GHA-002"],
    predicates: {
      "requiresCi": true
},
    expectedBehavior: "Deployable artifact must satisfy GitHub Actions secrets reference validation requirements.",
    passCondition: "All configuration parameters and files for GitHub Actions secrets reference validation are valid.",
    failCondition: "Missing or invalid configuration detected for GitHub Actions secrets reference validation.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "infra.monorepo.workspace_topological_build",
    name: "Monorepo workspace dependency build order",
    category: "MONOREPO",
    layer: "INFRASTRUCTURE",
    domain: "monorepo",
    area: "monorepo",
    classification: "MONOREPO",
    description: "Validates that shared internal packages are built before consuming applications in monorepo pipelines.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Ensure monorepo build pipeline builds internal packages in topological order before application builds.",
      "guidance": "Building an application before compiling its internal shared library dependencies results in missing module errors.",
      "steps": [
            "Use Turborepo/Nx/pnpm recursive run with topological dependency ordering."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["monorepo pipeline build graph"],
    tags: ["monorepo","build","pipeline"],
    aliases: ["infra.monorepo.workspace_topological_build","DEP-MONO-001","MONO-001"],
    predicates: {
      "requiresMonorepo": true
},
    expectedBehavior: "Monorepo pipeline configuration must enforce topological dependency compilation (\"^build\").",
    passCondition: "dependsOn contains \"^build\" for all build tasks in monorepo pipeline configuration.",
    failCondition: "The monorepo build task definition lacks \"^build\" in its dependsOn array.",
    source: "Turborepo Documentation (Configuring tasks & dependsOn).",
  },
  {
    id: "infra.monorepo.no_dangling_local_symlinks",
    name: "No dangling workspace dependencies in deployment",
    category: "MONOREPO",
    layer: "INFRASTRUCTURE",
    domain: "monorepo",
    area: "monorepo",
    classification: "MONOREPO",
    description: "Ensures target application packages bundle or publish internal workspace dependencies rather than leaving unresolved symlinks.",
    severity: "HIGH",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "CONFIG",
    remediation: {
      "summary": "Verify monorepo deployment bundles internal workspace packages rather than leaving unresolved symlinks.",
      "guidance": "Deploying application folders outside the monorepo root breaks relative workspace symlinks.",
      "steps": [
            "Bundle workspace dependencies into distribution or use standalone bundling."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["workspace dependency bundling configuration"],
    tags: ["monorepo","dependencies","bundling"],
    aliases: ["infra.monorepo.no_dangling_local_symlinks","DEP-MONO-002"],
    predicates: {
      "requiresMonorepo": true
},
    expectedBehavior: "Deployable artifact must satisfy No dangling workspace dependencies in deployment requirements.",
    passCondition: "All configuration parameters and files for No dangling workspace dependencies in deployment are valid.",
    failCondition: "Missing or invalid configuration detected for No dangling workspace dependencies in deployment.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "DEP-GIT-003",
    name: "Case-sensitive file import consistency",
    category: "GIT",
    layer: "UNIVERSAL",
    domain: "git",
    area: "vcs",
    classification: "UNIVERSAL",
    description: "Verifies file imports match exact disk casing to prevent case-insensitive OS (macOS/Windows) passing locally but failing on Linux deployment servers.",
    severity: "HIGH",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "FILESYSTEM",
    remediation: {
      "summary": "Ensure import paths exactly match disk file casing.",
      "guidance": "Windows and macOS have case-insensitive filesystems by default, masking casing mismatches that crash Linux containers.",
      "steps": [
            "Inspect import paths and match letter-by-letter to disk paths.",
            "Enable forceConsistentCasingInFileNames in tsconfig.json."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["file import paths and actual disk paths"],
    tags: ["git","universal","filesystem","casing"],
    aliases: ["universal.git.case_sensitive_imports","UNI-007"],
    expectedBehavior: "File import string casing must match disk casing identically.",
    passCondition: "All relative and local import paths match disk file paths with 100% character case parity.",
    failCondition: "An import path references a file or directory whose character casing differs from the actual file or directory path on disk.",
    source: "Linux Standard Base Core Specification; Node.js Module Resolution Algorithm.",
  },
  {
    id: "DEP-GIT-004",
    name: "No unresolved git merge conflict markers",
    category: "GIT",
    layer: "UNIVERSAL",
    domain: "git",
    area: "vcs",
    classification: "UNIVERSAL",
    description: "Scans source files for leftover git conflict markers (<<<<<<< HEAD, =======, >>>>>>>).",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "STATIC",
    remediation: {
      "summary": "Resolve all git conflict markers before deploying.",
      "guidance": "Leftover conflict markers cause syntax parse errors immediately during build or runtime execution.",
      "steps": [
            "Search codebase for \"<<<<<<<\" and resolve conflicting blocks.",
            "Run git status and git diff to verify resolution."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["source code files scan for conflict markers"],
    tags: ["git","universal","syntax"],
    aliases: ["universal.git.no_merge_conflicts","UNI-008"],
    expectedBehavior: "All merge conflicts must be resolved before deployment.",
    passCondition: "Zero occurrences of Git merge conflict markers across all repository files.",
    failCondition: "One or more non-binary files contain lines matching standard Git merge conflict patterns.",
    source: "Git User Manual (Resolving Conflicts).",
  },
  {
    id: "DEP-BUILD-003",
    name: "No hardcoded localhost/127.0.0.1 in production source",
    category: "BUILD",
    layer: "UNIVERSAL",
    domain: "build",
    area: "code",
    classification: "UNIVERSAL",
    description: "Detects hardcoded http://localhost or 127.0.0.1 API call destinations in production source code.",
    severity: "MEDIUM",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "AST",
    remediation: {
      "summary": "Replace hardcoded localhost URLs with environment variable references.",
      "guidance": "Hardcoded localhost references in client or server code fail when deployed to remote cloud environments.",
      "steps": [
            "Replace http://localhost with process.env.NEXT_PUBLIC_API_URL or environment configuration."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["AST string literals matching localhost"],
    tags: ["build","universal","networking"],
    aliases: ["universal.build.no_hardcoded_localhost","UNI-009"],
    expectedBehavior: "Base URLs and network endpoints must be dynamically configured via environment variables.",
    passCondition: "All network requests and service connectors construct their base URLs from environment variables or relative paths.",
    failCondition: "Production client-side code or production API client connectors contain hardcoded localhost or 127.0.0.1 endpoints without an environment variable fallback.",
    source: "Twelve-Factor App (IV. Backing Services).",
  },
  {
    id: "DEP-NODE-003",
    name: "Node.js process exception and rejection handlers",
    category: "RUNTIME",
    layer: "TECHNOLOGY",
    domain: "runtime",
    area: "nodejs",
    classification: "NODE_JS",
    description: "Verifies top-level process.on(\"unhandledRejection\") and process.on(\"uncaughtException\") are registered.",
    severity: "HIGH",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "AST",
    remediation: {
      "summary": "Register top-level process exception handlers to log errors cleanly before terminating.",
      "guidance": "In modern Node.js, unhandled promise rejections terminate the process immediately if unhandled.",
      "steps": [
            "Add process.on(\"unhandledRejection\") and process.on(\"uncaughtException\") handlers in server entrypoint."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["process event listener registrations"],
    tags: ["nodejs","runtime","reliability"],
    aliases: ["tech.runtime.node.unhandled_rejection_handler","NODE-003"],
    predicates: {
      "runtimes": [
            "Node.js"
      ]
},
    expectedBehavior: "All modules required in production runtime code must be listed under dependencies.",
    passCondition: "100% of runtime-imported packages are declared under package.json -> dependencies.",
    failCondition: "A module imported in production entrypoint files is listed in devDependencies instead of dependencies.",
    source: "Node.js Package Maintenance Guidelines; npm documentation.",
  },
  {
    id: "DEP-NODE-004",
    name: "Node.js native C++ addons compilation check",
    category: "DEPENDENCIES",
    layer: "TECHNOLOGY",
    domain: "dependencies",
    area: "nodejs",
    classification: "NODE_JS",
    description: "Detects packages with native binary addons (sharp, bcrypt, better-sqlite3) and verifies rebuild target matches deployment OS architecture.",
    severity: "HIGH",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "CONFIG",
    remediation: {
      "summary": "Ensure native modules are compiled for target Linux deployment architecture.",
      "guidance": "Native addons compiled on macOS or Windows will fail with invalid ELF header errors when deployed to Linux containers.",
      "steps": [
            "Run npm rebuild or yarn install --frozen-lockfile inside the deployment container image."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["native dependency detection in package.json"],
    tags: ["nodejs","dependencies","native-addons"],
    aliases: ["tech.runtime.node.native_addons","NODE-004"],
    predicates: {
      "runtimes": [
            "Node.js"
      ]
},
    expectedBehavior: "Native modules must be rebuilt inside the target deployment operating system.",
    passCondition: "Native dependencies are installed and compiled directly within the target OS/architecture layer during container build, or pure JS/pre-built multi- platform alternatives are used.",
    failCondition: "Project relies on native addons, but target Dockerfile copies pre-installed local node_modules into container instead of executing a clean install inside the container environment.",
    source: "Node.js Addons Documentation; Docker Official Node Image Best Practices.",
  },
  {
    id: "DEP-PY-003",
    name: "Python unbuffered stdout/stderr logging",
    category: "RUNTIME",
    layer: "TECHNOLOGY",
    domain: "runtime",
    area: "python",
    classification: "PYTHON",
    description: "Ensures PYTHONUNBUFFERED=1 is configured so application logs stream immediately to container log drivers.",
    severity: "MEDIUM",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "CONFIG",
    remediation: {
      "summary": "Set ENV PYTHONUNBUFFERED=1 in Dockerfile or deployment environment.",
      "guidance": "Without unbuffered output, Python buffers stdout in memory, causing log lines to be delayed or lost on container termination.",
      "steps": [
            "Add ENV PYTHONUNBUFFERED=1 to Dockerfile."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["Dockerfile or env manifest containing PYTHONUNBUFFERED"],
    tags: ["python","runtime","logging"],
    aliases: ["tech.runtime.python.unbuffered_io","PY-003","PY-004"],
    predicates: {
      "runtimes": [
            "Python"
      ],
      "languages": [
            "Python"
      ]
},
    expectedBehavior: "PYTHONUNBUFFERED=1 must be configured for real-time container log streaming.",
    passCondition: "ENV PYTHONUNBUFFERED=1 is present in the Dockerfile or supplied via deployment environment variables.",
    failCondition: "Target runtime is a Docker container or Kubernetes pod, and PYTHONUNBUFFERED is not set in the environment or Dockerfile.",
    source: "Official Python Docker Image Best Practices.",
  },
  {
    id: "DEP-PY-004",
    name: "Python production WSGI/ASGI server declaration",
    category: "RUNTIME",
    layer: "TECHNOLOGY",
    domain: "runtime",
    area: "python",
    classification: "PYTHON",
    description: "Verifies production start command uses Gunicorn, Uvicorn, Waitress, or Hypercorn rather than \"python manage.py runserver\" or dev server.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Use a production WSGI/ASGI server such as gunicorn or uvicorn in start command.",
      "guidance": "Built-in development servers are single-threaded and explicitly insecure for production traffic.",
      "steps": [
            "Install gunicorn/uvicorn and configure start command: \"gunicorn app:app -w 4 -k uvicorn.workers.UvicornWorker\"."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["Procfile or start script ASGI/WSGI invocation"],
    tags: ["python","server","asgi","wsgi"],
    aliases: ["tech.runtime.python.production_server","PY-004","PY-003"],
    predicates: {
      "runtimes": [
            "Python"
      ],
      "languages": [
            "Python"
      ]
},
    expectedBehavior: "Production startup command must run a hardened WSGI/ASGI server without development reloaders.",
    passCondition: "Production startup invokes a production server (e.g., gunicorn -w 4 -k uvicorn.workers.UvicornWorker app:app).",
    failCondition: "The production startup command executes python manage.py runserver, flask run, or includes the development flag --reload.",
    source: "Django Documentation (How to deploy with WSGI/ASGI); FastAPI Production Deployment Documentation.",
  },
  {
    id: "DEP-FW-DJ-001",
    name: "Django DEBUG mode disabled in production",
    category: "CONFIGURATION",
    layer: "TECHNOLOGY",
    domain: "framework",
    area: "django",
    classification: "DJANGO",
    description: "Ensures Django settings.py or DJANGO_DEBUG environment variable evaluates to False in production.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Ensure DEBUG = False in production Django configuration.",
      "guidance": "Running Django with DEBUG = True exposes full source tracebacks, SQL queries, and environment secrets to web visitors.",
      "steps": [
            "Set DEBUG = os.getenv(\"DJANGO_DEBUG\", \"False\").lower() == \"true\" in settings.py."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["settings.py DEBUG expression or env declaration"],
    tags: ["django","security","config"],
    aliases: ["tech.framework.django.debug_mode","DJ-001"],
    predicates: {
      "frameworks": [
            "Django"
      ]
},
    expectedBehavior: "DEBUG must evaluate to False in production deployments.",
    passCondition: "DEBUG = False is explicitly set, or parsed via boolean conversion defaulting to False (e.g., os.getenv(\"DEBUG\", \"False\").lower() in (\"true\", \"1\")).",
    failCondition: "DEBUG = True is hardcoded in production settings without an environment-based override mechanism.",
    source: "Django Official Documentation (Deployment Checklist - DEBUG).",
  },
  {
    id: "DEP-FW-DJ-002",
    name: "Django ALLOWED_HOSTS production configuration",
    category: "CONFIGURATION",
    layer: "TECHNOLOGY",
    domain: "framework",
    area: "django",
    classification: "DJANGO",
    description: "Ensures ALLOWED_HOSTS is populated with production domains and not empty when DEBUG is False.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Define ALLOWED_HOSTS with your production domain names.",
      "guidance": "Django raises DisallowedHost (400 Bad Request) on all requests if ALLOWED_HOSTS is empty in production.",
      "steps": [
            "Configure ALLOWED_HOSTS = os.getenv(\"ALLOWED_HOSTS\", \"\").split(\",\") in settings.py."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["settings.py ALLOWED_HOSTS expression"],
    tags: ["django","security","hosts"],
    aliases: ["tech.framework.django.allowed_hosts","DJ-002"],
    predicates: {
      "frameworks": [
            "Django"
      ]
},
    expectedBehavior: "ALLOWED_HOSTS must contain target production domain names or IP addresses.",
    passCondition: "ALLOWED_HOSTS contains an explicit list of valid production domains or reads allowed hosts from an environment variable.",
    failCondition: "ALLOWED_HOSTS is an empty list ([]) while DEBUG is False, or is unconfigured.",
    source: "Django Documentation (Settings - ALLOWED_HOSTS).",
  },
  {
    id: "DEP-DSK-003",
    name: "Electron renderer process context isolation security",
    category: "SECURITY",
    layer: "PROJECT_TYPE",
    domain: "desktop",
    area: "electron",
    classification: "DESKTOP",
    description: "Verifies webPreferences in BrowserWindow specifies contextIsolation: true and nodeIntegration: false.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "AST",
    remediation: {
      "summary": "Enable contextIsolation and disable nodeIntegration in BrowserWindow webPreferences.",
      "guidance": "Enabling nodeIntegration in renderer processes allows arbitrary remote code execution if any XSS occurs.",
      "steps": [
            "Set webPreferences: { contextIsolation: true, nodeIntegration: false, preload: ... }."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["BrowserWindow webPreferences AST declaration"],
    tags: ["electron","desktop","security"],
    aliases: ["project_type.desktop.electron_context_isolation","DSK-ELEC-001"],
    predicates: {
      "projectTypes": [
            "desktop",
            "electron"
      ]
},
    expectedBehavior: "contextIsolation: true and nodeIntegration: false must be enforced across all windows.",
    passCondition: "All BrowserWindow instances configure contextIsolation: true and nodeIntegration: false.",
    failCondition: "contextIsolation: false or nodeIntegration: true is configured in any BrowserWindow.",
    source: "Electron Official Security Guidelines.",
  },
  {
    id: "DEP-DSK-004",
    name: "Tauri Content Security Policy (CSP) definition",
    category: "SECURITY",
    layer: "PROJECT_TYPE",
    domain: "desktop",
    area: "tauri",
    classification: "DESKTOP",
    description: "Verifies tauri.conf.json defines a strict Content Security Policy (CSP) in tauri.security.csp.",
    severity: "HIGH",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "CONFIG",
    remediation: {
      "summary": "Define a strict Content Security Policy in tauri.conf.json.",
      "guidance": "Tauri requires CSP to protect native rust bindings against malicious script injection.",
      "steps": [
            "Add \"csp\": \"default-src 'self'; img-src 'self' asset: https://asset.localhost\" to tauri.conf.json."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["tauri.conf.json security.csp setting"],
    tags: ["tauri","desktop","security"],
    aliases: ["project_type.desktop.tauri_csp","DSK-TAUR-001"],
    predicates: {
      "projectTypes": [
            "desktop",
            "tauri"
      ]
},
    expectedBehavior: "Restrictive CSP must be declared in tauri.conf.json.",
    passCondition: "A valid, restrictive CSP string (defining default-src, script-src, style-src) is configured.",
    failCondition: "app.security.csp is null, empty, or absent from tauri.conf.json.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "DEP-WRK-004",
    name: "Cron schedule expression syntax validation",
    category: "PROJECT_TYPE",
    layer: "PROJECT_TYPE",
    domain: "worker",
    area: "scheduling",
    classification: "WORKER",
    description: "Validates that scheduled task crontabs or cron expressions have 5 or 6 valid fields with acceptable bounds.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Ensure cron scheduling strings follow standard 5-field crontab syntax.",
      "guidance": "Malformed cron schedules fail silently or crash scheduler runners on boot.",
      "steps": [
            "Verify cron expressions (e.g. \"0 0 * * *\" for midnight) with standard crontab validator."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["cron expression configuration string"],
    tags: ["worker","cron","scheduling"],
    aliases: ["project_type.worker.cron_syntax","TYP-CRON-001"],
    predicates: {
      "projectTypes": [
            "worker",
            "job",
            "background",
            "queue"
      ]
},
    expectedBehavior: "Valid cron expression (e.g., 0 0 * * * for daily midnight execution).",
    passCondition: "Cron expression is syntactically valid and compliant with the target platform's supported intervals.",
    failCondition: "Cron expression fails validation against standard cron schedule parser specifications.",
    source: "Open Group Base Specifications (crontab specification).",
  },
  {
    id: "DEP-WRK-005",
    name: "Worker process HTTP listener prohibition",
    category: "PROJECT_TYPE",
    layer: "PROJECT_TYPE",
    domain: "worker",
    area: "network",
    classification: "WORKER",
    description: "Verifies dedicated worker processes do not bind public HTTP ports unless explicitly configured as a hybrid service.",
    severity: "MEDIUM",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "AST",
    remediation: {
      "summary": "Remove public HTTP server listener from pure worker background processes.",
      "guidance": "Pure workers scheduled on PaaS worker tiers will trigger port binding failure alerts if they open web ports.",
      "steps": [
            "Remove app.listen() from pure queue worker entrypoints."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["server listen call detection in worker entrypoint"],
    tags: ["worker","architecture"],
    aliases: ["project_type.worker.no_unintended_http","TYP-WRK-001"],
    predicates: {
      "projectTypes": [
            "worker",
            "job",
            "background"
      ]
},
    expectedBehavior: "Workers must be configured as worker or background services in deployment manifests.",
    passCondition: "Background worker is configured with service type worker in deployment manifests.",
    failCondition: "Background queue consumer service is declared as a web service type without an HTTP server listener.",
    source: "Render Documentation (Background Workers); Heroku Process Types.",
  },
  {
    id: "DEP-HOST-DOCKER-004",
    name: "Dockerfile HEALTHCHECK instruction",
    category: "HOSTING",
    layer: "DEPLOYMENT_TARGET",
    domain: "hosting",
    area: "docker",
    classification: "DOCKER",
    description: "Ensures Dockerfile contains a HEALTHCHECK instruction for container lifecycle management.",
    severity: "MEDIUM",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "STATIC",
    remediation: {
      "summary": "Add HEALTHCHECK instruction to Dockerfile.",
      "guidance": "Docker daemon uses HEALTHCHECK to determine when container is healthy before routing ingress traffic.",
      "steps": [
            "Add HEALTHCHECK --interval=30s --timeout=5s CMD curl -f http://localhost:PORT/healthz || exit 1."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["Dockerfile HEALTHCHECK instruction"],
    tags: ["docker","container","healthcheck"],
    aliases: ["target.hosting.docker.healthcheck","DOCK-001"],
    predicates: {
      "hosting": [
            "Docker"
      ]
},
    expectedBehavior: "Production Dockerfiles must isolate compiled artifacts using multi- stage builds.",
    passCondition: "Dockerfile implements multi-stage builds and the runtime image contains only compiled application binaries and production dependencies.",
    failCondition: "Dockerfile contains only a single FROM stage that installs build tools and leaves all source/dev files in the final runtime container image.",
    source: "Docker Documentation (Multi-stage builds best practices).",
  },
  {
    id: "DEP-HOST-K8S-001",
    name: "Kubernetes liveness and readiness probe configuration",
    category: "HOSTING",
    layer: "DEPLOYMENT_TARGET",
    domain: "hosting",
    area: "kubernetes",
    classification: "KUBERNETES",
    description: "Verifies Kubernetes Deployment manifests define livenessProbe and readinessProbe for zero-downtime rollouts.",
    severity: "HIGH",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "CONFIG",
    remediation: {
      "summary": "Define livenessProbe and readinessProbe in Kubernetes container spec.",
      "guidance": "Without readiness probes, Kubernetes sends user traffic to newly starting pods before they finish initial connection setup.",
      "steps": [
            "Add httpGet probes pointing to /healthz in deployment YAML."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["Kubernetes manifest probe definitions"],
    tags: ["kubernetes","k8s","probes"],
    aliases: ["target.hosting.kubernetes.probes","K8S-001"],
    predicates: {
      "hosting": [
            "Kubernetes",
            "k8s"
      ]
},
    expectedBehavior: "Independent liveness (process ping) and readiness (dependency check) probes must be defined.",
    passCondition: "Both probes are defined: livenessProbe verifies local process health (shallow check), while readinessProbe verifies readiness to accept network traffic.",
    failCondition: "Neither livenessProbe nor readinessProbe is defined, or the livenessProbe executes an HTTP request against a route that performs external database ping queries.",
    source: "Kubernetes Documentation (Configure Liveness, Readiness and Startup Probes).",
  },
  {
    id: "DEP-SEO-001",
    name: "Robots.txt and sitemap discovery presence",
    category: "SEO",
    layer: "PROJECT_TYPE",
    domain: "seo",
    area: "metadata",
    classification: "WEB_APPLICATION",
    description: "Checks for public robots.txt and sitemap.xml in web application public directory.",
    severity: "LOW",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "FILESYSTEM",
    remediation: {
      "summary": "Provide public/robots.txt and sitemap.xml for web applications.",
      "guidance": "Ensures search engines can crawl public pages and avoids unwanted indexing of administrative endpoints.",
      "steps": [
            "Create public/robots.txt specifying Disallow rules and Sitemap URL."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["public/robots.txt existence"],
    tags: ["seo","web","discovery"],
    aliases: ["project_type.web.robots_txt","SEO-001"],
    predicates: {
      "projectTypes": [
            "web application",
            "frontend"
      ]
},
    expectedBehavior: "Deployable artifact must satisfy Robots.txt and sitemap discovery presence requirements.",
    passCondition: "All configuration parameters and files for Robots.txt and sitemap discovery presence are valid.",
    failCondition: "Missing or invalid configuration detected for Robots.txt and sitemap discovery presence.",
    source: "PreFlight AI Deployment Knowledge Base",
  },
  {
    id: "DEP-FW-DJ-003",
    name: "Django static assets root and collection configuration",
    category: "BUILD",
    layer: "TECHNOLOGY",
    domain: "framework",
    area: "django",
    classification: "DJANGO",
    description: "Ensures STATIC_ROOT is configured and WhiteNoise or static collection command is present.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "CONFIG",
    remediation: {
      "summary": "Define STATIC_ROOT and configure WhiteNoise or static collection.",
      "guidance": "Production WSGI servers do not serve static files by default; missing static configuration causes 404s for CSS/JS.",
      "steps": [
            "Define STATIC_ROOT = BASE_DIR / \"staticfiles\" in settings.py.",
            "Add \"whitenoise.middleware.WhiteNoiseMiddleware\" to MIDDLEWARE.",
            "Run \"python manage.py collectstatic --noinput\" during build."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["settings.py STATIC_ROOT declaration","WhiteNoise middleware presence"],
    tags: ["django","python","static","whitenoise"],
    aliases: ["tech.framework.django.static_root","DJ-003"],
    predicates: {
      "frameworks": [
            "Django"
      ]
},
    expectedBehavior: "STATIC_ROOT defined and static files precompiled during build.",
    passCondition: "STATIC_ROOT is declared, WhiteNoise (or S3/CDN backend) is configured, and collectstatic runs during build.",
    failCondition: "STATIC_ROOT is missing from settings.py, or Dockerfile/build pipeline lacks collectstatic while serving static assets directly.",
    source: "Django Documentation (Managing static files); WhiteNoise Documentation (DJ-003)",
  },
  {
    id: "DEP-RUNTIME-JAVA-001",
    name: "Java compiler target and runtime JDK alignment",
    category: "RUNTIME",
    layer: "TECHNOLOGY",
    domain: "runtime",
    area: "java",
    classification: "JAVA",
    description: "Verifies pom.xml or build.gradle Java target version does not exceed runtime JDK image version.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Align compiled Java bytecode target version with deployment runtime JRE.",
      "guidance": "Compiling with JDK 21 and running on JRE 17 produces fatal UnsupportedClassVersionError on boot.",
      "steps": [
            "Align compiler target in pom.xml/build.gradle or update container base image to match JDK version."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["pom.xml maven.compiler.target or build.gradle targetCompatibility","Dockerfile JRE version"],
    tags: ["java","jdk","runtime","bytecode"],
    aliases: ["tech.runtime.java.version_compat","JAVA-001"],
    predicates: {
      "languages": [
            "Java"
      ]
},
    expectedBehavior: "Compiled bytecode version must be supported by runtime JRE/JDK.",
    passCondition: "The runtime JRE version is greater than or equal to the compiler bytecode target version.",
    failCondition: "Compiler target bytecode version is higher than target runtime JRE version.",
    source: "Oracle JDK Compatibility Guide; JVM Specification (JAVA-001)",
  },
  {
    id: "DEP-RUNTIME-JAVA-002",
    name: "JVM container memory limits and ergonomics",
    category: "RUNTIME",
    layer: "TECHNOLOGY",
    domain: "runtime",
    area: "java",
    classification: "JAVA",
    description: "Ensures containerized JVM evaluates cgroup limits using -XX:+UseContainerSupport and -XX:MaxRAMPercentage.",
    severity: "HIGH",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "CONFIG",
    remediation: {
      "summary": "Configure container-aware JVM memory ergonomics flags.",
      "guidance": "Without container awareness, JVM evaluates host machine RAM rather than container cgroup limit, causing OOMKilled exit code 137.",
      "steps": [
            "Configure JAVA_TOOL_OPTIONS=\"-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0\" in Dockerfile or container pod environment."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["Dockerfile JAVA_TOOL_OPTIONS or Kubernetes container environment flags"],
    tags: ["java","jvm","memory","cgroup","docker"],
    aliases: ["tech.runtime.java.container_memory","JAVA-003"],
    predicates: {
      "languages": [
            "Java"
      ]
},
    expectedBehavior: "JVM heap must dynamically respect container cgroup memory boundaries.",
    passCondition: "JVM startup flags include container-aware memory limits (-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0).",
    failCondition: "Java process in container uses legacy static heap flags exceeding resource limits or lacks container awareness configuration.",
    source: "OpenJDK HotSpot Virtual Machine Garbage Collection Tuning Guide (JAVA-003)",
  },
  {
    id: "DEP-RUNTIME-GO-001",
    name: "Go static compilation and CGO linking flags",
    category: "BUILD",
    layer: "TECHNOLOGY",
    domain: "runtime",
    area: "go",
    classification: "GO",
    description: "Verifies Go binaries compiled for scratch or Alpine containers use CGO_ENABLED=0 or static libc linking.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Build Go binaries with CGO_ENABLED=0 when targeting scratch or Alpine images.",
      "guidance": "Dynamic glibc linking causes instant launch crash: exec user process caused: no such file or directory in scratch/musl containers.",
      "steps": [
            "Set CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main . in Dockerfile."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["Dockerfile go build flags","CGO_ENABLED environment variable"],
    tags: ["go","cgo","compilation","scratch","alpine"],
    aliases: ["tech.runtime.go.cgo_linking","GO-001"],
    predicates: {
      "languages": [
            "Go"
      ]
},
    expectedBehavior: "Go binary must be statically linked when targeting minimal scratch or Alpine container environments.",
    passCondition: "Go build explicitly sets CGO_ENABLED=0 for minimal images, or uses a compatible base image containing matching shared dynamic libraries.",
    failCondition: "Dockerfile compiles Go without CGO_ENABLED=0, but deploys binary to scratch or Alpine base image.",
    source: "Go Official Toolchain Documentation (CGO); Docker Go Best Practices (GO-001)",
  },
  {
    id: "DEP-RUNTIME-GO-002",
    name: "Minimal container root CA certificates presence",
    category: "DEPENDENCIES",
    layer: "DEPLOYMENT_TARGET",
    domain: "hosting",
    area: "docker",
    classification: "DOCKER",
    description: "Ensures container base images (such as scratch) have root CA certificates installed for outbound TLS.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "STATIC",
    remediation: {
      "summary": "Copy CA certificate bundle into minimal scratch/distroless runtime images.",
      "guidance": "Empty scratch images contain no root CA certificates; all outbound HTTPS or database TLS connections fail with x509 unknown authority.",
      "steps": [
            "Add COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ to the final stage of Dockerfile."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["Dockerfile COPY instruction for ca-certificates.crt"],
    tags: ["docker","tls","certificates","scratch","security"],
    aliases: ["target.hosting.docker.ca_certificates","GO-002"],
    predicates: {
      "hosting": [
            "Docker"
      ]
},
    expectedBehavior: "Minimal container images must possess a root CA certificate bundle for TLS verification.",
    passCondition: "Runtime container image includes /etc/ssl/certs/ca-certificates.crt or inherits from an OS base image with pre-installed CAs.",
    failCondition: "Target runtime base image is scratch and no CA certificate bundle is copied into /etc/ssl/certs/.",
    source: "Mozilla Included CA Certificate List; Distroless Base Documentation (GO-002)",
  },
  {
    id: "DEP-RUNTIME-RUST-001",
    name: "Cargo release profile optimization",
    category: "BUILD",
    layer: "TECHNOLOGY",
    domain: "runtime",
    area: "rust",
    classification: "RUST",
    description: "Verifies Rust binaries are built with --release flag or dedicated production profile in deployment artifacts.",
    severity: "HIGH",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Compile production Rust binaries with cargo build --release.",
      "guidance": "Rust debug builds run 10x-100x slower and consume massive memory overhead due to debug assertions and unoptimized codegen.",
      "steps": [
            "Add --release flag to cargo build / cargo install command in Dockerfile or CI script."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["Dockerfile cargo build command","Cargo.toml release profile"],
    tags: ["rust","cargo","release","optimization"],
    aliases: ["tech.runtime.rust.release_profile","RUST-002"],
    predicates: {
      "languages": [
            "Rust"
      ]
},
    expectedBehavior: "Production Rust binaries must be compiled with release optimizations enabled.",
    passCondition: "Compilation command includes --release, and Cargo.toml release profile specifies full optimization.",
    failCondition: "Production build commands invoke cargo build without --release or without a release profile.",
    source: "The Cargo Book (Profiles - release); Rust Performance Book (RUST-002)",
  },
  {
    id: "DEP-FW-NEXT-004",
    name: "Next.js remote image optimization domain declarations",
    category: "CONFIGURATION",
    layer: "TECHNOLOGY",
    domain: "framework",
    area: "nextjs",
    classification: "NEXTJS",
    description: "Ensures next.config.js remotePatterns or domains are configured when next/image loads remote assets.",
    severity: "HIGH",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "CONFIG",
    remediation: {
      "summary": "Declare allowed remote domains in next.config.js images.remotePatterns.",
      "guidance": "Using next/image with undeclared remote origins throws fatal Next.js client/SSR rendering exceptions.",
      "steps": [
            "Add images: { remotePatterns: [{ protocol: \"https\", hostname: \"example.com\" }] } to next.config.js."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["next.config.js images configuration block"],
    tags: ["nextjs","images","optimization","config"],
    aliases: ["tech.framework.nextjs.images_remote_patterns","NEXT-004"],
    predicates: {
      "frameworks": [
            "Next.js"
      ]
},
    expectedBehavior: "Remote hostnames used by next/image must be explicitly declared in image configuration.",
    passCondition: "next.config.js declares images.remotePatterns (or domains) covering required remote asset hosts.",
    failCondition: "next/image components query remote URLs while images.remotePatterns is empty or undeclared.",
    source: "Next.js Documentation (API Reference: next/image - remotePatterns) (NEXT-004)",
  },
  {
    id: "DEP-FW-NUXT-001",
    name: "Nuxt Nitro preset target infrastructure alignment",
    category: "CONFIGURATION",
    layer: "TECHNOLOGY",
    domain: "framework",
    area: "nuxt",
    classification: "NUXT",
    description: "Verifies nuxt.config nitro.preset matches target hosting platform (node-server, vercel, cloudflare-pages).",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Set nitro.preset in nuxt.config.ts matching deployment target architecture.",
      "guidance": "A mismatched Nitro preset causes fatal runtime errors (e.g. attempting to use Node fs/net APIs in Cloudflare Edge).",
      "steps": [
            "Set nitro: { preset: \"node-server\" } for Docker or \"vercel\" for Vercel in nuxt.config.ts."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["nuxt.config.ts nitro.preset setting","target hosting environment"],
    tags: ["nuxt","nitro","presets","edge","hosting"],
    aliases: ["tech.framework.nuxt.nitro_preset","NUXT-001"],
    predicates: {
      "frameworks": [
            "Nuxt"
      ]
},
    expectedBehavior: "Nuxt Nitro output preset must match the host deployment infrastructure.",
    passCondition: "nitro.preset matches the deployment target architecture exactly.",
    failCondition: "nitro.preset is explicitly set to an incompatible target (e.g. \"node\" for Cloudflare Pages).",
    source: "Nuxt 3 Documentation (Deployment - Presets); Nitro Documentation (NUXT-001)",
  },
  {
    id: "DEP-FW-SVELTE-001",
    name: "SvelteKit production adapter specification",
    category: "CONFIGURATION",
    layer: "TECHNOLOGY",
    domain: "framework",
    area: "sveltekit",
    classification: "SVELTEKIT",
    description: "Ensures svelte.config.js configures explicit platform adapter (@sveltejs/adapter-node) instead of adapter-auto for containers.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Install and configure explicit SvelteKit adapter in svelte.config.js.",
      "guidance": "adapter-auto fails during container builds with an error requiring explicit adapter installation for non-serverless hosts.",
      "steps": [
            "Run npm install -D @sveltejs/adapter-node and import adapter-node in svelte.config.js."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["svelte.config.js adapter import","package.json dependencies"],
    tags: ["sveltekit","adapter","build","docker"],
    aliases: ["tech.framework.sveltekit.adapter","SVELTE-001"],
    predicates: {
      "frameworks": [
            "SvelteKit"
      ]
},
    expectedBehavior: "Target platform must have an explicit matching SvelteKit production adapter configured.",
    passCondition: "An explicit, platform-appropriate adapter is installed in package.json and imported in svelte.config.js.",
    failCondition: "Target deployment is Docker container or custom VPS server, but svelte.config.js still imports adapter-auto.",
    source: "SvelteKit Documentation (Adapters) (SVELTE-001)",
  },
  {
    id: "DEP-FW-FAST-002",
    name: "Uvicorn production auto-reload deactivation",
    category: "CONFIGURATION",
    layer: "TECHNOLOGY",
    domain: "framework",
    area: "fastapi",
    classification: "FASTAPI",
    description: "Verifies production startup commands do not include the --reload development flag for Uvicorn.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Remove --reload flag from production Uvicorn startup invocation.",
      "guidance": "The --reload flag starts filesystem watchers, causing excessive CPU consumption, memory leaks, and breaking clustering.",
      "steps": [
            "Remove \"--reload\" from CMD [\"uvicorn\", \"main:app\", \"--host\", \"0.0.0.0\", \"--port\", \"8000\"]."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["Dockerfile CMD/ENTRYPOINT or Procfile uvicorn startup command"],
    tags: ["fastapi","uvicorn","python","reload"],
    aliases: ["tech.framework.fastapi.uvicorn_reload","FAST-001"],
    predicates: {
      "frameworks": [
            "FastAPI"
      ]
},
    expectedBehavior: "Uvicorn production startup command must run without development --reload watchers.",
    passCondition: "Uvicorn is invoked without --reload and uses worker pooling or Gunicorn process supervision.",
    failCondition: "Uvicorn startup invocation includes the --reload argument.",
    source: "FastAPI Documentation (Deployment - Run Uvicorn in Production) (FAST-001)",
  },
  {
    id: "DEP-FW-FAST-003",
    name: "FastAPI permissive CORS origin and credential combination prevention",
    category: "SECURITY",
    layer: "TECHNOLOGY",
    domain: "framework",
    area: "fastapi",
    classification: "FASTAPI",
    description: "Verifies FastAPI CORSMiddleware does not pair allow_origins=[\"*\"] with allow_credentials=True.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "AST",
    remediation: {
      "summary": "Replace wildcard CORS origin with explicit origin whitelist when credentials are allowed.",
      "guidance": "Browsers block responses containing wildcard origin with credentials allowed; it also creates severe cross-site security leaks.",
      "steps": [
            "Set allow_origins to explicit origins list or load authorized domains from environment variable."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["CORSMiddleware AST configuration parameters"],
    tags: ["fastapi","security","cors","credentials"],
    aliases: ["tech.framework.fastapi.cors_credentials","FAST-002"],
    predicates: {
      "frameworks": [
            "FastAPI"
      ]
},
    expectedBehavior: "Explicit domain origins must be specified when credentials are allowed.",
    passCondition: "allow_origins specifies an explicit list of authorized origin domains, or allow_credentials is set to False.",
    failCondition: "allow_origins includes wildcard \"*\" while allow_credentials=True.",
    source: "MDN Web Docs (CORS - Access-Control-Allow-Credentials); FastAPI CORS Tutorial (FAST-002)",
  },
  {
    id: "DEP-FW-SPRING-001",
    name: "Spring Boot production active profile explicit declaration",
    category: "CONFIGURATION",
    layer: "TECHNOLOGY",
    domain: "framework",
    area: "spring",
    classification: "SPRING_BOOT",
    description: "Ensures spring.profiles.active is explicitly declared as prod/production in deployment manifests.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Set SPRING_PROFILES_ACTIVE=prod in production deployment configuration.",
      "guidance": "Dev/default profiles in Spring Boot often enable embedded H2 databases, mock services, and disable security controls.",
      "steps": [
            "Set environment variable SPRING_PROFILES_ACTIVE=prod in container Dockerfile or deployment manifest."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["application.properties/yml spring.profiles.active or environment variable"],
    tags: ["spring","spring-boot","profiles","config"],
    aliases: ["tech.framework.spring.active_profile","SPRG-001"],
    predicates: {
      "frameworks": [
            "Spring Boot"
      ]
},
    expectedBehavior: "Spring Boot must be launched with production profile active.",
    passCondition: "spring.profiles.active is set to prod or equivalent production profile name via environment variable.",
    failCondition: "spring.profiles.active is explicitly configured as dev, development, or test in production deployment manifests.",
    source: "Spring Boot Reference Documentation (Profiles) (SPRG-001)",
  },
  {
    id: "DEP-FW-SPRING-002",
    name: "Spring Boot Actuator sensitive endpoint exposure restriction",
    category: "SECURITY",
    layer: "TECHNOLOGY",
    domain: "framework",
    area: "spring",
    classification: "SPRING_BOOT",
    description: "Ensures Spring Actuator does not expose sensitive endpoints (*, env, heapdump) without authentication.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "CONFIG",
    remediation: {
      "summary": "Restrict management.endpoints.web.exposure.include to safe health/info endpoints.",
      "guidance": "Exposing env or heapdump publicly allows unauthenticated attackers to extract database passwords or memory state.",
      "steps": [
            "Set management.endpoints.web.exposure.include: health,info in application.yml."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["application.yml management.endpoints.web.exposure.include setting"],
    tags: ["spring","spring-boot","actuator","security"],
    aliases: ["tech.framework.spring.actuator_exposure","SPRG-002"],
    predicates: {
      "frameworks": [
            "Spring Boot"
      ]
},
    expectedBehavior: "Public actuator exposure must be restricted to health,info.",
    passCondition: "Only safe endpoints (health, info) are exposed publicly, or all endpoints are restricted behind authentication.",
    failCondition: "management.endpoints.web.exposure.include contains \"*\", \"env\", or \"heapdump\" without authentication protection.",
    source: "Spring Boot Actuator Security Documentation (SPRG-002)",
  },
  {
    id: "DEP-FW-LARAVEL-001",
    name: "Laravel application encryption key declaration (APP_KEY)",
    category: "ENVIRONMENT",
    layer: "TECHNOLOGY",
    domain: "framework",
    area: "laravel",
    classification: "LARAVEL",
    description: "Verifies APP_KEY is present and formatted as a valid base64 32-byte key in environment variables.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Generate and supply valid APP_KEY in production environment.",
      "guidance": "Missing or invalid APP_KEY causes fatal RuntimeException: No application encryption key has been specified on every HTTP request.",
      "steps": [
            "Run \"php artisan key:generate --show\" and set APP_KEY in production environment variables."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["APP_KEY in environment variables or deployment manifests"],
    tags: ["laravel","php","encryption","app_key","security"],
    aliases: ["tech.framework.laravel.app_key","LAR-002"],
    predicates: {
      "frameworks": [
            "Laravel"
      ]
},
    expectedBehavior: "APP_KEY must be configured with a 32-character base64 encryption key.",
    passCondition: "APP_KEY is set to a valid 32-byte base64 string.",
    failCondition: "APP_KEY is missing, empty, or does not begin with base64:.",
    source: "Laravel Documentation (Configuration - Application Key) (LAR-002)",
  },
  {
    id: "DEP-FW-RAILS-001",
    name: "Rails asset pipeline precompilation in deployment image",
    category: "BUILD",
    layer: "TECHNOLOGY",
    domain: "framework",
    area: "rails",
    classification: "RUBY_ON_RAILS",
    description: "Ensures bundle exec rake assets:precompile is executed during container build for Rails production.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Add \"bundle exec rake assets:precompile\" to Dockerfile build stage.",
      "guidance": "In production mode Rails disables live asset compilation; missing precompiled assets results in 404s and broken styles.",
      "steps": [
            "Add \"RUN bundle exec rake assets:precompile\" to Dockerfile with SECRET_KEY_BASE_DUMMY=1."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["Dockerfile assets:precompile instruction","public/assets precompiled output"],
    tags: ["rails","ruby","assets","precompile","build"],
    aliases: ["tech.framework.rails.assets_precompile","RAILS-001"],
    predicates: {
      "frameworks": [
            "Ruby on Rails"
      ]
},
    expectedBehavior: "Rails assets must be precompiled into public/assets prior to container release.",
    passCondition: "assets:precompile is present in build stage and precompiled assets are written to public/assets/.",
    failCondition: "Project uses Sprockets/Propshaft but assets:precompile is missing from Dockerfile or build scripts.",
    source: "Ruby on Rails Guides (The Asset Pipeline - Precompiling Assets) (RAILS-001)",
  },
  {
    id: "DEP-DB-SQLITE-001",
    name: "Ephemeral SQLite database usage in auto-scaling container runtimes",
    category: "DATABASE",
    layer: "TECHNOLOGY",
    domain: "database",
    area: "sqlite",
    classification: "SQLITE",
    description: "Detects SQLite database usage in auto-scaling stateless container environments where data will be lost on container restart.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Migrate from ephemeral SQLite to hosted managed database (PostgreSQL, MySQL) or attach persistent volume.",
      "guidance": "Stateless container runtimes (Kubernetes, ECS, Cloud Run) discard container filesystem on termination, leading to permanent data loss.",
      "steps": [
            "Provision a managed database instance (e.g. AWS RDS, Cloud SQL, Neon, Supabase).",
            "Update application database connection string environment variables.",
            "If SQLite is required, attach a persistent volume claim (PVC) with single-replica constraint."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["SQLite database file configuration","stateless container runtime configuration"],
    tags: ["sqlite","database","persistence","containers","data-loss"],
    aliases: ["tech.database.sqlite.ephemeral_warning","DB-001"],
    predicates: {
      "databases": [
            "SQLite"
      ]
},
    expectedBehavior: "Persistent production applications must not write critical state to ephemeral container filesystems.",
    passCondition: "Database uses managed external engine (Postgres/MySQL) or SQLite is backed by explicit persistent volume volume mount.",
    failCondition: "SQLite file path resides on ephemeral container root filesystem without persistent volume storage.",
    source: "12-Factor App (IV. Backing services & VI. Processes); PreFlight Database Knowledge Base (DB-001)",
  },
  {
    id: "DEP-DB-SEED-001",
    name: "Production database seeding command execution prohibition",
    category: "DATABASE",
    layer: "TECHNOLOGY",
    domain: "database",
    area: "database",
    classification: "DATABASE",
    description: "Ensures database seeding commands (prisma db seed, db:seed, sequelize db:seed:all) are not executed in release scripts.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Remove database seed commands from release phases and container start scripts.",
      "guidance": "Running seed scripts in production can overwrite existing live customer data, introduce duplicate dummy records, or fail due to unique key conflicts.",
      "steps": [
            "Remove db:seed or prisma db seed from Procfile release tasks, package.json start scripts, or deployment pipeline commands."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["Procfile release commands","Dockerfile CMD/ENTRYPOINT","deployment scripts"],
    tags: ["database","seeding","production-safety","data-integrity"],
    aliases: ["tech.database.no_production_seed","DB-008"],
    predicates: {
      "databases": [
            "PostgreSQL",
            "MySQL",
            "MongoDB",
            "SQLite"
      ]
},
    expectedBehavior: "Database seeding must be isolated to development environments and forbidden in release tasks.",
    passCondition: "Release scripts, entrypoint scripts, and Procfile contain no database seed invocations.",
    failCondition: "Release phase or deployment container startup command contains database seeding commands.",
    source: "Production Database Operational Reliability Checklist; PreFlight Check Knowledge Base (DB-008)",
  },
  {
    id: "DEP-ORM-PRISMA-004",
    name: "Prisma query engine binary target platform matching",
    category: "BUILD",
    layer: "TECHNOLOGY",
    domain: "orm",
    area: "prisma",
    classification: "PRISMA",
    description: "Verifies schema.prisma binaryTargets includes target container libc (e.g. linux-musl-openssl-3.0.x for Alpine).",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "CONFIG",
    remediation: {
      "summary": "Add deployment target platform to schema.prisma binaryTargets.",
      "guidance": "If binaryTargets only contains \"native\", deploying an Alpine/musl Docker image from macOS/glibc host will crash with PrismaClientInitializationError.",
      "steps": [
            "Add binaryTargets = [\"native\", \"linux-musl-openssl-3.0.x\"] to generator client block in schema.prisma."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["schema.prisma generator client binaryTargets","Dockerfile base OS"],
    tags: ["prisma","orm","binaryTargets","alpine","musl"],
    aliases: ["tech.orm.prisma.binary_targets","ORM-PRIS-003"],
    predicates: {
      "frameworks": [
            "Prisma"
      ]
},
    expectedBehavior: "Prisma client must generate query engine binaries compatible with production deployment container architecture.",
    passCondition: "schema.prisma binaryTargets contains target platform OS/libc or uses standard glibc container image.",
    failCondition: "Alpine/musl container deployed while schema.prisma lacks linux-musl binary target.",
    source: "Prisma Documentation (Deployment - Custom binaryTargets) (ORM-PRIS-003)",
  },
  {
    id: "DEP-ORM-DRIZZLE-001",
    name: "Drizzle migration SQL schema parity",
    category: "DATABASE",
    layer: "TECHNOLOGY",
    domain: "orm",
    area: "drizzle",
    classification: "DRIZZLE",
    description: "Verifies Drizzle schema changes have been compiled to SQL migrations with drizzle-kit generate.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "FILESYSTEM",
    remediation: {
      "summary": "Generate Drizzle SQL migration files using \"drizzle-kit generate\".",
      "guidance": "Deploying Drizzle schema edits without generated SQL migration files leads to schema drift and missing columns in production.",
      "steps": [
            "Run \"npx drizzle-kit generate\" locally and commit generated SQL files in migrations folder."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["drizzle schema files","migrations directory SQL files"],
    tags: ["drizzle","orm","sql","migrations"],
    aliases: ["tech.orm.drizzle.migration_parity","ORM-DRIZ-001"],
    predicates: {
      "frameworks": [
            "Drizzle"
      ]
},
    expectedBehavior: "Drizzle TypeScript schema definitions must be synchronized with generated SQL migration snapshots.",
    passCondition: "All modified Drizzle schema files have corresponding SQL migration files in the migrations directory.",
    failCondition: "Drizzle schema was modified more recently than latest migration snapshot or migration folder is empty.",
    source: "Drizzle ORM Documentation (Migrations - drizzle-kit generate) (ORM-DRIZ-001)",
  },
  {
    id: "DEP-ORM-ALEMBIC-001",
    name: "Alembic single migration head revision assertion",
    category: "DATABASE",
    layer: "TECHNOLOGY",
    domain: "orm",
    area: "alembic",
    classification: "ALEMBIC",
    description: "Verifies Alembic migration version DAG has exactly one head revision without unmerged branches.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "FILESYSTEM",
    remediation: {
      "summary": "Merge multiple Alembic migration heads into a single head revision.",
      "guidance": "Running \"alembic upgrade head\" in production aborts with a fatal error if multiple branch heads exist.",
      "steps": [
            "Run \"alembic merge heads -m \\\"merge branch heads\\\"\" locally and commit the merge revision file."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["alembic/versions down_revision graph"],
    tags: ["alembic","sqlalchemy","migrations","python","database"],
    aliases: ["tech.orm.alembic.single_head","ORM-ALEM-001"],
    predicates: {
      "frameworks": [
            "Alembic",
            "SQLAlchemy"
      ]
},
    expectedBehavior: "Exactly one head revision must exist in Alembic migration history DAG.",
    passCondition: "The migration revision graph resolves to exactly one leaf head revision.",
    failCondition: "More than one migration file contains down_revision pointers resulting in multiple branch heads without a merge migration.",
    source: "Alembic Documentation (Managing Multiple Heads) (ORM-ALEM-001)",
  },
  {
    id: "DEP-ORM-TYPEORM-001",
    name: "TypeORM automatic schema synchronization production inactivation",
    category: "DATABASE",
    layer: "TECHNOLOGY",
    domain: "orm",
    area: "typeorm",
    classification: "TYPEORM",
    description: "Ensures TypeORM dataSource synchronize option is strictly set to false in production configuration.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Disable automatic schema synchronization (synchronize: false) in production DataSource configuration.",
      "guidance": "synchronize: true automatically drops and alters tables on application boot, leading to catastrophic production data loss.",
      "steps": [
            "Set synchronize: false in data-source.ts or read synchronize from environment variable (synchronize: process.env.NODE_ENV === \"development\")."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["DataSource synchronize property in configuration AST"],
    tags: ["typeorm","sequelize","database","synchronize","data-loss"],
    aliases: ["tech.orm.typeorm.synchronize_disabled","ORM-TYPE-001"],
    predicates: {
      "frameworks": [
            "TypeORM",
            "Sequelize"
      ]
},
    expectedBehavior: "Production database schema changes must be driven exclusively by explicit migrations, never automatic sync.",
    passCondition: "DataSource configuration sets synchronize: false (or equivalent) in production environments.",
    failCondition: "synchronize: true is hardcoded or active in production database configuration.",
    source: "TypeORM Documentation (Migrations vs Synchronize) (ORM-TYPE-001)",
  },
  {
    id: "DEP-HOST-DOCKER-005",
    name: "Root user execution prevention in containers",
    category: "SECURITY",
    layer: "DEPLOYMENT_TARGET",
    domain: "hosting",
    area: "docker",
    classification: "DOCKER",
    description: "Ensures Dockerfile declares a non-root USER instruction prior to CMD or ENTRYPOINT.",
    severity: "HIGH",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "STATIC",
    remediation: {
      "summary": "Add non-root USER instruction (e.g. USER node or USER appuser) in Dockerfile.",
      "guidance": "Running container workloads as root grants potential container-escape vulnerabilities root access to host filesystem.",
      "steps": [
            "Add \"USER node\" (or create appuser with adduser) before CMD/ENTRYPOINT in Dockerfile."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["Dockerfile USER instruction"],
    tags: ["docker","security","non-root","containers"],
    aliases: ["target.hosting.docker.non_root_user","DOCK-002"],
    predicates: {
      "hosting": [
            "Docker"
      ]
},
    expectedBehavior: "Production containers must execute processes under an unprivileged non-root user ID.",
    passCondition: "Dockerfile contains a non-root USER instruction (e.g. USER node, USER 1001) in final runtime stage.",
    failCondition: "Dockerfile lacks USER instruction, defaulting to root user execution in production container.",
    source: "Docker Best Practices Guide (User Instruction); CIS Docker Benchmark 4.1 (DOCK-002)",
  },
  {
    id: "DEP-HOST-K8S-002",
    name: "Container resource requests and limits declaration",
    category: "CONFIGURATION",
    layer: "DEPLOYMENT_TARGET",
    domain: "hosting",
    area: "kubernetes",
    classification: "KUBERNETES",
    description: "Ensures Kubernetes Deployment container specs declare resources.requests and resources.limits.",
    severity: "HIGH",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "CONFIG",
    remediation: {
      "summary": "Define CPU and memory requests and limits in Kubernetes container resource specs.",
      "guidance": "Containers without resource limits can cause node exhaustion and starve neighboring pods, triggering node NotReady states.",
      "steps": [
            "Add resources: { requests: { memory: \"256Mi\", cpu: \"250m\" }, limits: { memory: \"512Mi\", cpu: \"500m\" } } to container spec."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["Kubernetes manifest resources.requests and resources.limits blocks"],
    tags: ["kubernetes","k8s","resources","limits","requests","capacity"],
    aliases: ["target.hosting.kubernetes.resources","K8S-002"],
    predicates: {
      "hosting": [
            "Kubernetes",
            "k8s"
      ]
},
    expectedBehavior: "All container specifications in Kubernetes manifests must declare explicit memory and CPU bounds.",
    passCondition: "Both resources.requests and resources.limits are declared for memory and CPU in container specs.",
    failCondition: "Container spec lacks resources.requests or resources.limits declaration.",
    source: "Kubernetes Documentation (Manage Resources for Containers); Production Best Practices (K8S-002)",
  },
  {
    id: "DEP-HOST-VERCEL-003",
    name: "Serverless function uncompressed bundle size limit",
    category: "BUILD",
    layer: "DEPLOYMENT_TARGET",
    domain: "hosting",
    area: "vercel",
    classification: "VERCEL",
    description: "Checks serverless function bundles do not exceed Vercel AWS Lambda 50MB zipped / 250MB uncompressed limit.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "COMPLETE",
    executionType: "FILESYSTEM",
    remediation: {
      "summary": "Reduce serverless function dependencies and bundle size below platform limits.",
      "guidance": "Vercel and AWS Lambda reject deployments exceeding 50MB zipped or 250MB uncompressed function size.",
      "steps": [
            "Exclude heavy devDependencies, optimize imports with webpack/esbuild, or move large static files to CDN."
      ],
      "autoFixable": false
},
    evidenceRequirements: ["build artifact function bundle size report"],
    tags: ["vercel","serverless","bundle-size","lambda"],
    aliases: ["target.hosting.vercel.bundle_size_limit","PLAT-VERC-001"],
    predicates: {
      "hosting": [
            "Vercel"
      ]
},
    expectedBehavior: "Serverless function bundles must remain comfortably within platform quota ceilings.",
    passCondition: "Individual serverless function bundles are within 50MB zipped / 250MB uncompressed limit.",
    failCondition: "Serverless output bundle exceeds maximum allowable platform size ceiling.",
    source: "Vercel Documentation (Limits - Serverless Function Size); AWS Lambda Quotas (PLAT-VERC-001)",
  },
  {
    id: "DEP-HOST-CF-001",
    name: "Cloudflare Workers edge runtime Node API compatibility",
    category: "CONFIGURATION",
    layer: "DEPLOYMENT_TARGET",
    domain: "hosting",
    area: "cloudflare",
    classification: "CLOUDFLARE",
    description: "Verifies wrangler.toml defines compatibility_flags = [\"nodejs_compat\"] when Node core modules are used.",
    severity: "CRITICAL",
    automationLevel: "AUTOMATIC",
    profileLevel: "MINIMUM",
    executionType: "CONFIG",
    remediation: {
      "summary": "Add compatibility_flags = [\"nodejs_compat\"] to wrangler.toml.",
      "guidance": "Cloudflare Workers edge V8 isolate throws module resolution errors if Node core libraries (crypto, buffer, events) are imported without compatibility flag.",
      "steps": [
            "Add compatibility_flags = [\"nodejs_compat\"] and compatibility_date = \"2024-01-01\" to wrangler.toml."
      ],
      "autoFixable": true
},
    evidenceRequirements: ["wrangler.toml compatibility_flags declaration"],
    tags: ["cloudflare","workers","edge","nodejs_compat","wrangler"],
    aliases: ["target.hosting.cloudflare.nodejs_compat","PLAT-CF-001"],
    predicates: {
      "hosting": [
            "Cloudflare"
      ]
},
    expectedBehavior: "Workers relying on Node built-ins must declare the nodejs_compat flag in wrangler configuration.",
    passCondition: "wrangler.toml contains compatibility_flags = [\"nodejs_compat\"] or worker code uses only standard web APIs.",
    failCondition: "Worker code references Node built-ins but wrangler.toml omits nodejs_compat flag.",
    source: "Cloudflare Workers Documentation (Node.js Compatibility) (PLAT-CF-001)",
  },
];
