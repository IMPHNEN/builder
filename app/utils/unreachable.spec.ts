import { describe, expect, it } from 'vitest';
import { unreachable } from './unreachable';

describe('unreachable', () => {
  it('should throw an error prefixed with Unreachable', () => {
    expect(() => unreachable('no action')).toThrowError('Unreachable: no action');
  });
});
