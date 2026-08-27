import { applyPatch, createTwoFilesPatch } from 'diff';
import type { FileMap } from '~/lib/stores/files';
import { MODIFICATIONS_TAG_NAME } from './constants';

export const modificationsRegex = new RegExp(
  `^<${MODIFICATIONS_TAG_NAME}>[\\s\\S]*?<\\/${MODIFICATIONS_TAG_NAME}>\\s+`,
  'g',
);

export interface FileModification {
  readonly type: 'diff' | 'file';
  readonly content: string;
}

export type FileModifications = Record<string, FileModification>;

export interface FileModificationConflict {
  readonly filePath: string;
  readonly reason: 'missing-file' | 'patch-not-applicable' | 'round-trip-mismatch';
}

export type FileModificationApplication =
  | { readonly status: 'applied'; readonly files: FileMap }
  | { readonly status: 'conflict'; readonly conflicts: readonly FileModificationConflict[] };

export type FileModificationVerification =
  | { readonly status: 'clean' }
  | { readonly status: 'valid'; readonly modifications: FileModifications }
  | {
      readonly status: 'conflict';
      readonly modifications: FileModifications;
      readonly conflicts: readonly FileModificationConflict[];
    };

export function computeFileModifications(files: FileMap, modifiedFiles: Map<string, string>) {
  const modifications: FileModifications = {};

  let hasModifiedFiles = false;

  for (const [filePath, originalContent] of modifiedFiles) {
    const file = files[filePath];

    if (file?.type !== 'file') {
      continue;
    }

    const unifiedDiff = diffFiles(filePath, originalContent, file.content);

    if (!unifiedDiff) {
      // files are identical
      continue;
    }

    hasModifiedFiles = true;

    if (unifiedDiff.length > file.content.length) {
      // if there are lots of changes we simply grab the current file content since it's smaller than the diff
      modifications[filePath] = { type: 'file', content: file.content };
    } else {
      // otherwise we use the diff since it's smaller
      modifications[filePath] = { type: 'diff', content: unifiedDiff };
    }
  }

  if (!hasModifiedFiles) {
    return undefined;
  }

  return modifications;
}

/**
 * Computes a diff in the unified format. The only difference is that the header is omitted
 * because it will always assume that you're comparing two versions of the same file and
 * it allows us to avoid the extra characters we send back to the llm.
 *
 * @see https://www.gnu.org/software/diffutils/manual/html_node/Unified-Format.html
 */
export function diffFiles(fileName: string, oldFileContent: string, newFileContent: string) {
  let unifiedDiff = createTwoFilesPatch(fileName, fileName, oldFileContent, newFileContent);

  const patchHeaderEnd = `--- ${fileName}\n+++ ${fileName}\n`;
  const headerEndIndex = unifiedDiff.indexOf(patchHeaderEnd);

  if (headerEndIndex >= 0) {
    unifiedDiff = unifiedDiff.slice(headerEndIndex + patchHeaderEnd.length);
  }

  if (unifiedDiff === '') {
    return undefined;
  }

  return unifiedDiff;
}

/**
 * Converts the unified diff to HTML.
 *
 * Example:
 *
 * ```html
 * <bolt_file_modifications>
 * <diff path="/home/project/index.js">
 * - console.log('Hello, World!');
 * + console.log('Hello, Bolt!');
 * </diff>
 * </bolt_file_modifications>
 * ```
 */
export function fileModificationsToHTML(modifications: FileModifications) {
  const entries = Object.entries(modifications);

  if (entries.length === 0) {
    return undefined;
  }

  const result: string[] = [`<${MODIFICATIONS_TAG_NAME}>`];

  for (const [filePath, { type, content }] of entries) {
    result.push(`<${type} path=${JSON.stringify(filePath)}>`, content, `</${type}>`);
  }

  result.push(`</${MODIFICATIONS_TAG_NAME}>`);

  return result.join('\n');
}

export function applyFileModifications(files: FileMap, modifications: FileModifications): FileModificationApplication {
  const nextFiles = { ...files };
  const conflicts: FileModificationConflict[] = [];

  for (const [filePath, modification] of Object.entries(modifications)) {
    if (modification.type === 'file') {
      nextFiles[filePath] = { type: 'file', content: modification.content, isBinary: false };
      continue;
    }

    const file = files[filePath];

    if (file?.type !== 'file') {
      conflicts.push({ filePath, reason: 'missing-file' });
      continue;
    }

    const patchedContent = applyPatch(file.content, `--- ${filePath}\n+++ ${filePath}\n${modification.content}`);

    if (patchedContent === false) {
      conflicts.push({ filePath, reason: 'patch-not-applicable' });
      continue;
    }

    nextFiles[filePath] = { ...file, content: patchedContent, isBinary: false };
  }

  return conflicts.length > 0 ? { status: 'conflict', conflicts } : { status: 'applied', files: nextFiles };
}

export function verifyFileModifications(
  currentFiles: FileMap,
  baselineFiles: FileMap,
  modifications: FileModifications | undefined,
): FileModificationVerification {
  if (!modifications) {
    return { status: 'clean' };
  }

  const applied = applyFileModifications(baselineFiles, modifications);

  if (applied.status === 'conflict') {
    return { status: 'conflict', modifications, conflicts: applied.conflicts };
  }

  const conflicts: FileModificationConflict[] = [];

  for (const filePath of Object.keys(modifications)) {
    const current = currentFiles[filePath];
    const result = applied.files[filePath];

    if (current?.type !== 'file' || result?.type !== 'file' || current.content !== result.content) {
      conflicts.push({ filePath, reason: 'round-trip-mismatch' });
    }
  }

  return conflicts.length > 0 ? { status: 'conflict', modifications, conflicts } : { status: 'valid', modifications };
}

export function fileModificationConflictsToPrompt(conflicts: readonly FileModificationConflict[]): string {
  const lines = conflicts.map(({ filePath, reason }) => `- ${filePath}: ${reason}`);

  return ['The following user file changes could not be applied cleanly:', ...lines].join('\n');
}
