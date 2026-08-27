import { strToU8, zipSync, type Zippable } from 'fflate';
import type { FileMap } from '~/lib/stores/files';
import { WORK_DIR } from './constants';

/**
 * Serializes the WebContainer file map into a ZIP archive. Paths are made
 * relative to the project workdir (`/home/project`), and folder entries become
 * directory paths ending in `/`. Binary watcher content is retained when it is
 * available; older entries without bytes are omitted.
 */
export function filesToZip(files: FileMap): Uint8Array {
  const zippable: Zippable = {};

  for (const [filePath, dirent] of Object.entries(files)) {
    if (dirent === undefined) {
      continue;
    }

    const relativePath = stripWorkDir(filePath);

    if (dirent.type === 'folder') {
      zippable[`${relativePath}/`] = new Uint8Array(0);
      continue;
    }

    if (dirent.isBinary) {
      if (dirent.binaryContent) {
        zippable[relativePath] = dirent.binaryContent;
      }

      continue;
    }

    zippable[relativePath] = strToU8(dirent.content);
  }

  return zipSync(zippable);
}

/**
 * Triggers a browser download of the given bytes as a zip file.
 */
export function downloadZip(data: Uint8Array, filename: string): void {
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);

  const blob = new Blob([buffer], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function stripWorkDir(filePath: string): string {
  if (filePath.startsWith(WORK_DIR)) {
    return filePath.slice(WORK_DIR.length).replace(/^\/+/, '');
  }

  return filePath.replace(/^\/+/, '');
}
