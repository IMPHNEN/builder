import { describe, expect, it, vi } from 'vitest';
import type { ActionCallbackData } from './message-parser';
import { ActionRunner, type ActionRunnerWebContainer } from './action-runner';

const webcontainerPromise = Promise.resolve({
  workdir: '/home/project',
  fs: {
    mkdir: async () => '/home/project',
    writeFile: async () => undefined,
  },
  spawn: async () => ({
    output: new ReadableStream<string>({ start: (controller) => controller.close() }),
    exit: Promise.resolve(0),
    kill: vi.fn(),
  }),
} satisfies ActionRunnerWebContainer);

function fileActionData(content: string): ActionCallbackData {
  return {
    artifactId: 'artifact_1',
    messageId: 'message_1',
    actionId: '0',
    action: { type: 'file', filePath: 'index.js', content },
  };
}

describe('ActionRunner', () => {
  it('should register a new action as pending', () => {
    const runner = new ActionRunner(webcontainerPromise);

    runner.addAction(fileActionData(''));

    const action = runner.actions.get()['0'];

    expect(action.status).toBe('pending');
    expect(action.executed).toBe(false);
  });

  it('should append continued content to a pending action instead of dropping it', () => {
    const runner = new ActionRunner(webcontainerPromise);

    runner.addAction(fileActionData('first part'));
    runner.addAction(fileActionData(' second part'));

    const action = runner.actions.get()['0'];

    expect(action.content).toBe('first part second part');
    expect(action.executed).toBe(false);
  });

  it('should not modify content once the action has executed', () => {
    const runner = new ActionRunner(webcontainerPromise);

    runner.addAction(fileActionData('first part'));
    runner.runAction(fileActionData('first part'));
    runner.addAction(fileActionData(' second part'));

    const action = runner.actions.get()['0'];

    expect(action.content).toBe('first part');
    expect(action.executed).toBe(true);
  });

  it('should mark a pending action as aborted when abort is called', () => {
    const runner = new ActionRunner(webcontainerPromise);

    runner.addAction(fileActionData('content'));

    const action = runner.actions.get()['0'];
    const abortSpy = vi.spyOn(action, 'abort');

    action.abort();

    expect(abortSpy).toHaveBeenCalled();
    expect(runner.actions.get()['0'].status).toBe('aborted');
  });

  it('should wait for approval before writing a file action', async () => {
    const writeFile = vi.fn(async () => undefined);
    const webcontainer = {
      workdir: '/home/project',
      fs: { mkdir: async () => '/home/project', writeFile },
      spawn: async () => ({
        output: new ReadableStream({ start: (controller) => controller.close() }),
        exit: Promise.resolve(0),
        kill: vi.fn(),
      }),
    } satisfies ActionRunnerWebContainer;
    const runner = new ActionRunner(Promise.resolve(webcontainer));

    runner.addAction(fileActionData('approved content'));
    const execution = runner.runAction(fileActionData('approved content'));

    await Promise.resolve();
    expect(runner.actions.get()['0'].status).toBe('awaiting-approval');
    expect(writeFile).not.toHaveBeenCalled();

    runner.approveAction('0');
    await execution;

    expect(writeFile).toHaveBeenCalledWith('index.js', 'approved content');
    expect(runner.actions.get()['0'].status).toBe('complete');
  });

  it('should reject a staged file action without writing it', async () => {
    const writeFile = vi.fn(async () => undefined);
    const webcontainer = {
      workdir: '/home/project',
      fs: { mkdir: async () => '/home/project', writeFile },
      spawn: async () => ({
        output: new ReadableStream({ start: (controller) => controller.close() }),
        exit: Promise.resolve(0),
        kill: vi.fn(),
      }),
    } satisfies ActionRunnerWebContainer;
    const runner = new ActionRunner(Promise.resolve(webcontainer));

    runner.addAction(fileActionData('rejected content'));
    const execution = runner.runAction(fileActionData('rejected content'));
    await Promise.resolve();

    runner.rejectAction('0');
    await execution;

    expect(writeFile).not.toHaveBeenCalled();
    expect(runner.actions.get()['0'].status).toBe('rejected');
  });
});
