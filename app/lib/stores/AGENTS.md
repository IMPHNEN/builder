# app/lib/stores — KNOWLEDGE BASE

Client-side state layer. nanostores (`atom`/`map`) inside class-based stores with private `#` fields. No React context, no external state lib.

## OVERVIEW

One line: reactive singleton stores that mirror and drive the WebContainer + editor + chat UI.

## STRUCTURE

```
stores/
├── workbench.ts   # WorkbenchStore — central hub, composes the stores below; exports `workbenchStore`
├── files.ts       # FilesStore — mirrors WebContainer FS, tracks diffs vs last user message
├── editor.ts      # EditorStore — open documents, selection, scroll positions
├── terminal.ts    # TerminalStore — xterm attach/resize/show
├── previews.ts    # PreviewsStore — dev-server previews + ports
├── chat.ts        # chatStore (map) — started/aborted flags
├── theme.ts       # themeStore (atom) — light/dark + toggleTheme
└── settings.ts    # settingsStore + shortcutsStore (maps)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add app-wide state/action | `workbench.ts` | facade; delegate to the sub-store, don't bypass it |
| File content / dirty tracking | `files.ts` | `FileMap`, `#modifiedFiles`, `computeFileModifications` |
| Open file / cursor / scroll | `editor.ts` | `EditorDocument`, `selectedFile`, `currentDocument` |
| Terminal lifecycle | `terminal.ts` | `attachTerminal(ITerminal)`, `onTerminalResize` |
| Preview iframe / ports | `previews.ts` | driven by WebContainer `server-ready` events |

## CONVENTIONS (delta from root)

- **Singleton composition**: sub-stores are constructed inside `WorkbenchStore` and exposed via getters; UI consumes the single `workbenchStore` export, not the sub-stores directly.
- **HMR survival**: every store persists its atoms/maps onto `import.meta.hot.data.*` (see root) — replicate that pattern for any new store field or it resets on hot reload.
- **WebContainer injected as `Promise<WebContainer>`** into constructors; `await` it inside methods, never assume it's resolved.
- **`FileMap` uses `undefined` values** (`Record<string, Dirent | undefined>`) — a present-but-`undefined` key means "known deleted/absent"; don't treat missing vs undefined as identical.
- Subscribe in React via `@nanostores/react` `useStore`, not manual subscribe.

## ANTI-PATTERNS (THIS DIR)

- **DO NOT hold WebContainer FS state in React state** — `FilesStore` is the single source of truth for the container filesystem.
- **DO NOT write to the WebContainer FS from a component** — go through `FilesStore`/`ActionRunner` so `#modifiedFiles` and watchers stay consistent.
- **DO NOT create store instances in components** — import the existing singletons; new instances desync the watchers.
- **`#modifiedFiles` must reset when the user sends a new message** (it feeds the model the diff context) — don't carry it across turns.
