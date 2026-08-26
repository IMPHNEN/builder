import type { WebContainer } from '@webcontainer/api';
import { describe, expect, it, vi } from 'vitest';
import type { ActionCallbackData } from './message-parser';
import { ActionRunner } from './action-runner';

const webcontainerPromise = Promise.resolve({} as WebContainer);

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
});
