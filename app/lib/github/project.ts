import type { WebContainer } from '@webcontainer/api';
import { getGitHubToken, getProviderSettings, getSelectedModel } from '~/lib/stores/provider';
import type { FilesStore } from '~/lib/stores/files';
import { fileModificationsToHTML } from '~/utils/diff';
import { GitHubClient, parseRepoRef } from './client';

export async function importGitHubProject(repoInput: string, container: WebContainer): Promise<number> {
  const client = new GitHubClient(requireGitHubToken());

  return client.cloneIntoProject(container, parseRepoRef(repoInput));
}

interface ExportGitHubProjectOptions {
  readonly repoInput: string;
  readonly message: string | undefined;
  readonly container: WebContainer;
  readonly filesStore: FilesStore;
  readonly saveAllFiles: () => Promise<void>;
}

export async function exportGitHubProject({
  repoInput,
  message,
  container,
  filesStore,
  saveAllFiles,
}: ExportGitHubProjectOptions): Promise<string> {
  await saveAllFiles();

  const commitMessage = message ?? (await generateCommitMessage(filesStore));
  const client = new GitHubClient(requireGitHubToken());

  return client.pushProject(container, parseRepoRef(repoInput), commitMessage);
}

function requireGitHubToken(): string {
  const token = getGitHubToken();

  if (!token) {
    throw new Error('Add a GitHub token in Model settings first');
  }

  return token;
}

async function generateCommitMessage(filesStore: FilesStore): Promise<string> {
  const fallback = `chore: update project from Bolt (${new Date().toISOString().slice(0, 10)})`;

  try {
    const modifications = filesStore.getFileModifications();
    const diff = modifications ? fileModificationsToHTML(modifications) : undefined;
    const response = await fetch('/api/commit-message', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        diff,
        model: getSelectedModel(),
        providerConfigs: getProviderSettings(),
      }),
    });

    if (!response.ok) {
      return fallback;
    }

    const text = (await response.text()).trim().split('\n')[0]?.trim();

    return text || fallback;
  } catch (error) {
    if (error instanceof Error) {
      return fallback;
    }

    throw error;
  }
}
