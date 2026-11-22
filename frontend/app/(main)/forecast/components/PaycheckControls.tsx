'use client';

import Box from '@mui/material/Box';
import OutlinedInput from '@mui/material/OutlinedInput';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { FilterChipButton } from '@/app/components/ui/filter-chip-button';
import { useIntlayer } from '@/app/i18n';
import { MAX_BUFFER, type PaycheckPlanResponse } from '../hooks/usePaycheckPlan';

const CADENCE_KEYS = {
  weekly: 'cadenceWeekly',
  fortnightly: 'cadenceFortnightly',
  semimonthly: 'cadenceSemimonthly',
  monthly: 'cadenceMonthly',
  other: 'cadenceOther',
} as const;

interface PaycheckControlsProps {
  data: PaycheckPlanResponse;
  buffer: number;
  onToggleStream: (id: string) => void;
  onToggleWallet: (id: string) => void;
  onBuffer: (value: number) => void;
}

/** A typed amount the contract accepts (0 to 10¹²), or null. A comma counts as the decimal mark. */
export function parseBuffer(text: string): number | null {
  const trimmed = text.trim().replace(/\s/g, '').replace(',', '.');
  if (trimmed === '') return 0;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value <= MAX_BUFFER ? value : null;
}

const LABEL_SX = { fontSize: 13, color: 'text.secondary', mb: 0.5 } as const;

/** Which payers start the periods, which accounts the cash comes from, and the buffer. */
export function PaycheckControls({
  data,
  buffer,
  onToggleStream,
  onToggleWallet,
  onBuffer,
}: PaycheckControlsProps) {
  const t = useIntlayer('paycheckPlanner');
  const [text, setText] = useState(buffer > 0 ? String(buffer) : '');
  useEffect(() => setText(buffer > 0 ? String(buffer) : ''), [buffer]);
  const parsed = parseBuffer(text);

  const commit = () => {
    if (parsed === null) {
      setText(buffer > 0 ? String(buffer) : '');
      return;
    }
    if (parsed !== buffer) onBuffer(parsed);
  };

  return (
    <Box sx={{ display: 'grid', gap: 2, mb: 2 }}>
      {data.streams.length > 0 && (
        <Box>
          <Typography sx={LABEL_SX}>{t.streamsLabel}</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {data.streams.map(stream => (
              <FilterChipButton
                key={stream.id}
                active={stream.selected}
                aria-pressed={stream.selected}
                onClick={() => onToggleStream(stream.id)}
              >
                {stream.label}
                {' · '}
                {stream.kind === 'declared' ? t.declared : t[CADENCE_KEYS[stream.cadence]]}
              </FilterChipButton>
            ))}
          </Box>
        </Box>
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-end' }}>
        {data.accounts.length > 1 && (
          <Box sx={{ flex: '1 1 240px', minWidth: 0 }}>
            <Typography sx={LABEL_SX}>{t.accountsLabel}</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {data.accounts.map(account => (
                <FilterChipButton
                  key={account.id}
                  active={account.selected}
                  aria-pressed={account.selected}
                  onClick={() => onToggleWallet(account.id)}
                >
                  {account.name}
                </FilterChipButton>
              ))}
            </Box>
          </Box>
        )}
        <Box component="label" sx={{ display: 'block', width: 160 }}>
          <Typography sx={LABEL_SX}>{fillCurrency(t.bufferLabel.value, data.currency)}</Typography>
          <OutlinedInput
            size="small"
            value={text}
            error={parsed === null}
            onChange={event => setText(event.target.value)}
            onBlur={commit}
            onKeyDown={event => {
              if (event.key === 'Enter') commit();
            }}
            placeholder="0"
            inputProps={{ inputMode: 'decimal', 'aria-invalid': parsed === null }}
            sx={{ width: '100%', fontVariantNumeric: 'tabular-nums' }}
          />
        </Box>
      </Box>
    </Box>
  );
}

const fillCurrency = (template: string, currency: string): string =>
  template.replaceAll('{{currency}}', currency);
