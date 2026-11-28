import Box from '@mui/material/Box';
import type React from 'react';
import type { SystemHealthLevel } from '@/app/lib/contracts';
import { AdminGroup, StatusDot } from '../../components/AdminGroup';

interface HealthRowProps {
  label: string;
  level: SystemHealthLevel;
  levelText: string;
  text: string;
  /** A second muted line, such as a queue's counts. */
  detail?: string | null;
}

/** One check: a dot and its level in words (never colour alone), then what it found. */
export function HealthRow({
  label,
  level,
  levelText,
  text,
  detail,
}: HealthRowProps): React.JSX.Element {
  return (
    <Box component="li" sx={{ py: 1.5, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <StatusDot level={level} />
        <Box
          component="span"
          sx={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}
        >
          {label}
        </Box>
        <Box component="span" sx={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {levelText}
        </Box>
      </Box>
      <Box
        sx={{
          pl: 2.5,
          pt: 0.5,
          fontSize: 13,
          color: 'var(--text-muted)',
          overflowWrap: 'anywhere',
        }}
      >
        {text}
      </Box>
      {detail ? (
        <Box
          sx={{
            pl: 2.5,
            pt: 0.25,
            fontSize: 13,
            color: 'var(--text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {detail}
        </Box>
      ) : null}
    </Box>
  );
}

/** A titled card holding rows. */
export function HealthSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return <AdminGroup title={title}>{children}</AdminGroup>;
}
