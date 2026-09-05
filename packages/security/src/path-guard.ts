import path from 'path';
import { SecurityError } from './execution-guard.js';

export class PathSecurityGuard {
  /**
   * Validate that a target filepath remains strictly contained within root directory
   */
  public static validatePath(targetPath: string, rootPath: string): string {
    if (!targetPath || !rootPath) {
      throw new SecurityError('Invalid path evaluation parameters.');
    }

    const absoluteRoot = path.resolve(rootPath);
    const absoluteTarget = path.resolve(rootPath, targetPath);

    // Normalize Windows drive letter case differences
    const rootNorm = absoluteRoot.toLowerCase();
    const targetNorm = absoluteTarget.toLowerCase();

    const isInsideRoot = targetNorm === rootNorm || targetNorm.startsWith(rootNorm + path.sep);

    if (!isInsideRoot) {
      throw new SecurityError(`Path traversal blocked: '${targetPath}' escapes root directory '${rootPath}'.`);
    }

    return absoluteTarget;
  }
}
