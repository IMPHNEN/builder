import { atom, map, type MapStore, type ReadableAtom, type WritableAtom } from 'nanostores';
import type { EditorDocument, ScrollPosition } from '~/components/editor/codemirror/CodeMirrorEditor';
import { ActionRunner } from '~/lib/runtime/action-runner';
import type { ActionCallbackData, ArtifactCallbackData } from '~/lib/runtime/message-parser';
import { webcontainer } from '~/lib/webcontainer';
import type { ITerminal } from '~/types/terminal';
import { diffFiles } from '~/utils/diff';
import { WORK_DIR } from '~/utils/constants';
import { unreachable } from '~/utils/unreachable';
import { exportGitHubProject, importGitHubProject } from '~/lib/github/project';
import { EditorStore } from './editor';
import { FilesStore, type FileMap } from './files';
import { PreviewsStore } from './previews';
import { TerminalStore } from './terminal';

export interface ArtifactState {
  id: string;
  title: string;
  closed: boolean;
  runner: ActionRunner;
}

export type ArtifactUpdateState = Pick<ArtifactState, 'title' | 'closed'>;

type Artifacts = MapStore<Record<string, ArtifactState>>;

export type WorkbenchViewType = 'code' | 'preview';

export interface PendingFileReview {
  readonly messageId: string;
  readonly actionId: string;
  readonly filePath: string;
  readonly currentContent: string;
  readonly proposedContent: string;
  readonly diff: string;
}

export class WorkbenchStore {
  #previewsStore = new PreviewsStore(webcontainer);
  #filesStore = new FilesStore(webcontainer);
  #editorStore = new EditorStore(this.#filesStore);
  #terminalStore = new TerminalStore(webcontainer);

  artifacts: Artifacts = import.meta.hot?.data.artifacts ?? map({});

  showWorkbench: WritableAtom<boolean> = import.meta.hot?.data.showWorkbench ?? atom(false);
  currentView: WritableAtom<WorkbenchViewType> = import.meta.hot?.data.currentView ?? atom('code');
  unsavedFiles: WritableAtom<Set<string>> = import.meta.hot?.data.unsavedFiles ?? atom(new Set<string>());
  pendingFileReviews: WritableAtom<PendingFileReview[]> =
    import.meta.hot?.data.pendingFileReviews ?? atom<PendingFileReview[]>([]);
  modifiedFiles = new Set<string>();
  artifactIdList: string[] = [];

  constructor() {
    if (import.meta.hot) {
      import.meta.hot.data.artifacts = this.artifacts;
      import.meta.hot.data.unsavedFiles = this.unsavedFiles;
      import.meta.hot.data.showWorkbench = this.showWorkbench;
      import.meta.hot.data.currentView = this.currentView;
      import.meta.hot.data.pendingFileReviews = this.pendingFileReviews;
    }

    this.#filesStore.files.subscribe(() => this.#refreshFileReviews());
  }

  get previews() {
    return this.#previewsStore.previews;
  }

  get files() {
    return this.#filesStore.files;
  }

  get currentDocument(): ReadableAtom<EditorDocument | undefined> {
    return this.#editorStore.currentDocument;
  }

  get selectedFile(): ReadableAtom<string | undefined> {
    return this.#editorStore.selectedFile;
  }

  get firstArtifact(): ArtifactState | undefined {
    return this.#getArtifact(this.artifactIdList[0]);
  }

  get filesCount(): number {
    return this.#filesStore.filesCount;
  }

  get showTerminal() {
    return this.#terminalStore.showTerminal;
  }

  toggleTerminal(value?: boolean) {
    this.#terminalStore.toggleTerminal(value);
  }

  attachTerminal(terminal: ITerminal) {
    this.#terminalStore.attachTerminal(terminal);
  }

  onTerminalResize(cols: number, rows: number) {
    this.#terminalStore.onTerminalResize(cols, rows);
  }

  setDocuments(files: FileMap) {
    this.#editorStore.setDocuments(files);

    if (this.#filesStore.filesCount > 0 && this.currentDocument.get() === undefined) {
      // we find the first file and select it
      for (const [filePath, dirent] of Object.entries(files)) {
        if (dirent?.type === 'file') {
          this.setSelectedFile(filePath);
          break;
        }
      }
    }
  }

  setShowWorkbench(show: boolean) {
    this.showWorkbench.set(show);
  }

  setCurrentDocumentContent(newContent: string) {
    const filePath = this.currentDocument.get()?.filePath;

    if (!filePath) {
      return;
    }

    const originalContent = this.#filesStore.getFile(filePath)?.content;
    const unsavedChanges = originalContent !== undefined && originalContent !== newContent;

    this.#editorStore.updateFile(filePath, newContent);

    const currentDocument = this.currentDocument.get();

    if (currentDocument) {
      const previousUnsavedFiles = this.unsavedFiles.get();

      if (unsavedChanges && previousUnsavedFiles.has(currentDocument.filePath)) {
        return;
      }

      const newUnsavedFiles = new Set(previousUnsavedFiles);

      if (unsavedChanges) {
        newUnsavedFiles.add(currentDocument.filePath);
      } else {
        newUnsavedFiles.delete(currentDocument.filePath);
      }

      this.unsavedFiles.set(newUnsavedFiles);
    }
  }

  setCurrentDocumentScrollPosition(position: ScrollPosition) {
    const editorDocument = this.currentDocument.get();

    if (!editorDocument) {
      return;
    }

    const { filePath } = editorDocument;

    this.#editorStore.updateScrollPosition(filePath, position);
  }

  setSelectedFile(filePath: string | undefined) {
    this.#editorStore.setSelectedFile(filePath);
  }

  async saveFile(filePath: string) {
    const documents = this.#editorStore.documents.get();
    const document = documents[filePath];

    if (document === undefined) {
      return;
    }

    await this.#filesStore.saveFile(filePath, document.value);

    const newUnsavedFiles = new Set(this.unsavedFiles.get());
    newUnsavedFiles.delete(filePath);

    this.unsavedFiles.set(newUnsavedFiles);
  }

  async saveCurrentDocument() {
    const currentDocument = this.currentDocument.get();

    if (currentDocument === undefined) {
      return;
    }

    await this.saveFile(currentDocument.filePath);
  }

  resetCurrentDocument() {
    const currentDocument = this.currentDocument.get();

    if (currentDocument === undefined) {
      return;
    }

    const { filePath } = currentDocument;
    const file = this.#filesStore.getFile(filePath);

    if (!file) {
      return;
    }

    this.setCurrentDocumentContent(file.content);
  }

  async saveAllFiles() {
    for (const filePath of this.unsavedFiles.get()) {
      await this.saveFile(filePath);
    }
  }

  getFileModifcations() {
    return this.#filesStore.getFileModifications();
  }

  getFileModificationResult() {
    return this.#filesStore.getFileModificationResult();
  }

  resetAllFileModifications() {
    this.#filesStore.resetFileModifications();
  }

  abortAllActions() {
    for (const artifact of Object.values(this.artifacts.get())) {
      for (const action of Object.values(artifact.runner.actions.get())) {
        if (!action.executed || action.status === 'running' || action.status === 'awaiting-approval') {
          action.abort();
        }
      }
    }
  }

  /**
   * Imports a GitHub repo into the WebContainer filesystem. The FS watcher picks
   * the new files up into the FileMap automatically.
   */
  async importFromGitHub(repoInput: string) {
    const container = await webcontainer;

    return importGitHubProject(repoInput, container);
  }

  /**
   * Pushes the current project files to a GitHub repo as a single commit. When no
   * commit message is given, one is generated from the current file modifications
   * via the active model, falling back to a default on any failure.
   */
  async exportToGitHub(repoInput: string, message?: string) {
    const container = await webcontainer;

    return exportGitHubProject({
      repoInput,
      message,
      container,
      filesStore: this.#filesStore,
      saveAllFiles: () => this.saveAllFiles(),
    });
  }

  addArtifact({ messageId, title, id }: ArtifactCallbackData) {
    const artifact = this.#getArtifact(messageId);

    if (artifact) {
      return;
    }

    if (!this.artifactIdList.includes(messageId)) {
      this.artifactIdList.push(messageId);
    }

    this.artifacts.setKey(messageId, {
      id,
      title,
      closed: false,
      runner: new ActionRunner(webcontainer, () => this.#refreshFileReviews()),
    });
  }

  updateArtifact({ messageId }: ArtifactCallbackData, state: Partial<ArtifactUpdateState>) {
    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      return;
    }

    this.artifacts.setKey(messageId, { ...artifact, ...state });
  }

  async addAction(data: ActionCallbackData) {
    const { messageId } = data;

    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      unreachable('Artifact not found');
    }

    artifact.runner.addAction(data);
  }

  async runAction(data: ActionCallbackData) {
    const { messageId } = data;

    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      unreachable('Artifact not found');
    }

    artifact.runner.runAction(data);
  }

  approveFileAction(messageId: string, actionId: string) {
    this.#getArtifact(messageId)?.runner.approveAction(actionId);
  }

  rejectFileAction(messageId: string, actionId: string) {
    this.#getArtifact(messageId)?.runner.rejectAction(actionId);
  }

  #refreshFileReviews() {
    const reviews: PendingFileReview[] = [];

    for (const [messageId, artifact] of Object.entries(this.artifacts.get())) {
      for (const [actionId, action] of Object.entries(artifact.runner.actions.get())) {
        if (action.type !== 'file' || action.status !== 'awaiting-approval') {
          continue;
        }

        const filePath = projectFilePath(action.filePath);
        const currentContent = this.#filesStore.getFile(filePath)?.content ?? '';
        const diff = diffFiles(action.filePath, currentContent, action.content) ?? action.content;

        reviews.push({
          messageId,
          actionId,
          filePath: action.filePath,
          currentContent,
          proposedContent: action.content,
          diff,
        });
      }
    }

    this.pendingFileReviews.set(reviews);
  }

  #getArtifact(id: string) {
    const artifacts = this.artifacts.get();
    return artifacts[id];
  }
}

export const workbenchStore = new WorkbenchStore();

function projectFilePath(filePath: string): string {
  if (filePath.startsWith(WORK_DIR)) {
    return filePath;
  }

  return `${WORK_DIR}/${filePath.replace(/^\/+/, '').replace(/^\.\//, '')}`;
}
