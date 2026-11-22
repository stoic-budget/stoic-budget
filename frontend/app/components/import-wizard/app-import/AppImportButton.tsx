'use client';

import { useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import { AppImportDialog } from './AppImportDialog';

/** Opens the import from another app; the host decides how the trigger looks. */
export function AppImportButton({
  renderTrigger,
}: {
  renderTrigger: (open: () => void, label: string) => React.ReactNode;
}): React.JSX.Element {
  const t = useIntlayer('appImport');
  const [open, setOpen] = useState(false);
  return (
    <>
      {renderTrigger(() => setOpen(true), t.button.value)}
      {open && <AppImportDialog isOpen onClose={() => setOpen(false)} />}
    </>
  );
}
