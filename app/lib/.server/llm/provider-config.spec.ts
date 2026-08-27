import { describe, expect, it } from 'vitest';
import { resolveProviderConfigs } from './provider-config';

describe('resolveProviderConfigs', () => {
  it('should return an empty config when nothing is provided', () => {
    expect(resolveProviderConfigs(undefined)).toEqual({});
  });

  it('should keep entries that carry an apiKey', () => {
    expect(resolveProviderConfigs({ anthropic: { apiKey: 'k' } })).toEqual({ anthropic: { apiKey: 'k' } });
  });

  it('should keep entries that carry only a baseURL (compatible endpoint)', () => {
    expect(resolveProviderConfigs({ openai: { baseURL: 'http://localhost:11434/v1' } })).toEqual({
      openai: { baseURL: 'http://localhost:11434/v1' },
    });
  });

  it('should drop empty entries so they never register without credentials', () => {
    expect(resolveProviderConfigs({ google: {}, mistral: { apiKey: 'm' } })).toEqual({ mistral: { apiKey: 'm' } });
  });

  it('should preserve both apiKey and baseURL together', () => {
    expect(resolveProviderConfigs({ openai: { apiKey: 'k', baseURL: 'https://openrouter.ai/api/v1' } })).toEqual({
      openai: { apiKey: 'k', baseURL: 'https://openrouter.ai/api/v1' },
    });
  });
});
