'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import { useIntlayer } from '@/app/i18n';
import type { InvestmentTrade, TradeInput } from '../hooks/useInvestmentTrades';
import { LabeledField } from './LabeledField';
import { parseDecimal } from './trade-form';
import { formatUnits } from './trade-labels';

interface SplitDialogProps {
  open: boolean;
  /** A split being corrected; null for a new one. */
  split: InvestmentTrade | null;
  /** Units held now, to show what the split turns them into. */
  held: number;
  locale: string;
  saving: boolean;
  onClose: () => void;
  onSave: (input: TradeInput) => Promise<unknown>;
}

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * A stock split as the broker announces it: so many new shares for so many
 * old ones. 3 for 1 triples the shares, 1 for 10 is a reverse split; what the
 * shares cost stays the same either way.
 */
export function SplitDialog({
  open,
  split,
  held,
  locale,
  saving,
  onClose,
  onSave,
}: SplitDialogProps) {
  const t = useIntlayer('investmentTrades');
  // Filled once per opening (the parent keys it by the split).
  const [date, setDate] = useState(split?.date ?? new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(split?.splitTo ? String(split.splitTo) : '');
  const [from, setFrom] = useState(split?.splitFrom ? String(split.splitFrom) : '1');

  if (!open) return null;
  const newShares = parseDecimal(to);
  const oldShares = parseDecimal(from);
  const valid =
    DATE.test(date) && newShares !== null && newShares > 0 && oldShares !== null && oldShares > 0;
  const after = valid ? (held * (newShares as number)) / (oldShares as number) : null;

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      title={t.recordSplit.value}
      size="sm"
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={async () => {
            try {
              await onSave({
                kind: 'split',
                date,
                splitTo: newShares as number,
                splitFrom: oldShares as number,
              });
              onClose();
            } catch {
              // The hook has said what went wrong; the dialog stays open.
            }
          }}
          confirmText={t.save.value}
          isConfirmLoading={saving}
          isConfirmDisabled={!valid || saving}
        />
      }
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
          gap: 2,
          pt: 1,
        }}
      >
        <LabeledField label={t.date.value} type="date" value={date} onChange={setDate} />
        <LabeledField label={t.newShares.value} value={to} onChange={setTo} decimal />
        <LabeledField label={t.oldShares.value} value={from} onChange={setFrom} decimal />
      </Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2 }}>
        {after === null
          ? t.splitHint
          : t.splitPreview.value
              .replace('{{held}}', formatUnits(held, locale))
              .replace('{{after}}', formatUnits(after, locale))}
      </Typography>
    </ModalShell>
  );
}
