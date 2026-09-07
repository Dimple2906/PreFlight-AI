import Fastify from 'fastify';
import { ProjectInspector } from '@preflight/discovery';
import { ProjectClassifier } from '@preflight/classifier';
import { QAEngine } from '@preflight/qa-engine';
import { DeployEngine } from '@preflight/deploy-engine';
import { AIEngine } from '@preflight/ai-engine';
import { SecretSanitizer } from '@preflight/security';
import { FinalReport } from '@preflight/core';

export async function createServer() {
  const server = Fastify({ logger: true });

  server.get('/health', async () => {
    return { status: 'ok', service: 'preflight-server', timestamp: new Date().toISOString() };
  });

  server.post<{ Body: { projectPath: string; enableAi?: boolean } }>('/api/v1/test', async (req, reply) => {
    const { projectPath, enableAi = true } = req.body || {};
    if (!projectPath) {
      return reply.status(400).send({ error: 'projectPath is required' });
    }

    try {
      const inspector = new ProjectInspector();
      const discovered = await inspector.inspect(projectPath);
      const classifier = new ProjectClassifier();
      const profile = classifier.classify(discovered);

      const sanitizer = new SecretSanitizer();
      const qaEngine = new QAEngine(sanitizer);

      const result = await qaEngine.executeTest({
        id: 'api-test-suite',
        name: 'Remote Invariant Test Suite',
        description: 'Server triggered test execution',
        category: 'unit',
        command: 'npm test',
        timeoutMs: 30000,
        environment: {}
      }, profile);

      let aiAnalysis;
      if (enableAi) {
        const aiEngine = new AIEngine({ provider: 'mock' });
        const analysis = await aiEngine.analyzeEvidence(profile, [result]);
        aiAnalysis = {
          summary: analysis.summary,
          rootCauseAnalyses: analysis.rootCauseAnalyses.map(r => ({
            resultId: r.resultId,
            possibleRootCause: r.possibleRootCause,
            confidence: r.confidence,
            suggestedFix: r.suggestedFix
          })),
          coverageGaps: analysis.coverageGaps.map(cg => ({
            id: cg.id,
            area: cg.area,
            description: cg.description,
            severity: cg.severity,
            recommendedAction: cg.recommendedAction,
            suggestedCapabilityId: cg.suggestedCapabilityId
          })),
          additionalCheckRecommendations: (analysis.remediationRecommendations || []).map((rec, idx) => ({
            id: `rec-${idx + 1}`,
            name: rec.area,
            reason: rec.action,
            command: undefined
          })),
          sanitizedTokensCount: 100,
          analyzedAt: new Date().toISOString()
        };
      }

      const report: FinalReport = {
        reportId: `srv-test-${Date.now()}`,
        mode: 'test',
        overallStatus: result.status,
        projectProfile: profile,
        results: [result],
        stats: {
          total: 1,
          passed: result.status === 'PASS' ? 1 : 0,
          failed: result.status === 'FAIL' ? 1 : 0,
          warned: result.status === 'WARN' ? 1 : 0,
          skipped: result.status === 'SKIP' ? 1 : 0,
          errored: result.status === 'ERROR' ? 1 : 0,
          durationMs: result.durationMs
        },
        aiAnalysis,
        generatedAt: new Date().toISOString()
      };

      return reply.send(report);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  return server;
}

if (process.env.NODE_ENV !== 'test' && import.meta.url === `file://${process.argv[1]}`) {
  const app = await createServer();
  const PORT = Number(process.env.PORT) || 3000;
  app.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
    if (err) {
      app.log.error(err);
      process.exit(1);
    }
    app.log.info(`PreFlight Orchestration Server listening at ${address}`);
  });
}
