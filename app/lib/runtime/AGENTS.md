# app/lib/runtime — KNOWLEDGE BASE

The agent execution loop: parse the LLM stream, then run the actions it describes. Deliberately split into a **pure, testable parser** and a **side-effecting runner**.

## OVERVIEW

One line: turns raw streamed model text into executed file-writes and shell commands inside the WebContainer.

## STRUCTURE

```
runtime/
├── message-parser.ts            # StreamingMessageParser — chunk-safe, stateful per messageId
├── action-runner.ts             # ActionRunner — executes parsed actions against WebContainer
├── message-parser.spec.ts       # vitest unit tests
├── message-parser.spec.ts.snap  # snapshot of expected parse output
└── __snapshots__/               # vitest snapshot dir
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Change the `<boltArtifact>`/`<boltAction>` protocol | `message-parser.ts` | tag constants at top; parser is a hand-rolled state machine |
| Change how actions execute | `action-runner.ts` | `#runFileAction` (write+mkdir) / `#runShellAction` (`jsh -c`) |
| Action lifecycle/status | `action-runner.ts` | `pending -> running -> complete/aborted/failed` |
| Add/verify parse behavior | `message-parser.spec.ts` + `.snap` | update snapshot after intentional protocol changes |

## CONVENTIONS (delta from root)

- **Parser stays pure**: `StreamingMessageParser.parse(messageId, input)` only emits callbacks (`onArtifactOpen/Close`, `onActionOpen/Close`) + returns transformed output text. No WebContainer, no stores, no I/O.
- **Runner is the only side-effector**: `ActionRunner` receives `ActionCallbackData` and performs FS/process work. Keep that wall intact.
- **Streaming-incremental**: `parse` is called repeatedly with the *cumulative* input; internal `MessageState.position` tracks progress, so partial tags across chunks are handled — don't re-chunk or reset per call.
- **Actions are serialized**: `runAction` chains onto `#currentExecutionPromise`, so actions run in order, one at a time.
- **Every action is abortable** via `AbortController`; `abortSignal` is threaded into process kill and status.

## ANTI-PATTERNS (THIS DIR)

- **DO NOT add side effects to `StreamingMessageParser`** — it's unit/snapshot-tested precisely because it's pure.
- **DO NOT parse model output with regex elsewhere** — extend the state machine here instead.
- **DO NOT run actions concurrently** — ordering is load-bearing (e.g. `npm install` before `npm run dev`).
- **DO NOT swallow action errors silently** — `#executeAction` sets `status: 'failed'` and re-throws into the chain; preserve that.
- **DO NOT change tag names without updating `prompts.ts` + the snapshot** — the LLM system prompt and this parser must agree on the wire format.
