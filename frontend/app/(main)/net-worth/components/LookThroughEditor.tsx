'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { Plus, Trash2 } from '@/app/components/icons';
import { Select, type SelectOption } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import { checkRows, type WeightRow } from './look-through-form';

/**
 * One cut of a fund's breakdown: a line per name with its weight, and below
 * them, live, the rest that will be sent as "other". Nothing is rounded or
 * filled in behind the user's back: what this shows is what is saved.
 */
export function LookThroughEditor({
  title,
  rows,
  options,
  onChange,
  testId,
}: {
  title: string;
  rows: WeightRow[];
  options: SelectOption[];
  onChange: (rows: WeightRow[]) => void;
  testId: string;
}): React.JSX.Element {
  const t = useIntlayer('allocationMix');
  const check = checkRows(rows);
  const set = (index: number, patch: Partial<WeightRow>) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, ...patch } : row)));

  return (
    <Box data-testid={testId}>
      <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 13, mb: 0.5 }}>
        {title}
      </Typography>
      {rows.map((row, index) => (
        <Box
          // Lines have no id of their own; their place is who they are while editing.
          // biome-ignore lint/suspicious/noArrayIndexKey: rows are edited in place, never reordered
          key={index}
          sx={{ display: 'grid', gridTemplateColumns: '1fr 96px auto', gap: 1, mb: 1 }}
        >
          <Select
            size="small"
            aria-label={title}
            value={row.key}
            options={[{ value: '', label: '—' }, ...options]}
            onChange={key => set(index, { key })}
            error={check.invalid.includes(index) && !row.key}
          />
          <TextField
            size="small"
            value={row.weight}
            onChange={event => set(index, { weight: event.target.value })}
            error={check.invalid.includes(index) && Boolean(row.key)}
            slotProps={{ htmlInput: { inputMode: 'decimal', 'aria-label': t.weight.value } }}
          />
          <IconButton
            size="small"
            aria-label={t.remove.value}
            onClick={() => onChange(rows.filter((_, at) => at !== index))}
          >
            <Trash2 size={14} />
          </IconButton>
        </Box>
      ))}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Button
          size="small"
          variant="text"
          onClick={() => onChange([...rows, { key: '', weight: '' }])}
        >
          <Plus size={16} aria-hidden />
          {t.addRow}
        </Button>
        {rows.length > 0 && !check.over && check.remainder > 0 && (
          <Typography
            variant="body2"
            data-testid={`${testId}-remainder`}
            sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums', ml: 'auto' }}
          >
            {t.remainder}: {check.remainder}%
          </Typography>
        )}
      </Box>
      {check.over && (
        <Typography variant="body2" role="alert" sx={{ color: 'var(--money-down)', fontSize: 13 }}>
          {t.overHundred}
        </Typography>
      )}
      {!check.over && check.invalid.length > 0 && (
        <Typography variant="body2" role="alert" sx={{ color: 'var(--attention)', fontSize: 13 }}>
          {t.fixRows}
        </Typography>
      )}
    </Box>
  );
}
