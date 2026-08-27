import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { FileMap } from '~/lib/stores/files';
import { classNames } from '~/utils/classNames';
import { renderLogger } from '~/utils/logger';
import { FileTreeNode } from './FileTreeNode';
import { buildFileList, DEFAULT_HIDDEN_FILES } from './file-tree-model';

const ROW_HEIGHT = 24;
const OVERSCAN_ROWS = 8;

interface Props {
  files?: FileMap;
  selectedFile?: string;
  onFileSelect?: (filePath: string) => void;
  rootFolder?: string;
  hideRoot?: boolean;
  collapsed?: boolean;
  allowFolderSelection?: boolean;
  hiddenFiles?: Array<string | RegExp>;
  unsavedFiles?: Set<string>;
  className?: string;
}

export const FileTree = memo(
  ({
    files = {},
    onFileSelect,
    selectedFile,
    rootFolder,
    hideRoot = false,
    collapsed = false,
    allowFolderSelection = false,
    hiddenFiles,
    className,
    unsavedFiles,
  }: Props) => {
    renderLogger.trace('FileTree');

    const computedHiddenFiles = useMemo(() => [...DEFAULT_HIDDEN_FILES, ...(hiddenFiles ?? [])], [hiddenFiles]);
    const fileList = useMemo(
      () => buildFileList(files, rootFolder, hideRoot, computedHiddenFiles),
      [files, rootFolder, hideRoot, computedHiddenFiles],
    );
    const [collapsedFolders, setCollapsedFolders] = useState(() => {
      return collapsed
        ? new Set(fileList.filter((item) => item.kind === 'folder').map((item) => item.fullPath))
        : new Set<string>();
    });
    const [scrollTop, setScrollTop] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(0);
    const viewportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (collapsed) {
        setCollapsedFolders(new Set(fileList.filter((item) => item.kind === 'folder').map((item) => item.fullPath)));
        return;
      }

      setCollapsedFolders((previous) => {
        const next = new Set<string>();

        for (const folder of fileList) {
          if (folder.kind === 'folder' && previous.has(folder.fullPath)) {
            next.add(folder.fullPath);
          }
        }

        return next;
      });
    }, [fileList, collapsed]);

    useEffect(() => {
      const viewport = viewportRef.current;

      if (!viewport) {
        return () => undefined;
      }

      const resizeObserver = new ResizeObserver(() => setViewportHeight(viewport.clientHeight));

      resizeObserver.observe(viewport);
      setViewportHeight(viewport.clientHeight);

      return () => resizeObserver.disconnect();
    }, []);

    const filteredFileList = useMemo(() => {
      const visible = [];
      let lastDepth = Number.MAX_SAFE_INTEGER;

      for (const fileOrFolder of fileList) {
        const depth = fileOrFolder.depth;

        if (lastDepth === depth) {
          lastDepth = Number.MAX_SAFE_INTEGER;
        }

        if (collapsedFolders.has(fileOrFolder.fullPath)) {
          lastDepth = Math.min(lastDepth, depth);
        }

        if (lastDepth < depth) {
          continue;
        }

        visible.push(fileOrFolder);
      }

      return visible;
    }, [fileList, collapsedFolders]);

    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS);
    const endIndex = Math.min(
      filteredFileList.length,
      Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN_ROWS,
    );
    const visibleNodes = filteredFileList.slice(startIndex, endIndex);

    const toggleCollapseState = (fullPath: string) => {
      setCollapsedFolders((previous) => {
        const next = new Set(previous);

        if (next.has(fullPath)) {
          next.delete(fullPath);
        } else {
          next.add(fullPath);
        }

        return next;
      });
    };

    return (
      <div
        ref={viewportRef}
        className={classNames('h-full overflow-auto text-sm', className)}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div style={{ height: filteredFileList.length * ROW_HEIGHT, position: 'relative' }}>
          <div style={{ transform: `translateY(${startIndex * ROW_HEIGHT}px)` }}>
            {visibleNodes.map((node) => (
              <div key={node.id} style={{ height: ROW_HEIGHT }}>
                <FileTreeNode
                  node={node}
                  selected={selectedFile === node.fullPath}
                  unsavedChanges={unsavedFiles?.has(node.fullPath) ?? false}
                  collapsed={node.kind === 'folder' && collapsedFolders.has(node.fullPath)}
                  allowFolderSelection={allowFolderSelection}
                  onFileSelect={onFileSelect}
                  onFolderToggle={toggleCollapseState}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  },
);

export default FileTree;
