import { describe, expect, it } from 'vitest';
import { withResolvers } from './promises';

describe('withResolvers', () => {
  it('should resolve the promise via the exposed resolver', async () => {
    const { promise, resolve } = withResolvers<number>();

    resolve(42);

    await expect(promise).resolves.toBe(42);
  });

  it('should reject the promise via the exposed rejecter', async () => {
    const { promise, reject } = withResolvers<number>();

    reject(new Error('boom'));

    await expect(promise).rejects.toThrow('boom');
  });

  it('should expose resolve, reject and promise', () => {
    const resolvers = withResolvers<string>();

    expect(typeof resolvers.resolve).toBe('function');
    expect(typeof resolvers.reject).toBe('function');
    expect(resolvers.promise).toBeInstanceOf(Promise);
  });
});
