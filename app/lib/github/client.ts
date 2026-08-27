import type { SpawnOptions } from '@webcontainer/api';

const GITHUB_REMOTE = 'https://github.com';
const DEFAULT_BRANCH = 'main';

export interface GitHubRepoRef {
  readonly owner: string;
  readonly repo: string;
  readonly branch?: string;
}

interface GitFileEntry {
  readonly name: string;
}

interface GitFileSystem {
  readdir(path: string, options: { readonly withFileTypes: true }): Promise<readonly GitFileEntry[]>;
  rm(path: string, options: { readonly force: true; readonly recursive: true }): Promise<void>;
}

interface GitProcess {
  readonly output: ReadableStream<string>;
  readonly exit: Promise<number>;
}

export interface GitContainer {
  readonly fs: GitFileSystem;
  readonly spawn: (command: string, args: string[], options?: SpawnOptions) => Promise<GitProcess>;
}

export class GitHubCommandError extends Error {
  readonly name = 'GitHubCommandError';

  constructor(
    readonly args: readonly string[],
    readonly exitCode: number,
    readonly output: string,
  ) {
    super(`git ${args.join(' ')} failed with exit code ${exitCode}: ${output.trim().slice(-200)}`);
  }
}

/**
 * Parses `owner/repo`, `owner/repo#branch`, or a GitHub clone URL into a repo ref.
 */
export function parseRepoRef(input: string): GitHubRepoRef {
  const normalized = input
    .trim()
    .replace(/^git@github\.com:/, '')
    .replace(/^https?:\/\/(?:www\.)?github\.com\//, '')
    .replace(/\/$/, '');
  const match = normalized.match(/^([^/\s]+)\/([^#\s]+?)(?:#(.+))?$/);

  if (!match) {
    throw new Error(`Invalid GitHub repo: ${input}`);
  }

  const [, owner, rawRepo, branch] = match;
  const repo = rawRepo.replace(/\.git$/, '');

  if (!owner || !repo) {
    throw new Error(`Invalid GitHub repo: ${input}`);
  }

  return branch ? { owner, repo, branch } : { owner, repo };
}

export class GitHubClient {
  #token: string;

  constructor(token: string) {
    this.#token = token;
  }

  async cloneIntoProject(container: GitContainer, ref: GitHubRepoRef): Promise<number> {
    const entries = await container.fs.readdir('.', { withFileTypes: true });

    for (const entry of entries) {
      await container.fs.rm(entry.name, { force: true, recursive: true });
    }

    const args = ['clone', '--quiet'];

    if (ref.branch) {
      args.push('--branch', ref.branch);
    }

    args.push(remoteUrl(ref), '.');
    await this.#run(container, args);

    const trackedFiles = await this.#run(container, ['ls-files', '-z']);

    return trackedFiles.output.split('\0').filter(Boolean).length;
  }

  async pushProject(container: GitContainer, ref: GitHubRepoRef, message: string): Promise<string> {
    const repository = await this.#tryRun(container, ['rev-parse', '--git-dir']);
    const currentBranch = await this.#tryRun(container, ['branch', '--show-current']);
    const branch = ref.branch ?? currentBranch?.trim() ?? DEFAULT_BRANCH;
    const remote = remoteUrl(ref);

    if (!repository) {
      await this.#run(container, ['init', '.']);
      await this.#run(container, ['remote', 'add', 'origin', remote]);

      const fetched = await this.#run(container, ['fetch', 'origin', branch], { allowFailure: true });

      if (fetched.exitCode === 0) {
        await this.#run(container, ['reset', '--mixed', 'FETCH_HEAD']);
      }
    } else {
      const origin = await this.#tryRun(container, ['remote', 'get-url', 'origin']);

      if (origin) {
        await this.#run(container, ['remote', 'set-url', 'origin', remote]);
      } else {
        await this.#run(container, ['remote', 'add', 'origin', remote]);
      }
    }

    await this.#run(container, ['add', '-A']);

    const staged = await this.#run(container, ['diff', '--cached', '--quiet'], { allowFailure: true });

    if (staged.exitCode === 0) {
      const currentHead = await this.#tryRun(container, ['rev-parse', 'HEAD']);

      if (currentHead) {
        return currentHead.trim();
      }
    }

    await this.#run(container, ['commit', '-m', message]);
    await this.#run(container, ['push', 'origin', `HEAD:${branch}`]);

    return (await this.#run(container, ['rev-parse', 'HEAD'])).output.trim();
  }

  async #tryRun(container: GitContainer, args: readonly string[]): Promise<string | undefined> {
    const result = await this.#run(container, args, { allowFailure: true });

    return result.exitCode === 0 && result.output.trim() ? result.output : undefined;
  }

  async #run(
    container: GitContainer,
    args: readonly string[],
    options: { readonly allowFailure?: boolean } = {},
  ): Promise<GitCommandResult> {
    const spawnOptions: SpawnOptions = { env: gitEnvironment(this.#token) };
    const process = await container.spawn('git', [...args], spawnOptions);
    const exitCode = await process.exit;
    const output = await readProcessOutput(process.output);
    const result = { exitCode, output };

    if (exitCode !== 0 && !options.allowFailure) {
      throw new GitHubCommandError(args, exitCode, output);
    }

    return result;
  }
}

interface GitCommandResult {
  readonly exitCode: number;
  readonly output: string;
}

function remoteUrl(ref: GitHubRepoRef): string {
  return `${GITHUB_REMOTE}/${ref.owner}/${ref.repo}.git`;
}

function gitEnvironment(token: string): Record<string, string> {
  return {
    GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.extraHeader',
    GIT_CONFIG_VALUE_0: `Authorization: Bearer ${token}`,
    GIT_AUTHOR_NAME: 'Bolt',
    GIT_AUTHOR_EMAIL: 'bolt@localhost',
    GIT_COMMITTER_NAME: 'Bolt',
    GIT_COMMITTER_EMAIL: 'bolt@localhost',
  };
}

async function readProcessOutput(output: ReadableStream<string>): Promise<string> {
  const reader = output.getReader();
  let result = '';

  while (true) {
    const chunk = await reader.read();

    if (chunk.done) {
      return result;
    }

    result += chunk.value;
  }
}
