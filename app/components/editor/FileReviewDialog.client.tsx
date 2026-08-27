import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { workbenchStore, type PendingFileReview } from '~/lib/stores/workbench';

interface FileReviewDialogProps {
  readonly review: PendingFileReview | undefined;
}

export function FileReviewDialog({ review }: FileReviewDialogProps) {
  if (!review) {
    return null;
  }

  const reject = () => workbenchStore.rejectFileAction(review.messageId, review.actionId);
  const approve = () => workbenchStore.approveFileAction(review.messageId, review.actionId);

  return (
    <DialogRoot
      open
      onOpenChange={(open) => {
        if (!open) {
          reject();
        }
      }}
    >
      <Dialog onBackdrop={reject} onClose={reject} className="max-w-[760px]">
        <DialogTitle>Review file change</DialogTitle>
        <DialogDescription asChild>
          <div className="space-y-1">
            <p className="text-sm text-bolt-elements-textPrimary">
              The model proposes an update to <code className="font-mono">{review.filePath}</code>.
            </p>
            <p className="text-xs text-bolt-elements-textTertiary">Accept it to continue the action queue.</p>
          </div>
        </DialogDescription>
        <div className="mx-5 max-h-[50vh] overflow-auto rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-4">
          <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-bolt-elements-textPrimary">
            {review.diff}
          </pre>
        </div>
        <div className="flex justify-end gap-2 bg-bolt-elements-background-depth-2 px-5 py-4">
          <DialogButton type="danger" onClick={reject}>
            Reject
          </DialogButton>
          <DialogButton type="primary" onClick={approve}>
            Accept change
          </DialogButton>
        </div>
      </Dialog>
    </DialogRoot>
  );
}
