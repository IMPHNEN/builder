import { describe, expect, it } from 'vitest';
import type { FileMap } from '~/lib/stores/files';
import {
  applyFileModifications,
  computeFileModifications,
  diffFiles,
  fileModificationConflictsToPrompt,
  fileModificationsToHTML,
  verifyFileModifications,
} from './diff';

describe('diffFiles', () => {
  it('should return undefined when the contents are identical', () => {
    expect(diffFiles('a.js', 'same', 'same')).toBeUndefined();
  });

  it('should omit the patch header from the unified diff', () => {
    const result = diffFiles('a.js', 'old line\n', 'new line\n');

    expect(result).toBeDefined();
    expect(result).not.toContain('--- a.js');
    expect(result).not.toContain('+++ a.js');
    expect(result).toContain('-old line');
    expect(result).toContain('+new line');
  });
});

describe('fileModificationsToHTML', () => {
  it('should return undefined for an empty modification set', () => {
    expect(fileModificationsToHTML({})).toBeUndefined();
  });

  it('should wrap a file modification in the modifications tag', () => {
    const html = fileModificationsToHTML({
      '/home/project/index.js': { type: 'file', content: 'full content' },
    });

    expect(html).toContain('<bolt_file_modifications>');
    expect(html).toContain('<file path="/home/project/index.js">');
    expect(html).toContain('full content');
    expect(html).toContain('</bolt_file_modifications>');
  });

  it('should render diff-type entries with a diff tag', () => {
    const html = fileModificationsToHTML({
      '/home/project/a.js': { type: 'diff', content: '-a\n+b' },
    });

    expect(html).toContain('<diff path="/home/project/a.js">');
    expect(html).toContain('-a\n+b');
  });
});

describe('computeFileModifications', () => {
  it('should return undefined when no tracked files changed', () => {
    const files: FileMap = { '/home/project/a.js': { type: 'file', content: 'same', isBinary: false } };
    const modified = new Map([['/home/project/a.js', 'same']]);

    expect(computeFileModifications(files, modified)).toBeUndefined();
  });

  it('should send the full file when it is smaller than the diff', () => {
    const original = 'line1\nline2\nline3\n';
    const updated = 'line1\nchanged\nline3\n';

    const files: FileMap = { '/home/project/a.js': { type: 'file', content: updated, isBinary: false } };
    const modified = new Map([['/home/project/a.js', original]]);

    const result = computeFileModifications(files, modified);

    expect(result?.['/home/project/a.js']).toEqual({ type: 'file', content: updated });
  });

  it('should send a diff when it is smaller than the file', () => {
    const original = Array.from({ length: 200 }, (_, i) => `line ${i}`).join('\n') + '\n';
    const updated = original.replace('line 100', 'line 100 edited');

    const files: FileMap = { '/home/project/big.js': { type: 'file', content: updated, isBinary: false } };
    const modified = new Map([['/home/project/big.js', original]]);

    const result = computeFileModifications(files, modified);

    expect(result?.['/home/project/big.js'].type).toBe('diff');
    expect(result?.['/home/project/big.js'].content).toContain('-line 100');
    expect(result?.['/home/project/big.js'].content).toContain('+line 100 edited');
  });

  it('should skip modified entries whose file no longer exists', () => {
    const files: FileMap = {};
    const modified = new Map([['/home/project/gone.js', 'old']]);

    expect(computeFileModifications(files, modified)).toBeUndefined();
  });
});

describe('applyFileModifications', () => {
  it('should apply a generated hunk to its baseline content', () => {
    const filePath = '/home/project/app.ts';
    const original = 'const value = 1;\n';
    const updated = 'const value = 2;\n';
    const patch = diffFiles(filePath, original, updated);

    if (!patch) {
      throw new Error('Expected a patch');
    }

    const result = applyFileModifications(
      { [filePath]: { type: 'file', content: original, isBinary: false } },
      { [filePath]: { type: 'diff', content: patch } },
    );

    expect(result).toEqual({
      status: 'applied',
      files: { [filePath]: { type: 'file', content: updated, isBinary: false } },
    });
  });

  it('should report a conflict when a hunk cannot fit the baseline', () => {
    const filePath = '/home/project/app.ts';
    const patch = diffFiles(filePath, 'const value = 1;\n', 'const value = 2;\n');

    if (!patch) {
      throw new Error('Expected a patch');
    }

    const result = applyFileModifications(
      { [filePath]: { type: 'file', content: 'const value = 9;\n', isBinary: false } },
      { [filePath]: { type: 'diff', content: patch } },
    );

    expect(result).toEqual({
      status: 'conflict',
      conflicts: [{ filePath, reason: 'patch-not-applicable' }],
    });
  });
});

describe('verifyFileModifications', () => {
  it('should accept a modification set that round-trips to the current files', () => {
    const filePath = '/home/project/app.ts';
    const baseline = { [filePath]: { type: 'file' as const, content: 'const value = 1;\n', isBinary: false } };
    const current = { [filePath]: { type: 'file' as const, content: 'const value = 2;\n', isBinary: false } };
    const modifications = computeFileModifications(current, new Map([[filePath, baseline[filePath].content]]));

    const result = verifyFileModifications(current, baseline, modifications);

    expect(result.status).toBe('valid');
  });

  it('should return a model-readable conflict prompt for stale modifications', () => {
    const conflicts = [{ filePath: '/home/project/app.ts', reason: 'round-trip-mismatch' as const }];

    expect(fileModificationConflictsToPrompt(conflicts)).toContain('/home/project/app.ts');
  });
});
