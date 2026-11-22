'use client';

import dynamic from 'next/dynamic';
import type React from 'react';
import { useIntlayer } from '@/app/i18n';
import { useWhatsNewAutoOpen } from './useWhatsNewAutoOpen';
import { closeWhatsNew, useWhatsNewEntry } from './whats-new-store';

// The markdown renderer loads only once the dialog opens.
const ChangelogModal = dynamic(
  () => import('@/app/components/ChangelogModal').then(module => module.ChangelogModal),
  { ssr: false },
);

/**
 * Mounted once in the root layout. Shows the What's new dialog, opened by hand from
 * the account menu or by itself once per release.
 */
export function WhatsNewHost(): React.JSX.Element | null {
  const entry = useWhatsNewEntry();
  const { title, close } = useIntlayer('whatsNew');
  useWhatsNewAutoOpen();

  if (!entry) {
    return null;
  }
  return (
    <ChangelogModal
      isOpen
      onClose={closeWhatsNew}
      entry={entry}
      releaseLabel={title.value}
      closeLabel={close.value}
    />
  );
}
