'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2 } from '@/app/components/icons';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { useIntlayer } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import type { CloseInput, ImportClosesResult, SecurityClose } from '../hooks/usePriceHistory';
import { buildClose, localToday } from './close-form';
import { LabeledField } from './LabeledField';

interface HoldingClosesProps {
  closes: readonly SecurityClose[];
  currency: string;
  locale: string;
  saving: boolean;
  onAdd: (input: CloseInput) => Promise<unknown>;
  onDelete: (closeId: string) => Promise<unknown>;
  onImport: (csv: string) => Promise<ImportClosesResult>;
}

/**
 * The closes this workspace keeps for the symbol: typed in one by one or
 * imported from a CSV file, each replacing the feed's close of its day here.
 */
export function HoldingCloses({
  closes,
  currency,
  locale,
  saving,
  onAdd,
  onDelete,
  onImport,
}: HoldingClosesProps) {
  const p = useIntlayer('priceHistory');
  const [form, setForm] = useState({ date: localToday(), close: '' });
  const file = useRef<HTMLInputElement>(null);
  const today = localToday();
  const input = buildClose(form, today);

  const add = async () => {
    if (!input) return;
    await onAdd({ ...input, currency });
    setForm(current => ({ ...current, close: '' }));
  };
  const upload = async (picked: File | undefined) => {
    if (!picked) return;
    const result = await onImport(await picked.text());
    toast.success(
      p.imported.value
        .replace('{{created}}', String(result.created))
        .replace('{{updated}}', String(result.updated))
        .replace('{{skipped}}', String(result.skipped.length)),
    );
  };

  return (
    <Box data-testid="holding-closes">
      <Typography sx={{ fontSize: 15, fontWeight: 500 }}>{p.ownCloses}</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 13, mb: 1.5 }}>
        {p.ownClosesHint}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 1.5,
          alignItems: 'end',
        }}
      >
        <LabeledField
          label={p.date.value}
          type="date"
          value={form.date}
          onChange={date => setForm(current => ({ ...current, date }))}
        />
        <LabeledField
          label={`${p.close.value} (${currency})`}
          decimal
          value={form.close}
          onChange={close => setForm(current => ({ ...current, close }))}
        />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, gridColumn: '1 / -1' }}>
          <Button size="small" variant="outlined" disabled={!input || saving} onClick={add}>
            {p.addClose}
          </Button>
          <Button
            size="small"
            variant="text"
            disabled={saving}
            onClick={() => file.current?.click()}
          >
            {p.importCsv}
          </Button>
          <input
            ref={file}
            type="file"
            accept=".csv,text/csv,text/plain"
            hidden
            data-testid="closes-file"
            onChange={event => {
              void upload(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </Box>
      </Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 13, mt: 0.75 }}>
        {p.importHint}
      </Typography>

      {closes.length > 0 && (
        <Box sx={{ mt: 1.5, maxHeight: 240, overflowY: 'auto' }}>
          {closes.map(close => (
            <Box
              key={close.id}
              data-testid={`close-${close.date}`}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                py: 0.5,
                borderTop: 1,
                borderColor: 'divider',
                fontSize: 14,
              }}
            >
              <Box sx={{ flex: 1, fontVariantNumeric: 'tabular-nums' }}>{close.date}</Box>
              <Box sx={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                <PrivateAmount>{formatMoney(close.close, close.currency, locale)}</PrivateAmount>
              </Box>
              <Box sx={{ color: 'text.secondary', fontSize: 13, minWidth: 96 }}>
                {close.source === 'manual' ? p.sourceManual : p.sourceImport}
              </Box>
              <IconButton
                size="small"
                aria-label={`${p.delete.value} ${close.date}`}
                disabled={saving}
                onClick={() => void onDelete(close.id)}
              >
                <Trash2 size={14} />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
