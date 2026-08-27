import type { SpawnOptions } from '@webcontainer/api';
import { describe, expect, it } from 'vitest';
import { GitHubClient, parseRepoRef } from './client';

interface SpawnCall {
  readonly args: readonly string[];
  readonly options?: SpawnOptions;
}

function streamFrom(chunks: readonly string[]): ReadableStream<string> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }

      controller.close();
    },
  });
}

describe('parseRepoRef', () => {
  it('should parse a repository URL and optional branch', () => {
    expect(parseRepoRef('https://github.com/acme/widget.git#develop')).toEqual({
      owner: 'acme',
      repo: 'widget',
      branch: 'develop',
    });
  });
});

describe('GitHubClient', () => {
  it('should clone into the WebContainer without putting the token in the URL', async () => {
    const calls: SpawnCall[] = [];
    const removed: string[] = [];
    const container = {
      fs: {
        readdir: async () => [{ name: 'old.txt' }],
        rm: async (path: string) => {
          removed.push(path);
        },
      },
      spawn: async (_command: string, args: string[], options?: SpawnOptions) => {
        calls.push({ args, options });

        return {
          output: streamFrom(args[0] === 'ls-files' ? ['index.html\0src/app.ts\0'] : []),
          exit: Promise.resolve(0),
        };
      },
    } satisfies Parameters<GitHubClient['cloneIntoProject']>[0];

    const count = await new GitHubClient('oauth-token').cloneIntoProject(container, {
      owner: 'acme',
      repo: 'widget',
      branch: 'develop',
    });

    expect(removed).toEqual(['old.txt']);
    expect(calls[0]?.args).toEqual([
      'clone',
      '--quiet',
      '--branch',
      'develop',
      'https://github.com/acme/widget.git',
      '.',
    ]);
    expect(calls[0]?.args.join(' ')).not.toContain('oauth-token');
    expect(calls[0]?.options?.env?.GIT_CONFIG_VALUE_0).toBe('Authorization: Bearer oauth-token');
    expect(count).toBe(2);
  });

  it('should commit and push the WebContainer project with the OAuth token in the environment', async () => {
    const calls: SpawnCall[] = [];
    const container = {
      fs: {
        readdir: async () => [],
        rm: async () => undefined,
      },
      spawn: async (_command: string, args: string[], options?: SpawnOptions) => {
        calls.push({ args, options });

        const output = args[0] === 'branch' ? 'main\n' : args[0] === 'rev-parse' ? 'abc123\n' : '';
        const exit = args[0] === 'diff' ? 1 : 0;

        return { output: streamFrom([output]), exit: Promise.resolve(exit) };
      },
    } satisfies Parameters<GitHubClient['pushProject']>[0];

    const sha = await new GitHubClient('oauth-token').pushProject(
      container,
      { owner: 'acme', repo: 'widget' },
      'feat: export project',
    );

    expect(calls.map(({ args }) => args[0])).toEqual([
      'rev-parse',
      'branch',
      'remote',
      'remote',
      'add',
      'diff',
      'commit',
      'push',
      'rev-parse',
    ]);
    expect(calls.find(({ args }) => args[0] === 'push')?.args).toEqual(['push', 'origin', 'HEAD:main']);
    expect(calls.find(({ args }) => args[0] === 'push')?.options?.env?.GIT_CONFIG_VALUE_0).toBe(
      'Authorization: Bearer oauth-token',
    );
    expect(sha).toBe('abc123');
  });
});
