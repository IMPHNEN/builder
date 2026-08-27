import { describe, expect, it } from 'vitest';
import { buildFileList } from './file-tree-model';

describe('buildFileList', () => {
  it('should create a sorted depth-first list from a file map', () => {
    const list = buildFileList(
      {
        '/home/project/z.ts': { type: 'file', content: '', isBinary: false },
        '/home/project/src/a.ts': { type: 'file', content: '', isBinary: false },
        '/home/project/src': { type: 'folder' },
      },
      '/home/project',
      true,
      [],
    );

    expect(list.map((node) => node.fullPath)).toEqual([
      '/home/project/src',
      '/home/project/src/a.ts',
      '/home/project/z.ts',
    ]);
  });

  it('should omit configured hidden files', () => {
    const list = buildFileList(
      {
        '/home/project/.env': { type: 'file', content: '', isBinary: false },
        '/home/project/app.ts': { type: 'file', content: '', isBinary: false },
      },
      '/home/project',
      true,
      ['.env'],
    );

    expect(list.map((node) => node.fullPath)).toEqual(['/home/project/app.ts']);
  });
});
