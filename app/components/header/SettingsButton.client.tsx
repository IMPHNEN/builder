import { useState } from 'react';
import { Dialog, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { IconButton } from '~/components/ui/IconButton';
import { ProviderRegistryPanel } from './ProviderRegistryPanel.client';

export function SettingsButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <IconButton icon="i-ph:gear-six" title="Model and provider settings" onClick={() => setOpen(true)} />
      <DialogRoot open={open} onOpenChange={setOpen}>
        <Dialog onBackdrop={() => setOpen(false)} onClose={() => setOpen(false)} className="max-w-[680px]">
          <DialogTitle>Model and provider registry</DialogTitle>
          <ProviderRegistryPanel open={open} />
        </Dialog>
      </DialogRoot>
    </>
  );
}
