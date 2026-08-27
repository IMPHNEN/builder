import { map, type MapStore } from 'nanostores';
import * as nodePath from 'node:path';
import type { BoltAction } from '~/types/actions';
import { createScopedLogger } from '~/utils/logger';
import { unreachable } from '~/utils/unreachable';
import { withResolvers } from '~/utils/promises';
import type { ActionCallbackData } from './message-parser';

const logger = createScopedLogger('ActionRunner');

export type ActionStatus = 'pending' | 'awaiting-approval' | 'running' | 'complete' | 'aborted' | 'rejected' | 'failed';

export type BaseActionState = BoltAction & {
  status: Exclude<ActionStatus, 'failed'>;
  abort: () => void;
  executed: boolean;
  abortSignal: AbortSignal;
};

export type FailedActionState = BoltAction &
  Omit<BaseActionState, 'status'> & {
    status: Extract<ActionStatus, 'failed'>;
    error: string;
  };

export type ActionState = BaseActionState | FailedActionState;

interface ActionProcess {
  readonly output: ReadableStream<string>;
  readonly exit: Promise<number>;
  readonly kill: () => void;
}

export interface ActionRunnerWebContainer {
  readonly workdir: string;
  readonly fs: {
    readonly mkdir: (path: string, options: { readonly recursive: true }) => Promise<string>;
    readonly writeFile: (path: string, data: string) => Promise<void>;
  };
  readonly spawn: (
    command: string,
    args: string[],
    options?: { readonly env?: Record<string, string | number | boolean> },
  ) => Promise<ActionProcess>;
}

type BaseActionUpdate = Partial<Pick<BaseActionState, 'status' | 'abort' | 'executed' | 'content'>>;

export type ActionStateUpdate =
  | BaseActionUpdate
  | (Omit<BaseActionUpdate, 'status'> & { status: 'failed'; error: string });

type ActionsMap = MapStore<Record<string, ActionState>>;

export class ActionRunner {
  #webcontainer: Promise<ActionRunnerWebContainer>;
  #currentExecutionPromise: Promise<void> = Promise.resolve();
  #pendingApprovals = new Map<string, PromiseWithResolvers<ActionDecision>>();
  #onStateChange?: () => void;

  actions: ActionsMap = map({});

  constructor(webcontainerPromise: Promise<ActionRunnerWebContainer>, onStateChange?: () => void) {
    this.#webcontainer = webcontainerPromise;
    this.#onStateChange = onStateChange;
  }

  addAction(data: ActionCallbackData) {
    const { actionId } = data;

    const actions = this.actions.get();
    const action = actions[actionId];

    if (action) {
      // token-limit continue re-emits `onActionOpen` for the in-progress action; append, don't drop
      if (!action.executed && action.status === 'pending' && typeof data.action.content === 'string') {
        this.#updateAction(actionId, { content: action.content + data.action.content });
      }

      return;
    }

    const abortController = new AbortController();

    this.actions.setKey(actionId, {
      ...data.action,
      status: 'pending',
      executed: false,
      abort: () => {
        abortController.abort();
        this.#pendingApprovals.get(actionId)?.resolve('aborted');
        this.#updateAction(actionId, { status: 'aborted' });
      },
      abortSignal: abortController.signal,
    });

    this.#currentExecutionPromise.then(() => {
      if (this.actions.get()[actionId]?.status === 'pending') {
        this.#updateAction(actionId, { status: 'running' });
      }
    });
  }

  runAction(data: ActionCallbackData) {
    const { actionId } = data;
    const action = this.actions.get()[actionId];

    if (!action) {
      unreachable(`Action ${actionId} not found`);
    }

    if (action.executed) {
      return this.#currentExecutionPromise;
    }

    const updatedAction = { ...action, ...data.action, executed: true };

    if (action.type === 'file') {
      this.#updateAction(actionId, { ...updatedAction, status: 'awaiting-approval' });

      const approval = withResolvers<ActionDecision>();
      this.#pendingApprovals.set(actionId, approval);
      this.#currentExecutionPromise = this.#currentExecutionPromise
        .then(async () => {
          const decision = await this.#awaitApproval(actionId, approval.promise);

          if (decision !== 'approved') {
            this.#updateAction(actionId, { status: decision });

            return;
          }

          await this.#executeAction(actionId);
        })
        .catch((error) => {
          console.error('Action failed:', error);
        });

      return this.#currentExecutionPromise;
    }

    this.#updateAction(actionId, updatedAction);

    this.#currentExecutionPromise = this.#currentExecutionPromise
      .then(() => {
        return this.#executeAction(actionId);
      })
      .catch((error) => {
        console.error('Action failed:', error);
      });

    return this.#currentExecutionPromise;
  }

  async #executeAction(actionId: string) {
    const action = this.actions.get()[actionId];

    this.#updateAction(actionId, { status: 'running' });

    try {
      switch (action.type) {
        case 'shell': {
          await this.#runShellAction(action);
          break;
        }
        case 'file': {
          await this.#runFileAction(action);
          break;
        }
      }

      const status = action.abortSignal.aborted ? 'aborted' : 'complete';

      this.#updateAction(actionId, { status });

      logger.debug(`event=action.${status} actionId=${actionId} type=${action.type}`);
    } catch (error) {
      this.#updateAction(actionId, { status: 'failed', error: 'Action failed' });

      logger.error(`event=action.failed actionId=${actionId} type=${action.type}`, error);

      // re-throw the error to be caught in the promise chain
      throw error;
    }
  }

  approveAction(actionId: string) {
    this.#pendingApprovals.get(actionId)?.resolve('approved');
  }

  rejectAction(actionId: string) {
    const approval = this.#pendingApprovals.get(actionId);

    approval?.resolve('rejected');

    if (approval) {
      this.#updateAction(actionId, { status: 'rejected' });
    }
  }

  async #awaitApproval(actionId: string, promise: Promise<ActionDecision>): Promise<ActionDecision> {
    try {
      return await promise;
    } finally {
      this.#pendingApprovals.delete(actionId);
    }
  }

  async #runShellAction(action: ActionState) {
    if (action.type !== 'shell') {
      unreachable('Expected shell action');
    }

    const webcontainer = await this.#webcontainer;

    const process = await webcontainer.spawn('jsh', ['-c', action.content], {
      env: { npm_config_yes: true },
    });

    action.abortSignal.addEventListener('abort', () => {
      process.kill();
    });

    process.output.pipeTo(
      new WritableStream({
        write(data) {
          console.log(data);
        },
      }),
    );

    const exitCode = await process.exit;

    logger.debug(`Process terminated with code ${exitCode}`);
  }

  async #runFileAction(action: ActionState) {
    if (action.type !== 'file') {
      unreachable('Expected file action');
    }

    const webcontainer = await this.#webcontainer;

    const containerRelativePath = nodePath.isAbsolute(action.filePath)
      ? nodePath.relative(webcontainer.workdir, action.filePath)
      : action.filePath;

    let folder = nodePath.dirname(containerRelativePath);

    // remove trailing slashes
    folder = folder.replace(/\/+$/g, '');

    if (folder !== '.') {
      try {
        await webcontainer.fs.mkdir(folder, { recursive: true });
        logger.debug('Created folder', folder);
      } catch (error) {
        logger.error('Failed to create folder\n\n', error);
      }
    }

    try {
      await webcontainer.fs.writeFile(containerRelativePath, action.content);
      logger.debug(`File written ${containerRelativePath}`);
    } catch (error) {
      logger.error('Failed to write file\n\n', error);
    }
  }

  #updateAction(id: string, newState: ActionStateUpdate) {
    const actions = this.actions.get();

    this.actions.setKey(id, { ...actions[id], ...newState });
    this.#onStateChange?.();
  }
}

type ActionDecision = 'approved' | 'rejected' | 'aborted';
