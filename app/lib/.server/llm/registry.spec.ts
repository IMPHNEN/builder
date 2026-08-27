import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, getModel, parseModelString } from './registry';

// the v7 LanguageModel is a union; narrow to the concrete model shape for assertions
function modelIdOf(model: unknown): string {
  return (model as { modelId: string }).modelId;
}

function providerOf(model: unknown): string {
  return (model as { provider: string }).provider;
}

describe('parseModelString', () => {
  it('should default to the anthropic provider when none is given', () => {
    expect(parseModelString('claude-3-5-sonnet-20240620')).toEqual({
      provider: DEFAULT_PROVIDER,
      model: 'claude-3-5-sonnet-20240620',
    });
  });

  it('should split a provider:model string', () => {
    expect(parseModelString('anthropic:claude-3-opus-20240229')).toEqual({
      provider: 'anthropic',
      model: 'claude-3-opus-20240229',
    });
  });

  it('should only split on the first colon', () => {
    expect(parseModelString('openai:gpt-4o:extra')).toEqual({
      provider: 'openai',
      model: 'gpt-4o:extra',
    });
  });
});

describe('getModel', () => {
  const configs = { anthropic: { apiKey: 'test-key' } };

  it('should resolve the default model when no model string is provided', () => {
    const model = getModel(configs);

    expect(modelIdOf(model)).toBe(DEFAULT_MODEL);
    expect(providerOf(model)).toContain(DEFAULT_PROVIDER);
  });

  it('should resolve an explicit anthropic model', () => {
    const model = getModel(configs, 'anthropic:claude-3-opus-20240229');

    expect(modelIdOf(model)).toBe('claude-3-opus-20240229');
  });

  it('should throw for an unregistered provider', () => {
    expect(() => getModel(configs, 'openai:gpt-4o')).toThrowError();
  });

  it('should register a provider from a baseURL alone (OpenAI-compatible endpoint)', () => {
    const model = getModel({ openai: { baseURL: 'http://localhost:11434/v1' } }, 'openai:llama3.1');

    expect(modelIdOf(model)).toBe('llama3.1');
    expect(providerOf(model)).toContain('openai');
  });

  it('should resolve a free-form model name for a compatible provider', () => {
    const model = getModel(
      { anthropic: { apiKey: 'k', baseURL: 'https://proxy.example.com/v1' } },
      'anthropic:any-custom-model-name',
    );

    expect(modelIdOf(model)).toBe('any-custom-model-name');
  });

  it('should route real OpenAI through the Responses API', () => {
    const model = getModel({ openai: { apiKey: 'k' } }, 'openai:gpt-5');

    expect(providerOf(model)).toContain('responses');
  });

  it('should route OpenAI-compatible endpoints through the chat API', () => {
    const model = getModel({ openai: { baseURL: 'http://localhost:11434/v1' } }, 'openai:llama3.1');

    expect(providerOf(model)).toContain('chat');
  });
});
