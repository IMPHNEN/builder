import { useState } from 'react';
import { toast } from 'react-toastify';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { getGitHubToken, setGitHubToken } from '~/lib/stores/provider';
import { workbenchStore } from '~/lib/stores/workbench';

interface GitHubDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GitHubDialog({ open, onOpenChange }: GitHubDialogProps) {
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState(getGitHubToken() ?? '');
  const [commitMessage, setCommitMessage] = useState('');
  const [busy, setBusy] = useState<'import' | 'export' | null>(null);

  const close = () => onOpenChange(false);

  const persistToken = () => {
    setGitHubToken(token.trim());
  };

  const run = async (kind: 'import' | 'export') => {
    if (!repo.trim()) {
      toast.error('Enter a repo (owner/name or GitHub URL)');

      return;
    }

    if (kind === 'import' && !window.confirm('Importing replaces the current project files. Continue?')) {
      return;
    }

    persistToken();
    setBusy(kind);

    try {
      if (kind === 'import') {
        const count = await workbenchStore.importFromGitHub(repo.trim());

        toast.success(`Imported ${count} files from GitHub`);
      } else {
        const sha = await workbenchStore.exportToGitHub(repo.trim(), commitMessage.trim() || undefined);

        toast.success(`Pushed to GitHub (${sha.slice(0, 7)})`);
      }

      close();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `GitHub ${kind} failed`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <Dialog onBackdrop={close} onClose={close} className="max-w-[480px]">
        <DialogTitle>GitHub</DialogTitle>
        <DialogDescription asChild>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="github-repository" className="text-sm text-bolt-elements-textSecondary">
                Repository
              </label>
              <input
                id="github-repository"
                value={repo}
                onChange={(event) => setRepo(event.target.value)}
                placeholder="owner/name or https://github.com/owner/name"
                className="w-full bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-md px-3 py-2 text-sm text-bolt-elements-textPrimary outline-none font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="github-token" className="text-sm text-bolt-elements-textSecondary">
                Personal access token
              </label>
              <input
                id="github-token"
                type="password"
                autoComplete="off"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="ghp_... (stored locally in your browser)"
                className="w-full bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-md px-3 py-2 text-sm text-bolt-elements-textPrimary outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-bolt-elements-textSecondary">
                Commit message{' '}
                <span className="text-bolt-elements-textTertiary">(export only — blank = auto-generate)</span>
              </label>
              <input
                value={commitMessage}
                onChange={(event) => setCommitMessage(event.target.value)}
                placeholder="feat: add new feature (auto-generated if empty)"
                className="w-full bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-md px-3 py-2 text-sm text-bolt-elements-textPrimary outline-none"
              />
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <DialogButton type="secondary" onClick={() => run('import')} disabled={busy !== null}>
                {busy === 'import' ? 'Importing…' : 'Import from GitHub'}
              </DialogButton>
              <DialogButton type="primary" onClick={() => run('export')} disabled={busy !== null}>
                {busy === 'export' ? 'Pushing…' : 'Push to GitHub'}
              </DialogButton>
            </div>
          </div>
        </DialogDescription>
      </Dialog>
    </DialogRoot>
  );
}
