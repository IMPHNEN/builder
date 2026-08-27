import type { FileMap } from '~/lib/stores/files';

export const NODE_PADDING_LEFT = 8;
export const DEFAULT_HIDDEN_FILES = [/\/node_modules\//, /\/\.next/, /\/\.astro/];

export type TreeNode = FileNode | FolderNode;

export interface FileNode {
  readonly kind: 'file';
  readonly id: number;
  readonly depth: number;
  readonly name: string;
  readonly fullPath: string;
}

export interface FolderNode {
  readonly kind: 'folder';
  readonly id: number;
  readonly depth: number;
  readonly name: string;
  readonly fullPath: string;
}

export function buildFileList(
  files: FileMap,
  rootFolder = '/',
  hideRoot: boolean,
  hiddenFiles: readonly (string | RegExp)[],
): TreeNode[] {
  const folderPaths = new Set<string>();
  const fileList: TreeNode[] = [];
  const defaultDepth = rootFolder === '/' && !hideRoot ? 1 : 0;

  if (rootFolder === '/' && !hideRoot) {
    fileList.push({ kind: 'folder', name: '/', depth: 0, id: 0, fullPath: '/' });
  }

  for (const [filePath, dirent] of Object.entries(files)) {
    const segments = filePath.split('/').filter(Boolean);
    const fileName = segments.at(-1);

    if (!fileName || isHiddenFile(filePath, fileName, hiddenFiles)) {
      continue;
    }

    let currentPath = '';
    let depth = 0;

    for (const [index, name] of segments.entries()) {
      const fullPath = (currentPath += `/${name}`);

      if (!fullPath.startsWith(rootFolder) || (hideRoot && fullPath === rootFolder)) {
        depth++;
        continue;
      }

      if (index === segments.length - 1 && dirent?.type === 'file') {
        fileList.push({ kind: 'file', id: fileList.length, name, fullPath, depth: depth + defaultDepth });
      } else if (!folderPaths.has(fullPath)) {
        folderPaths.add(fullPath);
        fileList.push({ kind: 'folder', id: fileList.length, name, fullPath, depth: depth + defaultDepth });
      }

      depth++;
    }
  }

  return sortFileList(rootFolder, fileList, hideRoot);
}

function isHiddenFile(filePath: string, fileName: string, hiddenFiles: readonly (string | RegExp)[]) {
  return hiddenFiles.some((pathOrRegex) => {
    if (typeof pathOrRegex === 'string') {
      return fileName === pathOrRegex;
    }

    return pathOrRegex.test(filePath);
  });
}

function sortFileList(rootFolder: string, nodeList: TreeNode[], hideRoot: boolean): TreeNode[] {
  nodeList.sort(compareNodes);

  const nodeMap = new Map<string, TreeNode>();
  const childrenMap = new Map<string, TreeNode[]>();

  for (const node of nodeList) {
    nodeMap.set(node.fullPath, node);

    const parentPath = node.fullPath.slice(0, node.fullPath.lastIndexOf('/'));

    if (parentPath !== rootFolder.slice(0, rootFolder.lastIndexOf('/'))) {
      const children = childrenMap.get(parentPath) ?? [];

      children.push(node);
      childrenMap.set(parentPath, children);
    }
  }

  const sortedList: TreeNode[] = [];

  const depthFirstTraversal = (path: string): void => {
    const node = nodeMap.get(path);

    if (node) {
      sortedList.push(node);
    }

    for (const child of childrenMap.get(path) ?? []) {
      if (child.kind === 'folder') {
        depthFirstTraversal(child.fullPath);
      } else {
        sortedList.push(child);
      }
    }
  };

  if (hideRoot) {
    for (const child of childrenMap.get(rootFolder) ?? []) {
      depthFirstTraversal(child.fullPath);
    }
  } else {
    depthFirstTraversal(rootFolder);
  }

  return sortedList;
}

function compareNodes(a: TreeNode, b: TreeNode): number {
  if (a.kind !== b.kind) {
    return a.kind === 'folder' ? -1 : 1;
  }

  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}
