import Box from '@mui/material/Box';
import type React from 'react';
import type { SystemHealthLevel } from '@/app/lib/contracts';

const DOT: Record<SystemHealthLevel, string> = {
  ok: 'var(--primary)',
  warning: 'var(--attention)',
  error: 'var(--money-down)',
  off: 'var(--cat-tone-other)',
  unknown: 'var(--cat-tone-other)',
};

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
    <Box
      component="li"
      sx={{
        listStyle: 'none',
        py: 1.5,
        px: 2,
        '& + &': { borderTop: '1px solid var(--border)' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Box
          aria-hidden
          sx={{ flexShrink: 0, width: 8, height: 8, borderRadius: '50%', bgcolor: DOT[level] }}
        />
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
  return (
    <Box component="section" sx={{ mb: 3 }}>
      <Box
        component="h2"
        sx={{ fontSize: 15, fontWeight: 500, m: 0, mb: 1, color: 'var(--foreground)' }}
      >
        {title}
      </Box>
      <Box
        component="ul"
        sx={{
          m: 0,
          p: 0,
          bgcolor: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
