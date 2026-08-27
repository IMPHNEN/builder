import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { FileMap } from '~/lib/stores/files';
import { filesToZip } from './zip';

describe('filesToZip', () => {
  it('should preserve project-relative text files and folders', () => {
    const files: FileMap = {
      '/home/project/index.html': { type: 'file', content: '<main>Hello</main>', isBinary: false },
      '/home/project/src': { type: 'folder' },
      '/home/project/src/app.ts': { type: 'file', content: 'export const app = true;', isBinary: false },
    };

    const archive = unzipSync(filesToZip(files));

    expect(strFromU8(archive['index.html'])).toBe('<main>Hello</main>');
    expect(strFromU8(archive['src/app.ts'])).toBe('export const app = true;');
    expect(archive['src/']).toEqual(new Uint8Array());
  });

  it('should omit deleted and binary entries that cannot be represented as text', () => {
    const files: FileMap = {
      '/home/project/removed.txt': undefined,
      '/home/project/image.png': { type: 'file', content: '', isBinary: true },
      '/home/project/readme.md': { type: 'file', content: '# Project', isBinary: false },
    };

    const archive = unzipSync(filesToZip(files));

    expect(Object.keys(archive)).toEqual(['readme.md']);
    expect(strFromU8(archive['readme.md'])).toBe('# Project');
  });

  it('should preserve binary watcher bytes when they are available', () => {
    const bytes = new Uint8Array([0, 255, 42]);
    const files: FileMap = {
      '/home/project/image.png': { type: 'file', content: '', isBinary: true, binaryContent: bytes },
    };

    const archive = unzipSync(filesToZip(files));

    expect(archive['image.png']).toEqual(bytes);
  });
});
