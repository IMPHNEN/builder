import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL_LIMITS, getModelLimits, MODEL_LIMITS } from './constants';

describe('getModelLimits', () => {
  it('should return the default limits when no model is given', () => {
    expect(getModelLimits(undefined)).toEqual(DEFAULT_MODEL_LIMITS);
  });

  it('should return model-specific limits for a known model', () => {
    expect(getModelLimits('openai:gpt-4o')).toEqual(MODEL_LIMITS['openai:gpt-4o']);
  });

  it('should fall back to defaults for an unknown model', () => {
    expect(getModelLimits('openai:some-custom-model')).toEqual(DEFAULT_MODEL_LIMITS);
  });

  it('should fall back to defaults for a model without a provider prefix', () => {
    expect(getModelLimits('gpt-4o')).toEqual(DEFAULT_MODEL_LIMITS);
  });
});
