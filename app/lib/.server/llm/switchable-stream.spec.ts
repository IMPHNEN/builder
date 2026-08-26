import { describe, expect, it } from 'vitest';
import SwitchableStream from './switchable-stream';

function streamFrom(chunks: string[]): ReadableStream {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }

      controller.close();
    },
  });
}

async function readAll(stream: ReadableStream): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  let result = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    result += decoder.decode(value);
  }

  return result;
}

describe('SwitchableStream', () => {
  it('should pump a single source through to the readable side', async () => {
    const stream = new SwitchableStream();

    await stream.switchSource(streamFrom(['hello', ' world']));
    await stream.close();

    expect(await readAll(stream.readable)).toBe('hello world');
    expect(stream.switches).toBe(1);
  });

  it('should combine output across switched sources', async () => {
    const stream = new SwitchableStream();

    await stream.switchSource(streamFrom(['first ']));
    await stream.switchSource(streamFrom(['second']));
    await stream.close();

    expect(await readAll(stream.readable)).toBe('first second');
    expect(stream.switches).toBe(2);
  });

  it('should reject switchSource after close', async () => {
    const stream = new SwitchableStream();

    await stream.switchSource(streamFrom(['data']));
    await stream.close();

    await expect(stream.switchSource(streamFrom(['more']))).rejects.toThrow(/closed/);
  });

  it('should make close idempotent', async () => {
    const stream = new SwitchableStream();

    await stream.switchSource(streamFrom(['data']));
    await stream.close();
    await expect(stream.close()).resolves.toBeUndefined();
  });
});
