'use client';

import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useId } from 'react';

/** A text field with its label above it, never floating inside. */
export function LabeledField({
  label,
  value,
  onChange,
  type = 'text',
  decimal = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  decimal?: boolean;
}) {
  const id = useId();
  return (
    <Box>
      <Typography
        component="label"
        htmlFor={id}
        variant="body2"
        sx={{ display: 'block', color: 'text.secondary', fontSize: 13, mb: 0.5 }}
      >
        {label}
      </Typography>
      <TextField
        id={id}
        size="small"
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        slotProps={{ htmlInput: decimal ? { inputMode: 'decimal' } : undefined }}
        fullWidth
      />
    </Box>
  );
}
