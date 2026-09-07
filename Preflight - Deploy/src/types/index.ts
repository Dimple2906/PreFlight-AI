/**
 * Confidence rating for detections.
 * - DETECTED: Hard, incontrovertible evidence found (e.g. key dependency AND config file / schema).
 * - LIKELY: Moderate evidence found (e.g. dependency present without config, or config pattern match).
 * - UNKNOWN: No sufficient evidence found.
 */
export type Confidence = 'DETECTED' | 'LIKELY' | 'UNKNOWN';

export interface Evidence {
  source: string;
  detail: string;
}

export interface ProjectIdentity {
  name: string;
  rootPath: string;
  hasPackageJson: boolean;
  isValidProject: boolean;
  isMonorepoRoot: boolean;
  childProjectRoots: string[];
}

export type PackageManagerName = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown';

export interface PackageManagerDetection {
  packageManager: PackageManagerName;
  confidence: Confidence;
  lockfile?: string;
  evidence: string[];
  conflicts?: string[];
}

export type SupportedLanguage = 'TypeScript' | 'JavaScript';

export interface LanguageItem {
  language: SupportedLanguage;
  confidence: Confidence;
  evidence: string[];
}

export interface LanguageDetection {
  primary: SupportedLanguage | 'unknown';
  languages: LanguageItem[];
}

export type SupportedFramework =
  | 'Next.js'
  | 'Express'
  | 'React'
  | 'NestJS'
  | 'Fastify'
  | 'Remix'
  | 'Vite'
  | 'Nuxt'
  | 'Unknown';

export interface FrameworkItem {
  name: SupportedFramework;
  confidence: Confidence;
  version?: string;
  evidence: string[];
}

export interface FrameworkDetection {
  frameworks: FrameworkItem[];
}

export type SupportedDatabase =
  | 'Prisma'
  | 'PostgreSQL'
  | 'MongoDB'
  | 'Mongoose'
  | 'SQLite'
  | 'Redis'
  | 'MySQL'
  | 'None';

export type DatabaseRole = 'ORM' | 'Database engine' | 'Database driver' | 'Cache' | 'Unknown';

export interface DatabaseItem {
  name: SupportedDatabase;
  role?: DatabaseRole;
  confidence: Confidence;
  evidence: string[];
}

export interface DatabaseDetection {
  databases: DatabaseItem[];
}

export type SupportedRuntime = 'Node.js' | 'Bun' | 'Deno' | 'Unknown';

export interface RuntimeDetection {
  name: SupportedRuntime;
  version: string;
  packageManagerRequirement?: string;
  evidence: string[];
}

export type SupportedHosting =
  | 'Vercel'
  | 'Netlify'
  | 'Docker'
  | 'Railway'
  | 'Render'
  | 'Fly.io'
  | 'AWS'
  | 'Unknown';

export interface HostingItem {
  name: SupportedHosting;
  confidence: Confidence;
  configFile?: string;
  evidence: string[];
}

export interface HostingDetection {
  hosting: HostingItem[];
}

export type ProjectType =
  | 'web application'
  | 'API/backend'
  | 'CLI'
  | 'library'
  | 'worker'
  | 'static frontend'
  | 'unknown';

export interface ProjectTypeDetection {
  primaryType: ProjectType;
  secondaryTypes: ProjectType[];
  confidence: Confidence;
  evidence: string[];
}

/**
 * Single indexed file entry in the repository facts index.
 */
export interface IndexedFile {
  relativePath: string; // e.g. "packages/api/src/server.ts"
  fileName: string;     // e.g. "server.ts"
  extension: string;    // e.g. ".ts"
  sizeBytes: number;
}

/**
 * Bounded repository filesystem facts collected in a single traversal pass.
 */
export interface RepositoryFacts {
  rootPath: string;
  files: IndexedFile[];
  directories: string[]; // relative directory paths
  packageJsonPaths: string[]; // all discovered package.json relative paths
  fileMap: Map<string, IndexedFile>; // relativePath -> IndexedFile
  contentCache: Map<string, string>; // cached text file contents for read configuration files
  stats: {
    totalDirectoriesVisited: number;
    totalFilesIndexed: number;
    traversalTimeMs: number;
    filesReadCount: number;
  };
}

/**
 * Shared facts scoped to a specific project root (root or sub-project).
 */
export interface ProjectFacts {
  projectRoot: string; // absolute path
  relativePrefix: string; // e.g. "" or "packages/api"
  repositoryFacts: RepositoryFacts;
  // Local file subset helper methods/properties
  localFiles: IndexedFile[];
  localDirectories: string[];
}

/**
 * Full discovery summary for a specific unit/sub-project.
 */
export interface ProjectProfile {
  identity: ProjectIdentity;
  packageManager: PackageManagerDetection;
  languages: LanguageDetection;
  frameworks: FrameworkDetection;
  databases: DatabaseDetection;
  runtime: RuntimeDetection;
  hosting: HostingDetection;
  projectType: ProjectTypeDetection;
  rawEvidence: string[];
}

/**
 * Top-level discovery result spanning root and any discovered child applications.
 */
export interface DiscoveryResult {
  rootProject: ProjectProfile;
  subProjects: ProjectProfile[];
  summary: {
    totalApplications: number;
    isMonorepo: boolean;
    analysisTimestamp: string;
    traversalStats?: {
      totalDirectoriesVisited: number;
      totalFilesIndexed: number;
      traversalTimeMs: number;
      filesReadCount: number;
    };
  };
}

export type AutomationLevel = 'AUTOMATIC' | 'PARTIALLY_AUTOMATIC' | 'MANUAL';

export type CheckSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type DeploymentLayer =

  | 'UNIVERSAL'
  | 'PROJECT_TYPE'
  | 'TECHNOLOGY'
  | 'DEPLOYMENT_TARGET'
  | 'INFRASTRUCTURE';

export type CheckDomain =
  | 'universal'
  | 'git'
  | 'environment'
  | 'dependencies'
  | 'runtime'
  | 'build'
  | 'web'
  | 'api'
  | 'cli'
  | 'worker'
  | 'library'
  | 'static'
  | 'desktop'
  | 'framework'
  | 'database'
  | 'orm'
  | 'cache'
  | 'package-manager'
  | 'hosting'
  | 'infrastructure'
  | 'monorepo'
  | 'security'
  | 'seo';

export type CheckCategory =
  | 'ENVIRONMENT'
  | 'GIT'
  | 'DEPENDENCIES'
  | 'RUNTIME'
  | 'BUILD'
  | 'DATABASE'
  | 'HOSTING'
  | 'SECURITY'
  | 'SEO'
  | 'PROJECT_TYPE'
  | 'DESKTOP'
  | 'CI_CD'
  | 'MONOREPO'
  | 'FILESYSTEM'
  | 'CONFIGURATION';

export type ExecutionType =
  | 'STATIC'
  | 'FILESYSTEM'
  | 'AST'
  | 'CONFIG'
  | 'COMMAND'
  | 'NETWORK'
  | 'MANUAL';

export interface CheckRemediation {
  summary: string;
  guidance?: string;
  steps?: string[];
  autoFixable?: boolean;
}

export interface CheckExecutionContext {
  project: ProjectProfile;
  deploymentProfile: UnitDeploymentProfile;
  facts?: ProjectFacts;
  repositoryRoot?: string;
}

export type CheckStatus = 'PASS' | 'FAIL' | 'WARN' | 'SKIP' | 'SKIPPED' | 'ERROR' | 'UNKNOWN';

export interface CheckResult {
  checkId: string;
  status: CheckStatus;
  severity: CheckSeverity;
  name: string;
  category?: string;
  automationLevel?: AutomationLevel;
  message: string;
  evidence?: string[];
  duration?: number;
  executionType?: ExecutionType;
  failure?: {
    errorName: string;
    why: string;
    file?: string;
    expected?: string;
    actual?: string;
    mismatch?: string;
  };
  subProjectName?: string;
  subProjectRoot?: string;
  remediation?: CheckRemediation;
  aiAnalysis?: AIAnalysis;
}





export interface DeploymentExecutionSummary {
  total: number;
  passed: number;
  failed: number;
  warnings: number;
  skipped: number;
  errors: number;
  criticalFailures: number;
  durationMs: number;
  timestamp: string;
}

export interface DeploymentExecutionReport {
  rootPath: string;
  projectName: string;
  summary: DeploymentExecutionSummary;
  results: CheckResult[];
}

export interface CheckPredicates {
  projectTypes?: string[];
  frameworks?: string[];
  databases?: string[];
  runtimes?: string[];
  hosting?: string[];
  packageManagers?: string[];
  languages?: string[];

  requiresMonorepo?: boolean;
  requiresCi?: boolean;
}

/**
 * Metadata definition for a deployment check in the registry.
 */
export interface CheckDefinition {
  id: string;
  name: string;
  category?: CheckCategory;
  layer: DeploymentLayer;
  domain: CheckDomain;
  area: string;
  classification: string;
  description: string;
  severity: CheckSeverity;
  automationLevel: AutomationLevel;
  profileLevel: 'MINIMUM' | 'COMPLETE';
  executionType?: ExecutionType;
  remediation?: CheckRemediation;
  evidenceRequirements?: string[];
  tags?: string[];
  dedupKey?: string;
  aliases?: string[];
  predicates?: CheckPredicates;
  dependencies?: string[]; // check IDs that must be satisfied or components required
  applicabilityReason?: string;
  expectedBehavior?: string;
  passCondition?: string;
  failCondition?: string;
  warningCondition?: string;
  source?: string;
}

/**
 * Applicability evaluation result for a check in a project context.
 */
export interface ApplicableCheck {
  check: CheckDefinition;
  applicable: boolean;
  reason: string;
  matchedTechnologies: string[];
  evidence: string[];
  sourceCheckIds?: string[];
}

/**
 * Group of checks organized by layer or domain.
 */
export interface CheckGroup {
  id: string;
  name: string;
  layer: DeploymentLayer;
  domain: CheckDomain;
  checks: ApplicableCheck[];
}

export type DeploymentTargetStatus = 'SINGLE_TARGET' | 'MULTI_TARGET' | 'CONDITIONAL' | 'UNKNOWN';

export interface DeploymentTargetProfile {
  name: string;
  status: DeploymentTargetStatus;
  confidence: Confidence;
  evidence: string[];
  applicableChecks: CheckDefinition[];
}

export interface DomainApplicabilityDetail {
  domain: string;
  subTechnology: string;
  applicable: boolean;
  reason: string;
  evidence: string[];
}

/**
 * Scoped Deployment Profile for a specific project/sub-project.
 */
export interface UnitDeploymentProfile {
  projectName: string;
  projectRoot: string;
  isRoot: boolean;
  project?: ProjectProfile;
  applicableDomains: string[];
  inapplicableDomains: string[];
  domainDetails?: DomainApplicabilityDetail[];
  targetStatus: DeploymentTargetStatus;
  deploymentTargets: DeploymentTargetProfile[];
  minimumChecks: CheckDefinition[];
  completeChecks: CheckDefinition[];
  groups: CheckGroup[];
  summary: {
    totalApplicableChecks: number;
    minimumCheckCount: number;
    completeCheckCount: number;
    automaticCount: number;
    partiallyAutomaticCount: number;
    manualCount: number;
    bySeverity: Record<CheckSeverity, number>;
  };
}

/**
 * Top-level Repository Deployment Profile.
 */
export interface RepositoryDeploymentProfile {
  rootProfile: UnitDeploymentProfile;
  subProjectProfiles: UnitDeploymentProfile[];
  summary: {
    totalApplications: number;
    isMonorepo: boolean;
    totalUniqueChecks: number;
    timestamp: string;
  };
}

/**
 * Reason category for why a check was rejected from the deployment readiness registry.
 */
export type RejectedCheckReason =
  | 'OUT_OF_SCOPE_UNIT_TEST'
  | 'OUT_OF_SCOPE_LINTING'
  | 'OUT_OF_SCOPE_REMOTE_NETWORK'
  | 'OUT_OF_SCOPE_FEATURE_TEST'
  | 'OUT_OF_SCOPE_MARKETING_SEO';

/**
 * Declarative record of a candidate check evaluated from research/knowledge bases
 * that was explicitly rejected from the deployment check registry.
 */
export interface RejectedCheckDefinition {
  id: string;
  name: string;
  source: string;
  reason: RejectedCheckReason;
  rationale: string;
  originalCategory?: string;
  recommendedLayer?: string;
}

/**
 * Options for the top-level Phase 5 deployment engine.
 */
export interface DeployEngineOptions {
  timeoutMs?: number;
  buildTimeoutMs?: number;
  skipBuildCommand?: boolean;
  includeSkippedInResults?: boolean;
  enableAiAnalysis?: boolean;
  aiApiKey?: string;
  // Adaptive testing options
  enableAdaptive?: boolean;
  maxAdaptiveRounds?: number;
  maxAdditionalChecks?: number;
  maxRecommendationsPerRound?: number;


}

/**
 * Root-cause and remediation analysis generated by Gemini.
 */
export interface AIAnalysis {
  checkId: string;
  rootCause: string;
  risk: string;
  explanation: string;
  remediation: string[];
  confidence?: number;
}

/**
 * Context provided to Gemini for analyzing a failure.
 */
export interface AIAnalysisContext {
  checkId: string;
  checkName: string;
  severity: CheckSeverity;
  status: CheckStatus;
  message: string;
  evidence?: string[];
  remediation?: CheckRemediation;
  projectType?: string;
  framework?: string;
  runtime?: string;
  hosting?: string;
  subProjectName?: string;
}

/**
 * Overall AI analysis section in the EngineReport.
 */
export interface EngineAIReport {
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'SKIPPED' | 'ERROR';
  model?: string;
  analyzedChecksCount: number;
  analyses: Record<string, AIAnalysis>;
  error?: string;
}

/**
 * Overall deployment summary with severity breakdown and readiness determination.
 */
export interface DeploymentSummary {
  total: number;
  passed: number;
  failed: number;
  warnings: number;
  skipped: number;
  errors: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  deploymentReady: boolean;
  blockers: string[];
}

/**
 * Comprehensive engine report produced by runDeployEngine.
 */
export interface EngineReport {
  rootPath: string;
  discovery: DiscoveryResult;
  classification: RepositoryDeploymentProfile;
  deploymentProfile: UnitDeploymentProfile | RepositoryDeploymentProfile;
  checks: CheckResult[];
  summary: DeploymentSummary;
  aiAnalysis?: EngineAIReport;
  durationMs: number;
  generatedAt: string;
  status: 'SUCCESS' | 'ERROR';
  error?: string;
}


