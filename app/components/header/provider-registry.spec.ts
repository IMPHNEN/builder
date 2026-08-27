import { describe, expect, it } from 'vitest';
import { modelOfModel, parseModelResponse, PROVIDERS, providerOfModel } from './provider-registry';

describe('provider registry UI catalog', () => {
  it('should expose native and compatibility protocol choices', () => {
    expect(PROVIDERS.map((provider) => provider.name)).toEqual([
      'anthropic',
      'claude-compatible',
      'openai',
      'openai-compatible',
      'google',
      'mistral',
    ]);
  });

  it('should split provider and model from the persisted selection', () => {
    expect(providerOfModel('openai-compatible:llama3.1')).toBe('openai-compatible');
    expect(modelOfModel('openai-compatible:llama3.1')).toBe('llama3.1');
  });

  it('should keep only non-empty model ids from discovery responses', () => {
    expect(parseModelResponse({ models: ['llama3.1', '', 42, 'qwen2.5'] })).toEqual(['llama3.1', 'qwen2.5']);
    expect(parseModelResponse({ models: 'invalid' })).toEqual([]);
  });
});
