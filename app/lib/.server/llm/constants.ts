// see https://docs.anthropic.com/en/docs/about-claude/models
export const MAX_TOKENS = 8192;

// limits the number of model responses that can be returned in a single request
export const MAX_RESPONSE_SEGMENTS = 2;

export interface ModelLimits {
  maxTokens: number;
  maxResponseSegments: number;
}

export const DEFAULT_MODEL_LIMITS: ModelLimits = {
  maxTokens: MAX_TOKENS,
  maxResponseSegments: MAX_RESPONSE_SEGMENTS,
};

/**
 * Per-model output limits keyed by `provider:model`. Models not listed fall back
 * to `DEFAULT_MODEL_LIMITS`. Kept deliberately small — these are continuation
 * budgets, not the models' full context windows.
 */
export const MODEL_LIMITS: Record<string, ModelLimits> = {
  'anthropic:claude-3-5-sonnet-20240620': { maxTokens: 8192, maxResponseSegments: 2 },
  'anthropic:claude-3-opus-20240229': { maxTokens: 4096, maxResponseSegments: 2 },
  'openai:gpt-4o': { maxTokens: 16384, maxResponseSegments: 2 },
  'openai:gpt-4o-mini': { maxTokens: 16384, maxResponseSegments: 2 },
};

export function getModelLimits(modelString?: string): ModelLimits {
  if (!modelString) {
    return DEFAULT_MODEL_LIMITS;
  }

  return MODEL_LIMITS[modelString] ?? DEFAULT_MODEL_LIMITS;
}
