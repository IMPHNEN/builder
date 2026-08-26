import { describe, expect, it } from 'vitest';
import { stripIndents } from './stripIndent';

describe('stripIndents', () => {
  it('should strip leading indentation from each line', () => {
    expect(stripIndents('  hello\n    world')).toBe('hello\nworld');
  });

  it('should trim leading blank lines and a trailing newline', () => {
    expect(stripIndents('\n\n  hello\n')).toBe('hello');
  });

  it('should work as a template tag', () => {
    const name = 'bolt';

    expect(
      stripIndents`
        hello
        ${name}
      `,
    ).toBe('hello\nbolt');
  });

  it('should handle missing template values', () => {
    expect(stripIndents`a${undefined}b`).toBe('ab');
  });

  it('should collapse fully-indented single line', () => {
    expect(stripIndents('      only')).toBe('only');
  });
});
