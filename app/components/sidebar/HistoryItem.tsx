import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useRef, useState } from 'react';
import { type ChatHistoryItem } from '~/lib/persistence';

interface HistoryItemProps {
  item: ChatHistoryItem;
  onDelete?: (event: React.UIEvent) => void;
  onRename?: (id: string, description: string) => void;
}

export function HistoryItem({ item, onDelete, onRename }: HistoryItemProps) {
  const [hovering, setHovering] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.description ?? '');
  const hoverRef = useRef<HTMLDivElement>(null);

  const commitRename = () => {
    const next = draft.trim();

    setEditing(false);

    if (next && next !== item.description) {
      onRename?.(item.id, next);
    } else {
      setDraft(item.description ?? '');
    }
  };

  useEffect(() => {
    let timeout: NodeJS.Timeout | undefined;

    function mouseEnter() {
      setHovering(true);

      if (timeout) {
        clearTimeout(timeout);
      }
    }

    function mouseLeave() {
      setHovering(false);
    }

    hoverRef.current?.addEventListener('mouseenter', mouseEnter);
    hoverRef.current?.addEventListener('mouseleave', mouseLeave);

    return () => {
      hoverRef.current?.removeEventListener('mouseenter', mouseEnter);
      hoverRef.current?.removeEventListener('mouseleave', mouseLeave);
    };
  }, []);

  return (
    <div
      ref={hoverRef}
      className="group rounded-md text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 overflow-hidden flex justify-between items-center px-2 py-1"
    >
      {editing ? (
        <input
          autoFocus
          className="w-full bg-transparent outline-none text-bolt-elements-textPrimary"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitRename}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              commitRename();
            } else if (event.key === 'Escape') {
              setDraft(item.description ?? '');
              setEditing(false);
            }
          }}
        />
      ) : (
        <a href={`/chat/${item.urlId}`} className="flex w-full relative truncate block">
          {item.description}
          <div className="absolute right-0 z-1 top-0 bottom-0 bg-gradient-to-l from-bolt-elements-background-depth-2 group-hover:from-bolt-elements-background-depth-3 to-transparent w-10 flex justify-end group-hover:w-15 group-hover:from-45%">
            {hovering && (
              <div className="flex items-center gap-1 p-1 text-bolt-elements-textSecondary">
                <button
                  className="i-ph:pencil-simple scale-110 hover:text-bolt-elements-textPrimary"
                  onClick={(event) => {
                    event.preventDefault();
                    setDraft(item.description ?? '');
                    setEditing(true);
                  }}
                />
                <Dialog.Trigger asChild>
                  <button
                    className="i-ph:trash scale-110 hover:text-bolt-elements-item-contentDanger"
                    onClick={(event) => {
                      // we prevent the default so we don't trigger the anchor above
                      event.preventDefault();
                      onDelete?.(event);
                    }}
                  />
                </Dialog.Trigger>
              </div>
            )}
          </div>
        </a>
      )}
    </div>
  );
}
