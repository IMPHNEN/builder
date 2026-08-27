import { useStore } from '@nanostores/react';
import { Panel, type ImperativePanelHandle } from 'react-resizable-panels';
import { memo, useEffect, useRef, useState } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import { shortcutEventEmitter } from '~/lib/hooks';
import { themeStore } from '~/lib/stores/theme';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { Terminal, type TerminalRef } from './terminal/Terminal';

const MAX_TERMINALS = 3;
const DEFAULT_TERMINAL_SIZE = 25;

export const TerminalPanel = memo(() => {
  const theme = useStore(themeStore);
  const showTerminal = useStore(workbenchStore.showTerminal);
  const terminalRefs = useRef<Array<TerminalRef | null>>([]);
  const terminalPanelRef = useRef<ImperativePanelHandle>(null);
  const terminalToggledByShortcut = useRef(false);
  const [activeTerminal, setActiveTerminal] = useState(0);
  const [terminalCount, setTerminalCount] = useState(1);
  const [mountedTerminals, setMountedTerminals] = useState(() => new Set([0]));

  useEffect(() => {
    const unsubscribeFromEventEmitter = shortcutEventEmitter.on('toggleTerminal', () => {
      terminalToggledByShortcut.current = true;
    });

    const unsubscribeFromThemeStore = themeStore.subscribe(() => {
      for (const ref of Object.values(terminalRefs.current)) {
        ref?.reloadStyles();
      }
    });

    return () => {
      unsubscribeFromEventEmitter();
      unsubscribeFromThemeStore();
    };
  }, []);

  useEffect(() => {
    const terminal = terminalPanelRef.current;

    if (!terminal) {
      return;
    }

    const isCollapsed = terminal.isCollapsed();

    if (!showTerminal && !isCollapsed) {
      terminal.collapse();
    } else if (showTerminal && isCollapsed) {
      terminal.resize(DEFAULT_TERMINAL_SIZE);
    }

    terminalToggledByShortcut.current = false;
  }, [showTerminal]);

  const addTerminal = () => {
    if (terminalCount >= MAX_TERMINALS) {
      return;
    }

    const nextTerminal = terminalCount;

    setTerminalCount(nextTerminal + 1);
    activateTerminal(nextTerminal);
  };

  const activateTerminal = (index: number) => {
    setActiveTerminal(index);
    setMountedTerminals((terminals) => {
      if (terminals.has(index)) {
        return terminals;
      }

      return new Set(terminals).add(index);
    });
  };

  return (
    <Panel
      ref={terminalPanelRef}
      defaultSize={showTerminal ? DEFAULT_TERMINAL_SIZE : 0}
      minSize={10}
      collapsible
      onExpand={() => {
        if (!terminalToggledByShortcut.current) {
          workbenchStore.toggleTerminal(true);
        }
      }}
      onCollapse={() => {
        if (!terminalToggledByShortcut.current) {
          workbenchStore.toggleTerminal(false);
        }
      }}
    >
      <div className="h-full">
        <div className="bg-bolt-elements-terminals-background h-full flex flex-col">
          <div className="flex items-center bg-bolt-elements-background-depth-2 border-y border-bolt-elements-borderColor gap-1.5 min-h-[34px] p-2">
            {Array.from({ length: terminalCount }, (_, index) => {
              const isActive = activeTerminal === index;

              return (
                <button
                  key={index}
                  className={classNames(
                    'flex items-center text-sm cursor-pointer gap-1.5 px-3 py-2 h-full whitespace-nowrap rounded-full',
                    {
                      'bg-bolt-elements-terminals-buttonBackground text-bolt-elements-textPrimary': isActive,
                      'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-terminals-buttonBackground':
                        !isActive,
                    },
                  )}
                  onClick={() => activateTerminal(index)}
                >
                  <div className="i-ph:terminal-window-duotone text-lg" />
                  Terminal {terminalCount > 1 && index + 1}
                </button>
              );
            })}
            {terminalCount < MAX_TERMINALS && <IconButton icon="i-ph:plus" size="md" onClick={addTerminal} />}
            <IconButton
              className="ml-auto"
              icon="i-ph:caret-down"
              title="Close"
              size="md"
              onClick={() => workbenchStore.toggleTerminal(false)}
            />
          </div>
          {Array.from({ length: terminalCount }, (_, index) => {
            const isActive = activeTerminal === index;

            if (!mountedTerminals.has(index)) {
              return null;
            }

            return (
              <Terminal
                key={index}
                className={classNames('h-full overflow-hidden', { hidden: !isActive })}
                ref={(ref) => {
                  terminalRefs.current[index] = ref;
                }}
                onTerminalReady={(terminal) => workbenchStore.attachTerminal(terminal)}
                onTerminalResize={(cols, rows) => workbenchStore.onTerminalResize(cols, rows)}
                theme={theme}
              />
            );
          })}
        </div>
      </div>
    </Panel>
  );
});
