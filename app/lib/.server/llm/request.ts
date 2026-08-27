import type { UIMessage } from 'ai';
import { z } from 'zod';
import { SUPPORTED_PROVIDERS } from './registry';

const uiMessageSchema = z.custom<UIMessage>(isUIMessage, {
  message: 'Expected an AI SDK UI message',
});

export const chatRequestSchema = z.object({
  messages: z.array(uiMessageSchema),
  model: z.string().trim().min(1).optional(),
  providerConfigs: z.unknown().optional(),
});

export const enhancerRequestSchema = z.object({
  message: z.string().min(1),
  model: z.string().trim().min(1).optional(),
  providerConfigs: z.unknown().optional(),
});

export const commitMessageRequestSchema = z.object({
  diff: z.string().optional(),
  model: z.string().trim().min(1).optional(),
  providerConfigs: z.unknown().optional(),
});

export const modelsRequestSchema = z.object({
  provider: z.enum(SUPPORTED_PROVIDERS),
  providerConfigs: z.unknown().optional(),
});

function isUIMessage(value: unknown): value is UIMessage {
  if (!isRecord(value) || typeof value.id !== 'string' || !isMessageRole(value.role) || !Array.isArray(value.parts)) {
    return false;
  }

  return value.parts.every((part) => isRecord(part) && typeof part.type === 'string' && part.type.length > 0);
}

function isMessageRole(value: unknown): value is UIMessage['role'] {
  return value === 'system' || value === 'user' || value === 'assistant';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
