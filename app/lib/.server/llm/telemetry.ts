import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('LLM');

// server-side structured event log; a real sink (OTel/Analytics Engine) can subscribe to these later
export function logLLMEvent(event: string, details: Record<string, unknown> = {}) {
  logger.info(`event=${event} ${serializeDetails(details)}`.trim());
}

export function logLLMError(event: string, details: Record<string, unknown> = {}) {
  logger.error(`event=${event} ${serializeDetails(details)}`.trim());
}

function serializeDetails(details: Record<string, unknown>): string {
  return Object.entries(details)
    .map(([key, value]) => `${key}=${formatValue(value)}`)
    .join(' ');
}

function formatValue(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }

  return String(value);
}
