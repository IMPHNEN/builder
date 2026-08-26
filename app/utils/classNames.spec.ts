import { describe, expect, it } from 'vitest';
import { classNames } from './classNames';

describe('classNames', () => {
  it('should join string arguments with spaces', () => {
    expect(classNames('a', 'b', 'c')).toBe('a b c');
  });

  it('should ignore undefined values', () => {
    expect(classNames('a', undefined, 'b')).toBe('a b');
  });

  it('should include object keys whose value is truthy', () => {
    expect(classNames({ a: true, b: false, c: true })).toBe('a c');
  });

  it('should flatten nested arrays', () => {
    expect(classNames('a', ['b', ['c', { d: true }]])).toBe('a b c d');
  });

  it('should mix all argument shapes', () => {
    expect(classNames('base', ['nested'], { flag: true, off: false }, undefined)).toBe('base nested flag');
  });

  it('should return an empty string when nothing applies', () => {
    expect(classNames(undefined, { a: false }, [])).toBe('');
  });
});
