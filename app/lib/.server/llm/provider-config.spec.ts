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

  it('should keep GitHub credentials out of LLM request configuration', () => {
    expect(
      resolveProviderConfigs({
        anthropic: { apiKey: 'anthropic-key' },
        github: { apiKey: 'oauth-token' },
      }),
    ).toEqual({ anthropic: { apiKey: 'anthropic-key' } });
  });

  it('should preserve explicit compatibility provider configurations', () => {
    expect(
      resolveProviderConfigs({
        'openai-compatible': { apiKey: 'openai-key', baseURL: 'https://api.example.com/v1' },
        'claude-compatible': { apiKey: 'claude-key', baseURL: 'https://claude.example.com/v1' },
      }),
    ).toEqual({
      'openai-compatible': { apiKey: 'openai-key', baseURL: 'https://api.example.com/v1' },
      'claude-compatible': { apiKey: 'claude-key', baseURL: 'https://claude.example.com/v1' },
    });
  });

  it('should treat cleared fields as absent while preserving the provider key', () => {
    expect(resolveProviderConfigs({ anthropic: { apiKey: 'k', baseURL: '' } })).toEqual({ anthropic: { apiKey: 'k' } });
  });

  it('should reject malformed provider entries instead of forwarding them', () => {
    expect(resolveProviderConfigs({ openai: { apiKey: 42 } })).toEqual({});
  });
});
