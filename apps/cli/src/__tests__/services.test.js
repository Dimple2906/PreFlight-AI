import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { TestAppService, DeployAppService, DoctorAppService } from '../services/index.js';
describe('CLI Application Services', () => {
    const examplePath = path.resolve(process.cwd(), 'examples/vulnerable-shop');
    it('should execute DoctorAppService diagnostics', async () => {
        const service = new DoctorAppService();
        const results = await service.run();
        expect(results.length).toBeGreaterThanOrEqual(2);
        expect(results[0].check).toBe('Node.js Runtime Environment');
        expect(results[0].passed).toBe(true);
    });
    it('should run TestAppService on example target project', async () => {
        const service = new TestAppService();
        const report = await service.run({
            projectPath: examplePath,
            enableAi: false
        });
        expect(report.mode).toBe('test');
        expect(report.results.length).toBeGreaterThan(0);
        expect(report.overallStatus).toBeDefined();
    }, 15000);
    it('should run DeployAppService on example target project', async () => {
        const service = new DeployAppService();
        const report = await service.run({
            projectPath: examplePath,
            enableAi: false
        });
        expect(report.mode).toBe('deploy');
        expect(report.results.length).toBeGreaterThan(0);
    }, 15000);
});
//# sourceMappingURL=services.test.js.map