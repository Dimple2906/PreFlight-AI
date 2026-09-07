import { AIProvider } from './providers/AIProvider.js';
import { MockAIProvider } from './providers/mock/MockAIProvider.js';
import { GeminiProvider } from './providers/gemini/GeminiProvider.js';

export function createAIProvider(type: 'mock' | 'gemini' = 'mock', apiKey?: string): AIProvider {
  if (type === 'gemini') {
    return new GeminiProvider(apiKey);
  }
  return new MockAIProvider();
}
