import type { ReactNode } from 'react';
import { classNames } from '~/utils/classNames';
import { NODE_PADDING_LEFT, type FileNode, type FolderNode, type TreeNode } from './file-tree-model';

interface FileTreeNodeProps {
  readonly node: TreeNode;
  readonly selected: boolean;
  readonly unsavedChanges: boolean;
  readonly collapsed: boolean;
  readonly allowFolderSelection: boolean;
  readonly onFileSelect?: (filePath: string) => void;
  readonly onFolderToggle: (filePath: string) => void;
}

export function FileTreeNode({
  node,
  selected,
  unsavedChanges,
  collapsed,
  allowFolderSelection,
  onFileSelect,
  onFolderToggle,
}: FileTreeNodeProps) {
  switch (node.kind) {
    case 'file': {
      return (
        <File
          file={node}
          selected={selected}
          unsavedChanges={unsavedChanges}
          onClick={() => onFileSelect?.(node.fullPath)}
        />
      );
    }
    case 'folder': {
      return (
        <Folder
          folder={node}
          collapsed={collapsed}
          selected={allowFolderSelection && selected}
          onClick={() => onFolderToggle(node.fullPath)}
        />
      );
    }
  }
}

interface FolderProps {
  readonly folder: FolderNode;
  readonly collapsed: boolean;
  readonly selected: boolean;
  readonly onClick: () => void;
}

function Folder({ folder: { depth, name }, collapsed, selected, onClick }: FolderProps) {
  return (
    <NodeButton
      className={classNames('group', {
        'bg-transparent text-bolt-elements-item-contentDefault hover:text-bolt-elements-item-contentActive hover:bg-bolt-elements-item-backgroundActive':
          !selected,
        'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent': selected,
      })}
      depth={depth}
      iconClasses={classNames({
        'i-ph:caret-right scale-98': collapsed,
        'i-ph:caret-down scale-98': !collapsed,
      })}
      onClick={onClick}
    >
      {name}
    </NodeButton>
  );
}

interface FileProps {
  readonly file: FileNode;
  readonly selected: boolean;
  readonly unsavedChanges: boolean;
  readonly onClick: () => void;
}

function File({ file: { depth, name }, onClick, selected, unsavedChanges }: FileProps) {
  return (
    <NodeButton
      className={classNames('group', {
        'bg-transparent hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-item-contentDefault': !selected,
        'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent': selected,
      })}
      depth={depth}
      iconClasses={classNames('i-ph:file-duotone scale-98', {
        'group-hover:text-bolt-elements-item-contentActive': !selected,
      })}
      onClick={onClick}
    >
      <div
        className={classNames('flex items-center', {
          'group-hover:text-bolt-elements-item-contentActive': !selected,
        })}
      >
        <div className="flex-1 truncate pr-2">{name}</div>
        {unsavedChanges && <span className="i-ph:circle-fill scale-68 shrink-0 text-orange-500" />}
      </div>
    </NodeButton>
  );
}

interface NodeButtonProps {
  readonly depth: number;
  readonly iconClasses: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly onClick?: () => void;
}

function NodeButton({ depth, iconClasses, onClick, className, children }: NodeButtonProps) {
  return (
    <button
      type="button"
      className={classNames(
        'flex items-center gap-1.5 w-full pr-2 border-2 border-transparent text-faded py-0.5',
        className,
      )}
      style={{ paddingLeft: `${6 + depth * NODE_PADDING_LEFT}px` }}
      onClick={onClick}
    >
      <div className={classNames('scale-120 shrink-0', iconClasses)} />
      <div className="truncate w-full text-left">{children}</div>
    </button>
  );
}
