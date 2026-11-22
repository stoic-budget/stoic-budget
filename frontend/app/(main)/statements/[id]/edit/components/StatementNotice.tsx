'use client';
import Alert from '@mui/material/Alert';
import type { ReactNode } from 'react';

/** A calm one-line notice over the statement: card colour and ink text, only the icon carries the tone. */
export function StatementNotice({
  tone,
  onClose,
  children,
}: {
  tone: 'error' | 'success';
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Alert
      severity={tone}
      onClose={onClose}
      sx={{
        mb: 2,
        bgcolor: 'var(--card)',
        color: 'var(--foreground)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        '& .MuiAlert-icon': { color: tone === 'error' ? 'var(--money-down)' : 'var(--money-up)' },
        '& .MuiAlert-action': { color: 'var(--text-muted)' },
      }}
    >
      {children}
    </Alert>
  );
}
