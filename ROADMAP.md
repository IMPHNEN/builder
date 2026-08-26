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

## Suggested sequencing

```
Now (no decisions needed):   E2 → E1 → B1 → D2 → E4
Next (need one decision each): A1 (providers) → A2 → A3
                              B3 (zip lib) 
Blocked on auth (C2):        C2 → B2 → C1 → B4
Blocked on UX/e2e:           D1, D3, E3
```

**Recommended first sprint:** E2, E1, B1, D2 — all small, independent, no product decisions, and they harden CI + portability immediately.

---

*Generated after completion of the P0–P5 hardening roadmap. Update status markers as features land.*
