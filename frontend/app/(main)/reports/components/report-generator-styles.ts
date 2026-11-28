import type React from 'react';
import { tokens } from '@/lib/theme-tokens';

export const pillStyle = (selected: boolean): React.CSSProperties => ({
  height: 32,
  padding: '0 12px',
  border: selected ? '1px solid var(--primary)' : '1px solid var(--border)',
  background: selected ? 'var(--primary-fill)' : 'var(--card)',
  color: selected ? '#fff' : 'var(--muted-foreground)',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
  borderRadius: tokens.radius.md,
});

export const fieldLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--muted-foreground)',
};
