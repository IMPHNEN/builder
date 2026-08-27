import type { UIMessage } from 'ai';

/**
 * Concatenates the text parts of a UIMessage. Tolerates legacy v3 messages that
 * carried a plain `content` string instead of `parts` (e.g. chat history persisted
 * before the AI SDK upgrade) and malformed entries.
 */
export function getMessageText(message: UIMessage | undefined | null): string {
  if (!message) {
    return '';
  }

  const legacyContent = isRecord(message) ? message.content : undefined;

  if (typeof legacyContent === 'string') {
    return legacyContent;
  }

  const parts = message.parts;

  if (!Array.isArray(parts)) {
    return '';
  }

  return parts
    .filter((part): part is { type: 'text'; text: string } => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
