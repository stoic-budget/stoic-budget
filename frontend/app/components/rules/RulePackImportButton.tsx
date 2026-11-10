'use client';

import { Button } from '@mui/material';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useIntlayer } from '@/app/i18n';
import type { RulePack } from '@/app/lib/contracts';
import { RulePackImportDialog } from './RulePackImportDialog';
import { readPackFile } from './useRulePacks';

/** Picks a pack file and opens its preview; a file that is not a pack is refused here. */
export function RulePackImportButton() {
  const t = useIntlayer('rulePacks');
  const input = useRef<HTMLInputElement>(null);
  const [pack, setPack] = useState<RulePack | null>(null);

  const read = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    const read = await readPackFile(file);
    if (read === 'tooBig' || read === 'notPack') {
      toast.error((read === 'tooBig' ? t.tooBig : t.notPack).value);
      return;
    }
    setPack(read);
  };

  return (
    <>
      <Button variant="outlined" onClick={() => input.current?.click()}>
        {t.import}
      </Button>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        aria-label={t.import.value}
        onChange={event => {
          void read(event.target.files?.[0]);
          // The same file can be picked again after a cancel.
          event.target.value = '';
        }}
      />
      {pack && <RulePackImportDialog pack={pack} onClose={() => setPack(null)} />}
    </>
  );
}
