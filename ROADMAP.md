# Bolt.new — Feature Roadmap

> Forward-looking feature plan. Bug-fix hardening (Phases 0–5) is complete; see git history and the 81-test suite. This document is **new features only**, ordered by dependency and value. Each feature lists the files it touches (paths verified against the current codebase) and its status.

**Status legend:** `[ ]` not started · `[~]` blocked (needs a decision) · `[x]` done

---

## Milestone A — Model & Provider Flexibility

Builds directly on the Phase 2 provider registry (`app/lib/.server/llm/registry.ts`).

### A1. Multi-provider support `[~]`
- **What:** register OpenAI, Google, Mistral, etc. in `createProviderRegistry`; resolve keys per-provider.
- **Touches:** `llm/registry.ts`, `llm/api-key.ts` (`getProviderKeys` → per-provider keys), `worker-configuration.d.ts` (`Env` gains `OPENAI_API_KEY`, …), `.env.local` docs.
- **Blocked on:** which providers to support first + their AI SDK package versions (must match `ai@3.3.4`).
- **Effort:** S · **Value:** High

### A2. Model picker in UI `[~]`
- **What:** dropdown to choose `provider:model`; passed to `streamText({ modelString })`.
- **Touches:** `components/header/`, `lib/stores/settings.ts` (persist choice), `routes/api.chat.ts` (accept `modelString` from request body), `stream-text.ts` (already supports it).
- **Blocked on:** A1; whether selection is per-chat or global.
- **Effort:** M · **Value:** High

### A3. Per-model token/segment limits `[ ]`
- **What:** `MAX_TOKENS` / `MAX_RESPONSE_SEGMENTS` are global constants (`llm/constants.ts`); make them per-model.
- **Touches:** `llm/constants.ts` → a `MODEL_LIMITS` map keyed by model id; `api.chat.ts` reads via the active model.
- **Depends on:** A1. **Effort:** S · **Value:** Medium

---

## Milestone B — Persistence & Portability

Builds on Phase 4 (rename / export / `deleteByUrlId` in `app/lib/persistence/db.ts`).

### B1. Import chats (JSON) `[ ]`
- **What:** inverse of the Phase 4 export — read a `ChatExport` file, validate, merge into IndexedDB (new ids via `getNextId`, regenerate `urlId` via `getUrlId`).
- **Touches:** `persistence/db.ts` (`importChats`), `components/sidebar/Menu.client.tsx` (import button + file picker).
- **Note:** validate with `zod` (already a devDependency) against the `ChatExport` shape.
- **Effort:** S · **Value:** Medium

### B2. Server-side persistence (Cloudflare D1) `[~]`
- **What:** real SQL storage at the edge for accounts + shared/remote chats. **D1 is SQLite-at-the-edge** — the correct answer to "real DB with SQLite" for this stack (the browser keeps IndexedDB as a local cache).
- **Touches:** new `app/lib/.server/db/` (D1 client), `wrangler.toml` (`[[d1_databases]]`), `worker-configuration.d.ts`, sync layer between IndexedDB ↔ D1.
- **Blocked on:** auth (D2) — persistence is per-user.
- **Effort:** L · **Value:** High

### B3. Project export to ZIP `[~]`
- **What:** serialize the WebContainer FS (`lib/stores/files.ts` `FileMap`) into a downloadable zip.
- **Touches:** new `utils/zip.ts`, a workbench header button (`Workbench.client.tsx`).
- **Blocked on:** zip lib choice — must be browser/WASM-safe (e.g. `fflate`, already small); confirm no native deps.
- **Effort:** M · **Value:** High

### B4. GitHub import / export `[~]`
- **What:** clone a repo into the WebContainer; push the container FS to a repo.
- **Touches:** `lib/webcontainer/`, new `lib/.server/github.ts` (OAuth token), `components/header/`.
- **Blocked on:** GitHub OAuth app + token storage decision (ties to D2).
- **Effort:** L · **Value:** High

---

## Milestone C — Sharing & Accounts

### C1. Share project by URL (read-only) `[~]`
- **What:** snapshot messages + FS; generate a public read-only link.
- **Touches:** new `routes/share.$id.tsx`, server snapshot store (B2/D1 or KV), a "Share" button.
- **Blocked on:** B2 (needs server storage).
- **Effort:** M · **Value:** High

### C2. Authentication & private projects `[~]`
- **What:** user accounts; gate private projects/sharing. There is a stub at `lib/webcontainer/auth.client.ts` to build on.
- **Touches:** `auth.client.ts`, new `routes/auth.*`, `lib/.server/` session handling, `load-context.ts`.
- **Blocked on:** identity provider choice (Clerk / Auth.js / custom with `jose`, already a dependency).
- **Effort:** L · **Value:** High (gates B2, C1)

---

## Milestone D — Agent & Editor Depth

### D1. Diff-review before apply `[~]`
- **What:** show model-proposed file changes as a diff the user can accept/reject before `ActionRunner` writes them.
- **Touches:** `lib/runtime/action-runner.ts` (stage vs. commit), a new diff view in `components/editor/`, `lib/stores/workbench.ts`.
- **Blocked on:** UX decision (inline vs. modal review).
- **Effort:** M · **Value:** High

### D2. Terminal: lazy-mount inactive terminals `[ ]`
- **What:** today all terminals (even `hidden` ones) spawn a WebContainer shell on mount (`EditorPanel.tsx`). Only spawn the active one; spawn others on first activation.
- **Touches:** `components/workbench/EditorPanel.tsx`, `lib/stores/terminal.ts`.
- **Note:** needs a real-browser check (xterm `fit()`/resize behavior) — Playwright, not vitest. Carried over from Phase 3 (W3).
- **Effort:** S · **Value:** Medium (resource usage)

### D3. `<bolt_file_modifications>` round-trip integrity `[ ]`
- **What:** verify a returned diff applies cleanly to the current FS; surface conflicts back to the model.
- **Touches:** `utils/diff.ts`, `lib/stores/files.ts`, the chat route.
- **Note:** requires a WebContainer FS — integration/e2e (Playwright), not vitest.
- **Effort:** M · **Value:** Medium

### D4. File-tree virtualization `[ ]`
- **What:** `FileTree.tsx` (343 lines) renders every node; virtualize for large projects.
- **Touches:** `components/workbench/FileTree.tsx`.
- **Effort:** M · **Value:** Medium (perf on big repos)

---

## Milestone E — Quality Infrastructure

### E1. CI hard gate for ESLint `[ ]`
- **What:** the lint step is currently `continue-on-error: true` because of 23 pre-existing `@blitz/comment-syntax` errors. Fix those, then remove the opt-out.
- **Touches:** `.github/workflows/ci.yaml`, the offending comment blocks.
- **Effort:** S · **Value:** Medium

### E2. `.gitattributes` LF normalization `[ ]`
- **What:** add `* text=auto eol=lf` to stop CRLF phantom lint errors for Windows contributors (`core.autocrlf` checkouts currently produce thousands of false `prettier/prettier` errors locally).
- **Touches:** new `.gitattributes`.
- **Effort:** XS · **Value:** Medium

### E3. Browser/e2e harness (Playwright) `[~]`
- **What:** real-browser tests for the WebContainer flows (terminal, preview, file write round-trips) that vitest cannot cover.
- **Touches:** new `e2e/`, `playwright.config.ts`, CI job.
- **Blocked on:** a WebContainer API key usable in CI.
- **Effort:** L · **Value:** High

### E4. Fake-timer coverage for debounce/buffer `[ ]`
- **What:** `utils/debounce.ts` and `utils/buffer.ts` (FS watch batching) are untested because they are timing-dependent. Add `vi.useFakeTimers()` tests.
- **Touches:** new `debounce.spec.ts`, `buffer.spec.ts`.
- **Effort:** S · **Value:** Low-Medium

---

## Milestone F — Extensibility & Agentic Coding

> Brings Bolt's agent loop up to parity with Claude Code / OpenCode / Codex: a tool-calling agent with MCP tools, reusable skills, a plugin API, and richer agentic behaviors. These all build on the existing loop — `StreamingMessageParser` + `ActionRunner` (`app/lib/runtime/`) and the provider registry (`app/lib/.server/llm/registry.ts`) — and on the WebContainer sandbox as the execution boundary.

### F1. Native tool calling (function tools) `[~]`
- **What:** move the agent from the XML-ish `<boltAction>` wire format to structured **tool calls** (`tools` + `toolChoice` in `streamText`). Today `api.chat.ts` forces `toolChoice: 'none'`; tools are parsed from text instead.
- **Touches:** `llm/stream-text.ts` (pass `tools`), `routes/api.chat.ts` (enable toolChoice), `runtime/message-parser.ts` + `runtime/action-runner.ts` (map tool calls → file/shell actions), `llm/prompts.ts` (drop the tag protocol once tools carry it).
- **How others do it:** Claude Code / Codex expose first-class `read_file`/`write_file`/`run_command` tools; the model emits typed calls, not markup.
- **Blocked on:** keeping the text-tag fallback for models without tool calling, or going tools-only.
- **Effort:** L · **Value:** High (foundational for F2–F5)

### F2. MCP (Model Context Protocol) client `[~]`
- **What:** let users register MCP servers; Bolt discovers their tools/resources and exposes them to the model as callable tools (merged with F1's native tools).
- **Touches:** new `lib/.server/mcp/` (client, server registry, capability negotiation), `llm/stream-text.ts` (merge MCP tools into the `tools` param), a settings UI to add servers, `worker-configuration.d.ts` for any MCP config.
- **Note:** MCP servers are spawned processes — Cloudflare Workers can't host them, so the MCP client should run where processes can spawn (a small sidecar service, or in-browser via MCP-over-WebSocket/SSE transports only). This is the key architecture decision.
- **How others do it:** Claude Code loads `mcpServers` from config and exposes each server's tools; OpenCode does the same via its config.
- **Blocked on:** F1 + the transport/hosting decision (Workers can't spawn subprocesses).
- **Effort:** L · **Value:** High

### F3. Skill system `[~]`
- **What:** reusable, discoverable "skills" — packaged prompt + tool bundles the agent can invoke (e.g. `/review`, `/init-deep`, a "run tests" skill). A skill = a markdown/manifest + optional tool set, loaded from the project (`.bolt/skills/`) or user dir.
- **Touches:** new `lib/skills/` (loader, registry, invocation routing), `llm/prompts.ts` (inject available skills), chat input parsing in `components/chat/` for `/skill` triggers, optional UI to browse skills.
- **How others do it:** Claude Code skills = markdown files with frontmatter + allowed-tools; OpenCode/Codex similar via agents/commands. Slash-command or auto-trigger.
- **Blocked on:** F1 (skills want to declare tools); skill manifest format decision.
- **Effort:** M · **Value:** High

### F4. Plugin API `[~]`
- **What:** a stable extension point so third parties can add providers, tools, UI panels, and hooks without forking — versioned `definePlugin()` contract with lifecycle hooks (`onChatStart`, `registerTool`, `registerProvider`, `registerPanel`).
- **Touches:** new `lib/plugins/` (loader, sandboxing, API surface), `llm/registry.ts` (provider plugins), `runtime/` (tool plugins), `components/workbench/` (panel plugins).
- **Blocked on:** F1 + F2 (plugins mostly register tools/providers); security model for running untrusted plugin code in the browser sandbox.
- **Effort:** L · **Value:** Medium-High

### F5. Subagents / parallel agentic tasks `[~]`
- **What:** spawn isolated sub-agents for delegated work (explore the codebase, run a test suite, plan) that report back to the main loop — each with its own context and a scoped WebContainer view.
- **Touches:** `runtime/` (sub-agent runner + result channel), `llm/stream-text.ts`, `lib/stores/workbench.ts` (per-agent state), optional UI to show parallel agent threads.
- **How others do it:** Claude Code `Task` subagents, OpenCode background agents, Codex parallel tool runs.
- **Blocked on:** F1; whether subagents share the WebContainer or get isolated ones (cost/isolation trade-off).
- **Effort:** L · **Value:** High

### F6. Agentic lifecycle & permissions `[~]`
- **What:** richer loop control — plan mode (propose-before-execute), auto-approve rules per tool/action, undo/rollback of agent file changes, and run-away-loop guardrails.
- **Touches:** `runtime/action-runner.ts` (approval gate + rollback via the Phase 4 diff snapshot), `lib/stores/settings.ts` (permission rules), `components/workbench/` (approve/deny UI), a plan-mode toggle in chat.
- **How others do it:** Claude Code permission modes + plan mode; Codex approval policies.
- **Blocked on:** F1; D1 (diff-review) pairs naturally here.
- **Effort:** M · **Value:** High

---

## Suggested sequencing

```
Now (no decisions needed):     E2 → E1 → B1 → D2 → E4
Next (need one decision each): A1 (providers) → A2 → A3
                              B3 (zip lib)
Agentic core (decide wire format first): F1 → F2 → F3 → F5
                                         F1 → F6 (with D1)
                                         F4 (after F1 + F2)
Blocked on auth (C2):        C2 → B2 → C1 → B4
Blocked on UX/e2e:           D1, D3, E3
```

**Recommended first sprint:** E2, E1, B1, D2 — all small, independent, no product decisions, and they harden CI + portability immediately.

**Agentic track:** the linchpin is **F1 (native tool calling)** — MCP (F2), skills (F3), plugins (F4), subagents (F5), and permissions (F6) all assume structured tool calls instead of the text-tag protocol. Decide F1's fallback strategy first, then F2's MCP transport (Workers can't spawn MCP subprocesses — browser-side MCP-over-WebSocket/SSE or a sidecar), and the rest layer on.

---

*Generated after completion of the P0–P5 hardening roadmap. Update status markers as features land.*
