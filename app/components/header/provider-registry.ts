export type ProviderProtocol = 'native' | 'claude-compatible' | 'openai-compatible';

export interface ProviderInfo {
  readonly name: string;
  readonly label: string;
  readonly protocol: ProviderProtocol;
  readonly description: string;
  readonly baseURLPlaceholder: string;
  readonly models: readonly string[];
}

export const PROVIDERS: readonly ProviderInfo[] = [
  {
    name: 'anthropic',
    label: 'Anthropic',
    protocol: 'native',
    description: 'Claude through the Anthropic Messages API.',
    baseURLPlaceholder: 'default (api.anthropic.com)',
    models: ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  },
  {
    name: 'claude-compatible',
    label: 'Claude-compatible',
    protocol: 'claude-compatible',
    description: 'Any endpoint that implements the Claude Messages API.',
    baseURLPlaceholder: 'https://api.example.com/v1',
    models: ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229'],
  },
  {
    name: 'openai',
    label: 'OpenAI',
    protocol: 'native',
    description: 'OpenAI Responses API with the native provider.',
    baseURLPlaceholder: 'default (api.openai.com/v1)',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  {
    name: 'openai-compatible',
    label: 'OpenAI-compatible',
    protocol: 'openai-compatible',
    description: 'Ollama, LM Studio, OpenRouter, or another OpenAI-shaped API.',
    baseURLPlaceholder: 'http://localhost:11434/v1',
    models: ['llama3.1', 'qwen2.5-coder', 'deepseek-coder'],
  },
  {
    name: 'google',
    label: 'Google',
    protocol: 'native',
    description: 'Gemini through the Google Generative AI API.',
    baseURLPlaceholder: 'default',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
  },
  {
    name: 'mistral',
    label: 'Mistral',
    protocol: 'native',
    description: 'Mistral models through the native provider.',
    baseURLPlaceholder: 'default',
    models: ['mistral-large-latest', 'mistral-small-latest'],
  },
];

export function providerOfModel(model: string): string {
  const separatorIndex = model.indexOf(':');

  return separatorIndex === -1 ? 'anthropic' : model.slice(0, separatorIndex);
}

export function modelOfModel(model: string): string {
  const separatorIndex = model.indexOf(':');

  return separatorIndex === -1 ? model : model.slice(separatorIndex + 1);
}

export function parseModelResponse(value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value.models)) {
    return [];
  }

  return value.models.filter((model): model is string => typeof model === 'string' && model.length > 0);
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
