const fs = require('fs');
const path = require('path');
const os = require('os');
const { runDeployEngine, generateMarkdownReport } = require('../dist/deploy/engine.js');
const {
  sanitizeContext,
  buildAnalysisPrompt,
  parseAndValidateAIResponse,
  analyzeDeploymentFailure,
  analyzeFailuresBatch,
} = require('../dist/ai/gemini.js');
const { sanitizeForAI } = require('../dist/utils/sanitize.js');

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (!condition) {
    console.error('FAIL: ' + message);
    process.exitCode = 1;
  } else {
    passed++;
    console.log('PASS: ' + message);
  }
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-p6-test-'));

function createFixture(name, files) {
  const fixturePath = path.join(tempDir, name);
  fs.mkdirSync(fixturePath, { recursive: true });
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(fixturePath, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
  return fixturePath;
}

async function runPhase6Tests() {
  console.log('================================================================================');
  console.log('      Running PreFlight AI - Phase 6 Gemini AI Integration Test Suite          ');
  console.log('================================================================================\n');

  // ==========================================================================================
  // TEST 1: Deterministic Engine Invariant with Gemini Disabled or Missing Key
  // ==========================================================================================
  console.log('--- TEST 1: Missing/Disabled Gemini Key Safety & Invariance ---');
  const t1Path = createFixture('t1-no-key', {
    'package.json': JSON.stringify({ name: 'test-app', version: '1.0.0' }),
    'package-lock.json': '{}',
    '.env': 'PORT=3000\nDATABASE_URL=postgres://user:pass@localhost:5432/db\n',
  });

  const originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const report1 = await runDeployEngine(t1Path, { skipBuildCommand: true, enableAiAnalysis: true });

  assert(report1.status === 'SUCCESS', 'Test 1.1: Engine completes execution successfully without API key');
  assert(report1.aiAnalysis !== undefined, 'Test 1.2: Engine report includes aiAnalysis field');
  assert(report1.aiAnalysis.status === 'UNAVAILABLE', 'Test 1.3: aiAnalysis status is UNAVAILABLE');
  assert(report1.aiAnalysis.analyzedChecksCount === 0, 'Test 1.4: Zero checks analyzed when API key absent');
  assert(typeof report1.summary.deploymentReady === 'boolean', 'Test 1.5: Deterministic deploymentReady is preserved');
  assert(Array.isArray(report1.summary.blockers), 'Test 1.6: Blockers list is preserved deterministically');

  // ==========================================================================================
  // TEST 2: Secret & Credential Pre-flight Sanitization
  // ==========================================================================================
  console.log('\n--- TEST 2: Pre-flight AI Context Secret Sanitization ---');
  const dummyStripeLive = ['sk', 'live', '51Abcdefghijklmnopqrstuvwxyz'].join('_');
  const dummyGithubPat = ['ghp', '1234567890abcdefghijklmnopqrstuvwxyz'].join('_');
  const dummyJwt = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0', 'sflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'].join('.');

  const sensitiveContext = {
    checkId: 'DEP-ENV-002',
    checkName: 'No Committed Secrets',
    severity: 'CRITICAL',
    status: 'FAIL',
    message: `Found Stripe secret key ${dummyStripeLive} and GitHub token ${dummyGithubPat} in repo`,
    evidence: [
      `STRIPE_KEY=${dummyStripeLive}`,
      `GITHUB_PAT=${dummyGithubPat}`,
      'AUTH_SECRET=password123456789',
      `BEARER_TOKEN=Bearer ${dummyJwt}`,
    ],
    remediation: {
      summary: 'Remove secret immediately',
      guidance: 'Revoke key at stripe.com with secret sk_live_99999',
      steps: ['Revoke key'],
    },
    framework: 'Next.js',
    projectType: 'web',
  };

  const sanitized = sanitizeContext(sensitiveContext);
  const prompt = buildAnalysisPrompt(sanitized);

  assert(!sanitized.message.includes('sk_live_51Abcdef'), 'Test 2.1: Stripe key redacted from message');
  assert(!sanitized.message.includes('ghp_12345678'), 'Test 2.2: GitHub PAT redacted from message');
  assert(!prompt.includes('sk_live_51Abcdef'), 'Test 2.3: Stripe key absent from final prompt');
  assert(!prompt.includes('ghp_12345678'), 'Test 2.4: GitHub PAT absent from final prompt');
  assert(!prompt.includes('password123456789'), 'Test 2.5: Plaintext password redacted');
  assert(!prompt.includes('eyJhbGciOiJIUzI1NiIsInR5cCI'), 'Test 2.6: JWT token redacted');
  assert(sanitized.checkId === 'DEP-ENV-002', 'Test 2.7: Check ID and metadata preserved intact');
  assert(sanitized.severity === 'CRITICAL', 'Test 2.8: Check severity preserved intact');

  const dummyStripeTest = ['sk', 'test', '51Abc123'].join('_');
  const rawSecretString = `API_KEY=${dummyStripeTest}\nAWS_SECRET=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`;
  const cleanedSecretString = sanitizeForAI(rawSecretString);
  assert(!cleanedSecretString.includes('sk_test_51Abc123'), 'Test 2.9: sanitizeForAI redacts API keys');
  assert(cleanedSecretString.includes('[REDACTED]'), 'Test 2.10: sanitizeForAI replaces with [REDACTED]');

  // ==========================================================================================
  // TEST 3: Structured AI Response Parsing & Validation
  // ==========================================================================================
  console.log('\n--- TEST 3: Structured AI Response Parsing & Resilient Extraction ---');

  const validJson = JSON.stringify({
    checkId: 'DEP-GIT-001',
    rootCause: 'Uncommitted working tree changes detected before deployment.',
    risk: 'Deploying uncommitted code leads to unreproducible artifacts.',
    explanation: 'Git working tree status reports modified files not staged or committed.',
    remediation: ['git status', 'git commit -m "Deploy commit"', 'git push'],
    confidence: 0.95,
  });
  const parsedA = parseAndValidateAIResponse('DEP-GIT-001', validJson);
  assert(parsedA !== null, 'Test 3.1: Successfully parses valid JSON response');
  assert(parsedA.rootCause.includes('Uncommitted working tree'), 'Test 3.2: Extracts root cause correctly');
  assert(parsedA.confidence === 0.95, 'Test 3.3: Extracts confidence correctly');
  assert(Array.isArray(parsedA.remediation) && parsedA.remediation.length === 3, 'Test 3.4: Remediation array parsed');

  const markdownWrapped = '```json\n' + validJson + '\n```';
  const parsedB = parseAndValidateAIResponse('DEP-GIT-001', markdownWrapped);
  assert(parsedB !== null, 'Test 3.5: Successfully extracts JSON inside markdown code blocks');
  assert(parsedB.rootCause === parsedA.rootCause, 'Test 3.6: Extracted content identical to bare JSON');

  const malformedText = 'I am an AI assistant and I think you should just deploy anyway! Everything looks fine.';
  const parsedC = parseAndValidateAIResponse('DEP-GIT-001', malformedText);
  assert(parsedC === null, 'Test 3.7: Gracefully handles malformed non-JSON without throwing');

  const incompleteJson = JSON.stringify({
    checkId: 'DEP-GIT-001',
    explanation: 'Only explanation provided',
  });
  const parsedD = parseAndValidateAIResponse('DEP-GIT-001', incompleteJson);
  assert(parsedD === null, 'Test 3.8: Rejects JSON lacking required rootCause/risk/remediation fields');

  // ==========================================================================================
  // TEST 4: Batch Prioritization & Error Containment
  // ==========================================================================================
  console.log('\n--- TEST 4: Batch Prioritization (CRITICAL/HIGH first, max 5) ---');
  const dummyContexts = [
    { checkId: 'INFO-1', checkName: 'Info Check', severity: 'INFO', status: 'WARN', message: 'info' },
    { checkId: 'CRIT-1', checkName: 'Crit 1', severity: 'CRITICAL', status: 'FAIL', message: 'crit 1' },
    { checkId: 'LOW-1', checkName: 'Low 1', severity: 'LOW', status: 'WARN', message: 'low 1' },
    { checkId: 'HIGH-1', checkName: 'High 1', severity: 'HIGH', status: 'FAIL', message: 'high 1' },
    { checkId: 'CRIT-2', checkName: 'Crit 2', severity: 'CRITICAL', status: 'FAIL', message: 'crit 2' },
    { checkId: 'MED-1', checkName: 'Med 1', severity: 'MEDIUM', status: 'WARN', message: 'med 1' },
    { checkId: 'HIGH-2', checkName: 'High 2', severity: 'HIGH', status: 'FAIL', message: 'high 2' },
  ];

  const batchReport = await analyzeFailuresBatch(dummyContexts, { apiKey: undefined });
  assert(batchReport.status === 'UNAVAILABLE', 'Test 4.1: Batch returns UNAVAILABLE when API key is missing');
  assert(batchReport.analyzedChecksCount === 0, 'Test 4.2: Analyzed count is 0');
  assert(Object.keys(batchReport.analyses).length === 0, 'Test 4.3: Analyses map is empty');

  const invalidKeyReport = await analyzeFailuresBatch(dummyContexts.slice(0, 1), {
    apiKey: 'AIzaSy_fake_invalid_key_for_testing_purposes',
    timeoutMs: 1500,
  });
  assert(invalidKeyReport.status === 'ERROR', 'Test 4.4: Network/API error returns ERROR status safely');
  assert(typeof invalidKeyReport.error === 'string', 'Test 4.5: Error message captured gracefully');
  assert(Object.keys(invalidKeyReport.analyses).length === 0, 'Test 4.6: No crashes or partial corruption');

  // ==========================================================================================
  // TEST 5: Engine Integration & Report Output Verification
  // ==========================================================================================
  console.log('\n--- TEST 5: Engine Integration & Report Output Verification ---');
  const t5Path = createFixture('t5-engine-ai', {
    'package.json': JSON.stringify({ name: 'ai-demo-app', version: '1.0.0', scripts: { build: 'tsc' } }),
    'package-lock.json': '{}',
  });

  const engineReport = await runDeployEngine(t5Path, { skipBuildCommand: true, enableAiAnalysis: true });

  assert(engineReport.aiAnalysis !== undefined, 'Test 5.1: EngineReport contains aiAnalysis');
  assert(
    ['AVAILABLE', 'UNAVAILABLE', 'SKIPPED', 'ERROR'].includes(engineReport.aiAnalysis.status),
    'Test 5.2: aiAnalysis status is standard enum'
  );

  const mdReport = generateMarkdownReport(engineReport);
  assert(mdReport.includes('## AI Assessment (Gemini)'), 'Test 5.3: Markdown report contains AI Assessment section');
  assert(
    mdReport.includes('Purely observational root cause analysis') || mdReport.includes('Status:** UNAVAILABLE'),
    'Test 5.4: Markdown report contains safety guarantee and status'
  );

  const mockCheckResult = {
    checkId: 'DEP-ENV-001',
    name: 'Environment Manifest',
    status: 'FAIL',
    severity: 'HIGH',
    message: 'Missing .env.example manifest',
    aiAnalysis: {
      checkId: 'DEP-ENV-001',
      rootCause: 'No environment template committed to repository.',
      risk: 'Operators cannot know required runtime environment variables.',
      explanation: 'Production runtime requires 4 variables that are undocumented.',
      remediation: ['Create .env.example with dummy values'],
      confidence: 0.9,
    },
  };
  const mockEngineReport = {
    ...engineReport,
    checks: [mockCheckResult],
    aiAnalysis: {
      status: 'AVAILABLE',
      analyzedChecksCount: 1,
      analyses: {
        'DEP-ENV-001': mockCheckResult.aiAnalysis,
      },
    },
  };
  const mdWithAI = generateMarkdownReport(mockEngineReport);
  assert(mdWithAI.includes('AI Root Cause Analysis (Gemini)'), 'Test 5.5: Markdown includes check-level AI section');
  assert(mdWithAI.includes('No environment template committed'), 'Test 5.6: Markdown includes AI root cause');
  assert(mdWithAI.includes('Operators cannot know required'), 'Test 5.7: Markdown includes AI risk explanation');

  if (originalKey) {
    process.env.GEMINI_API_KEY = originalKey;
  }

  console.log('\n================================================================================');
  console.log(`Phase 6 Test Results: ${passed} / ${total} passed`);
  console.log('================================================================================');

  if (passed !== total) {
    console.error(`FAILED: ${total - passed} assertion(s) failed.`);
    process.exit(1);
  }
}

runPhase6Tests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
