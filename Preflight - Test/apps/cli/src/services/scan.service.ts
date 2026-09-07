import path from 'node:path';
import { ProjectInspector } from '@preflight/discovery';
import { ProjectClassifier } from '@preflight/classifier';
import { ProjectProfile } from '@preflight/core';

export interface ScanResult {
  profile: ProjectProfile;
  vulnerabilityVectorsCount: number;
  recommendations: string[];
}

export class ScanAppService {
  public async run(projectPath: string): Promise<ScanResult> {
    const targetPath = path.resolve(projectPath);
    const inspector = new ProjectInspector();
    const discovered = await inspector.inspect(targetPath);
    const classifier = new ProjectClassifier();
    const profile = classifier.classify(discovered);

    return {
      profile,
      vulnerabilityVectorsCount: 0,
      recommendations: [
        'Ensure all API endpoints validate input parameters with Zod or equivalent schemas.',
        'Verify .env secrets are excluded from version control.'
      ]
    };
  }
}
