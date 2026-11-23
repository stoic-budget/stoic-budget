'use client';

import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import type { WorkspaceTaxSettings } from '@/app/lib/contracts';

export type VatStatus = WorkspaceTaxSettings['vatStatus'];

const STATUSES: VatStatus[] = ['registered', 'small_business', 'not_registered'];

/** Today as `YYYY-MM-DD` in the person's own time: a status cannot start later. */
function today(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * The VAT status, and the day a new one applies from. Without a day the status
 * covers every row not on a filed return; with one, rows before it keep theirs
 * (a business registered from 1 July charged no VAT in June). Nothing is sent
 * until "Save", so the status and the day can be picked in either order.
 */
export function VatStatusField({
  status,
  disabled,
  onChange,
}: {
  status: VatStatus | undefined;
  disabled: boolean;
  onChange: (status: VatStatus, effectiveFrom: string | null) => void;
}): React.ReactElement {
  const t = useIntlayer('workspaceTaxStatus');
  const [chosen, setChosen] = useState<VatStatus | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const shown = chosen ?? status;
  const save = () => {
    if (!chosen || chosen === status) return;
    onChange(chosen, effectiveFrom || null);
    setChosen(null);
    setEffectiveFrom('');
  };
  const help: Record<VatStatus, string> = {
    registered: t.registeredHelp.value,
    small_business: t.smallBusinessHelp.value,
    not_registered: t.notRegisteredHelp.value,
  };
  const label: Record<VatStatus, string> = {
    registered: t.registered.value,
    small_business: t.smallBusiness.value,
    not_registered: t.notRegistered.value,
  };

  return (
    <Box>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
        <Select
          size="small"
          value={shown ?? ''}
          disabled={!status || disabled}
          aria-label={t.statusLabel.value}
          onChange={value => setChosen(value as VatStatus)}
          options={STATUSES.map(value => ({ value, label: label[value] }))}
          sx={{ minWidth: 280 }}
        />
        <TextField
          type="date"
          size="small"
          label={t.effectiveFromLabel.value}
          value={effectiveFrom}
          disabled={!status || disabled}
          onChange={event => setEffectiveFrom(event.target.value)}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today() } }}
        />
        {chosen && chosen !== status ? (
          <Button variant="contained" size="small" disabled={disabled} onClick={save}>
            {t.save.value}
          </Button>
        ) : null}
      </Stack>
      <Typography sx={{ mt: 1, fontSize: 13, color: 'text.secondary', maxWidth: 560 }}>
        {t.effectiveFromHelp.value}
      </Typography>
      {shown ? (
        <Typography sx={{ mt: 1, fontSize: 13, color: 'text.secondary', maxWidth: 560 }}>
          {help[shown]}
        </Typography>
      ) : null}
    </Box>
  );
}
