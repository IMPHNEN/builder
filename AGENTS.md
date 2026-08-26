# PROJECT KNOWLEDGE BASE

**Generated:** 2025 (init-deep)
**Commit:** 45e2330
**Branch:** main

## OVERVIEW

Bolt.new — open-source AI full-stack web-dev agent that runs in the browser. Remix (Cloudflare Pages) frontend + server actions, Anthropic LLM via Vercel AI SDK, code executed live in StackBlitz WebContainers. TypeScript ESM, strict mode, pnpm.

## STRUCTURE

```
builder/
├── app/                  # Remix application (all source lives here)
│   ├── routes/           # _index, chat.$id, api.chat, api.enhancer
│   ├── components/       # chat/, workbench/, editor/codemirror/, ui/, sidebar/, header/
│   ├── lib/
│   │   ├── .server/llm/  # SERVER-ONLY: Anthropic model, prompts, stream
│   │   ├── runtime/      # StreamingMessageParser + ActionRunner (the agent loop)
│   │   ├── stores/       # nanostores state (workbench, files, editor, terminal, previews, chat)
│   │   ├── webcontainer/ # WebContainer boot + auth (client-only)
│   │   ├── persistence/  # IndexedDB chat history
│   │   └── hooks/        # React hooks bridging stores <-> UI
│   ├── styles/           # SCSS partials (UnoCSS for utilities)
│   ├── types/            # shared TS types (actions, artifact, terminal)
│   └── utils/            # pure helpers (shell, diff, logger, constants, debounce)
├── functions/[[path]].ts # Cloudflare Pages Function -> wraps remix server build
├── icons/*.svg           # custom UnoCSS icon collection ("i-bolt-<name>")
├── public/, types/       # static assets, wrangler Env types
├── vite.config.ts        # remix + cloudflare proxy + unocss + node polyfills
├── wrangler.toml         # Pages project "bolt", nodejs_compat
├── load-context.ts       # AppLoadContext augmentation (cloudflare env)
└── bindings.sh           # converts .env.local -> wrangler --binding args for `pnpm start`
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add/change LLM behavior | `app/lib/.server/llm/` | `prompts.ts` system prompt, `constants.ts` MAX_TOKENS, `model.ts` Anthropic |
| Chat streaming endpoint | `app/routes/api.chat.ts` | SwitchableStream for multi-segment continues on token limit |
| Prompt-enhance endpoint | `app/routes/api.enhancer.ts` | rewrites user prompt via LLM |
| Parse LLM output into actions | `app/lib/runtime/message-parser.ts` | parses `<boltArtifact>`/`<boltAction>` tags from stream |
| Execute file/shell actions | `app/lib/runtime/action-runner.ts` | writes files / spawns `jsh` in WebContainer |
| Global UI/runtime state | `app/lib/stores/` | nanostores; `workbench.ts` is the central hub (singleton) |
| Boot / hold WebContainer | `app/lib/webcontainer/index.ts` | exports a singleton `Promise<WebContainer>` |
| Save/load chat history | `app/lib/persistence/db.ts` | IndexedDB `boltHistory`, `chats` store |
| Editor | `app/components/editor/codemirror/` | CodeMirror 6, per-file documents |
| Terminal | `app/components/workbench/terminal/` + `utils/shell.ts` | xterm + WebContainer `jsh` |
| Workbench / preview | `app/components/workbench/` | file tree, preview iframe, port dropdown |
| Chat UI | `app/components/chat/` | `.client.tsx` components, markdown rendering |
| Deploy config | `wrangler.toml`, `functions/`, `bindings.sh` | Cloudflare Pages |

## CODE MAP

> LSP unavailable for TS here; codegraph not indexed. Centrality inferred from direct source reads (import graph + call sites). Refs = observed import/usage weight.

| Symbol | Type | Location | Refs | Role |
|--------|------|----------|------|------|
| `workbenchStore` | singleton store | `app/lib/stores/workbench.ts` | high | central hub: owns files/editor/terminal/previews/artifacts |
| `webcontainer` | `Promise<WebContainer>` | `app/lib/webcontainer/index.ts` | high | singleton booted container; SSR-safe (noop promise on server) |
| `StreamingMessageParser` | class | `app/lib/runtime/message-parser.ts` | high | incrementally parses LLM stream into artifact/action callbacks |
| `ActionRunner` | class | `app/lib/runtime/action-runner.ts` | high | executes parsed file/shell actions against WebContainer |
| `streamText` | fn | `app/lib/.server/llm/stream-text.ts` | high | wraps AI SDK; injects Anthropic model + system prompt + MAX_TOKENS |
| `FilesStore` | class | `app/lib/stores/files.ts` | high | mirrors WebContainer FS; tracks modifications via diff |
| `action` (api.chat) | route action | `app/routes/api.chat.ts` | high | POST messages -> streamed LLM response (SwitchableStream) |
| `EditorStore` | class | `app/lib/stores/editor.ts` | med | open documents, selection, scroll |
| `TerminalStore` | class | `app/lib/stores/terminal.ts` | med | attach/resize xterm terminal |
| `PreviewsStore` | class | `app/lib/stores/previews.ts` | med | dev-server previews/ports |
| `createScopedLogger` | fn | `app/utils/logger.ts` | high | namespaced leveled logging (use instead of console) |
| `openDatabase`/`getMessages`/`setMessages` | fns | `app/lib/persistence/db.ts` | med | IndexedDB CRUD for chats |
| `newShellProcess` | fn | `app/utils/shell.ts` | med | spawn interactive `jsh`, wait for OSC 654 interactive signal |
| `getAPIKey`/`getAnthropicModel` | fns | `app/lib/.server/llm/api-key.ts`, `model.ts` | med | env-driven Anthropic config |

## CONVENTIONS (deviations from defaults)

- **Path alias `~/` = `./app/`.** Relative `../` imports are ESLint errors — always `~/...` (`no-restricted-imports`).
- **Server-only code** lives under `app/lib/.server/` (Remix dot-directory convention). Never import it from client components. Cloudflare env is reached via `context.cloudflare.env` (see `load-context.ts`), not `process.env`.
- **Client-only components** use the `.client.tsx` suffix (remix-island); guard browser APIs. `webcontainer/index.ts` no-ops its promise during SSR (`import.meta.env.SSR`).
- **State = nanostores** (`atom`/`map`), not Redux/Zustand/React context. Stores are classes with private `#fields`; `workbenchStore` is the exported singleton.
- **HMR persistence**: singletons/store maps stash state on `import.meta.hot.data.*` to survive Vite HMR.
- **Logging**: use `createScopedLogger('Name')` from `~/utils/logger`; avoid raw `console.log` in lib code.
- **Styling**: UnoCSS utilities for layout/spacing; SCSS partials (`app/styles/`, `*.module.scss`) for component-specific styles. Custom icons as `i-bolt-<name>` from `icons/*.svg` (auto-collected in `uno.config.ts`).
- **Naming**: enforced via `@blitz/eslint-plugin`; React components `.tsx` get PascalCase naming-convention rule.
- **Exhaustive handling**: use `~/utils/unreachable` for impossible switch branches.
- Prettier: 120 col, single quotes, semicolons, 2-space indent (also `.editorconfig`, LF endings).

## ANTI-PATTERNS (THIS PROJECT)

- **DO NOT use relative parent imports (`../`)** — ESLint `no-restricted-imports` blocks them; use `~/`.
- **DO NOT import `app/lib/.server/**` from client code** — leaks server secrets (Anthropic key) into the browser bundle.
- **DO NOT read secrets from `process.env` on the server** — use `context.cloudflare.env` / the `Env` type (Cloudflare bindings).
- **DO NOT touch WebContainer on the server** — `webcontainer` is a client-only singleton; SSR branch is an unresolved noop promise by design.
- **DO NOT add a global state manager or prop-drill store state** — extend the existing nanostores stores instead.
- **DO NOT parse LLM output with regex per-chunk ad hoc** — route through `StreamingMessageParser`, which is chunk-safe and stateful across stream segments.
- **DO NOT spawn shells directly in components** — use `newShellProcess`/`ActionRunner`; they handle the interactive-OSC handshake and abort signals.
- Avoid `any`/non-exhaustive switches — `strict` TS + `unreachable` pattern is the norm.

## UNIQUE STYLES

- **Agent loop split in two**: `StreamingMessageParser` (pure, testable, snapshot-tested) emits callbacks; `ActionRunner` performs side effects. Keep that separation.
- **Multi-segment streaming**: `api.chat.ts` uses `SwitchableStream` + `CONTINUE_PROMPT` to auto-continue when `finishReason === 'length'`, capped by `MAX_RESPONSE_SEGMENTS`.
- **LLM wire protocol**: model emits `<boltArtifact>`/`<boltAction type="file|shell">` XML-ish tags (see `prompts.ts`); file edits reconcile via `<bolt_file_modifications>` diff tracking.
- **Dot-directory for server code** (`.server`) is load-bearing, not cosmetic — Remix excludes it from the client bundle.

## COMMANDS

```bash
pnpm install          # install (pnpm 9.4, node >=18.18)
pnpm dev              # remix vite dev (cloudflare dev proxy)
pnpm test             # vitest --run
pnpm test:watch       # vitest watch
pnpm typecheck        # tsc (noEmit)
pnpm lint             # eslint (uses @blitz config)
pnpm build            # remix vite:build
pnpm start            # wrangler pages dev ./build/client $(./bindings.sh)  [needs .env.local + bash]
pnpm run preview      # build + start
pnpm deploy           # build + wrangler pages deploy
pnpm typegen          # wrangler types -> worker-configuration.d.ts (Env)
```

## NOTES / GOTCHAS

- **Chrome 129 blocked in dev**: `vite.config.ts` `chrome129IssuePlugin` serves a warning page to Chrome 129 (JS-modules bug). Use Canary/other version locally; build/start are unaffected.
- **`pnpm start` requires bash + `.env.local`** (see `bindings.sh`); on Windows run dev via `pnpm dev` instead, or execute bindings through Git Bash/WSL.
- **Secrets**: Anthropic API key comes from Cloudflare binding (`.env.local` for local, Pages env in prod). `worker-configuration.d.ts` (`Env`) is generated by `pnpm typegen` — do not hand-edit.
- **CI** (`.github/workflows/ci.yaml`): typecheck + test on PR; ESLint step is currently commented out.
- **WebContainer API** is pinned to an internal build (`1.3.0-internal.10`) — do not casually bump.
- Tests are sparse (only `lib/runtime` has a `.spec.ts` + snapshot). Run `pnpm test` before refactors of the parser.
