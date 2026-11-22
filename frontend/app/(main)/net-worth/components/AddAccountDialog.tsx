'use client';

import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { useState } from 'react';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import { useIntlayer } from '@/app/i18n';

/** A new account: a name and its kind, in a dialog rather than a form on the page. */
export function AddAccountDialog({
  open,
  saving,
  onClose,
  onCreate,
}: {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onCreate: (name: string, kind: 'investment' | 'retirement') => Promise<unknown>;
}) {
  const t = useIntlayer('netWorthPage');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'investment' | 'retirement'>('investment');
  if (!open) {
    return null;
  }
  return (
    <ModalShell
      isOpen
      onClose={onClose}
      title={t.addAccount.value}
      size="sm"
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={async () => {
            await onCreate(name.trim(), kind);
            setName('');
            onClose();
          }}
          confirmText={t.addAccount.value}
          isConfirmLoading={saving}
          isConfirmDisabled={!name.trim() || saving}
        />
      }
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, pt: 1 }}>
        <TextField
          size="small"
          label={t.accountName.value}
          value={name}
          onChange={event => setName(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          select
          size="small"
          label={t.assetClass.value}
          value={kind}
          onChange={event => setKind(event.target.value as 'investment' | 'retirement')}
          slotProps={{ inputLabel: { shrink: true } }}
        >
          <MenuItem value="investment">{t.kindInvestment}</MenuItem>
          <MenuItem value="retirement">{t.kindRetirement}</MenuItem>
        </TextField>
      </Box>
    </ModalShell>
  );
}
