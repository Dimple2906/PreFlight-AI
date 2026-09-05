import { AIProvider } from './providers/AIProvider.js';
import { MockProvider } from './providers/MockProvider.js';
import { GeminiProvider } from './providers/GeminiProvider.js';

export function createAIProvider(type: 'mock' | 'gemini' = 'mock', apiKey?: string): AIProvider {
  if (type === 'gemini') {
    return new GeminiProvider(apiKey);
  }
  return new MockProvider();
}
