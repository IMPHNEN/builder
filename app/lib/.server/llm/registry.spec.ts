import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, getModel, parseModelString } from './registry';

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
  const keys = { anthropic: 'test-key' };

  it('should resolve the default model when no model string is provided', () => {
    const model = getModel(keys);

    expect(model.modelId).toBe(DEFAULT_MODEL);
    expect(model.provider).toContain(DEFAULT_PROVIDER);
  });

  it('should resolve an explicit anthropic model', () => {
    const model = getModel(keys, 'anthropic:claude-3-opus-20240229');

    expect(model.modelId).toBe('claude-3-opus-20240229');
  });

  it('should throw for an unregistered provider', () => {
    expect(() => getModel(keys, 'openai:gpt-4o')).toThrowError();
  });
});
