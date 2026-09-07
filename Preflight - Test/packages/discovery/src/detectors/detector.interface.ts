import { Framework, DetectionEvidence } from '@preflight/core';
import { DiscoveredProjectFiles } from '../inspector.js';

export interface DetectionResult {
  framework: Framework;
  evidence: DetectionEvidence;
}

export interface FrameworkDetector {
  readonly name: string;
  readonly framework: Framework;
  detect(discovered: DiscoveredProjectFiles, rootPath: string, dependencies: Record<string, string>): Promise<DetectionResult | null>;
}
