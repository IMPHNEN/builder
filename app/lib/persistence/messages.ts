import type { UIMessage } from 'ai';
import { z } from 'zod';

const uiMessageSchema = z.custom<UIMessage>(isPersistedUIMessage, {
  message: 'Expected an AI SDK UI message',
});

const legacyMessageSchema = z.object({
  id: z.string().optional(),
  role: z.union([z.literal('system'), z.literal('user'), z.literal('assistant')]),
  content: z.string(),
});

export type LegacyChatMessage = z.infer<typeof legacyMessageSchema>;
export type PersistedChatMessage = UIMessage | LegacyChatMessage;

export const chatExportSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().min(1),
  chats: z.array(
    z.object({
      id: z.string().min(1),
      urlId: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      messages: z.array(z.union([uiMessageSchema, legacyMessageSchema])),
      timestamp: z.string().min(1),
    }),
  ),
});

export function normalizeMessages(messages: readonly PersistedChatMessage[]): UIMessage[] {
  return messages.map((message, index) => {
    if (isPersistedUIMessage(message)) {
      return message;
    }

    return {
      id: message.id ?? `msg-${index}`,
      role: message.role,
      parts: [{ type: 'text', text: message.content }],
    };
  });
}

function isPersistedUIMessage(value: unknown): value is UIMessage {
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
