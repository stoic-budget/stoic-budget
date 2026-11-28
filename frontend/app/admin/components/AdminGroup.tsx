'use client';

import Box from '@mui/material/Box';
import Link from 'next/link';
import type React from 'react';
import { ChevronLeft, ChevronRight } from '@/app/components/icons';
import type { SystemHealthLevel } from '@/app/lib/contracts';

const DOT: Record<SystemHealthLevel, string> = {
  ok: 'var(--primary)',
  warning: 'var(--attention)',
  error: 'var(--money-down)',
  off: 'var(--cat-tone-other)',
  unknown: 'var(--cat-tone-other)',
};

/** The level as a small dot; always next to the level in words, never alone. */
export function StatusDot({ level }: { level: SystemHealthLevel }): React.JSX.Element {
  return (
    <Box
      aria-hidden
      component="span"
      sx={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        width: 8,
        height: 8,
        borderRadius: '50%',
        bgcolor: DOT[level],
      }}
    />
  );
}

/** An admin page's heading: a quiet way back, the name, one muted line. */
export function AdminHeader({
  title,
  subtitle,
  back,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  back?: { href: string; label: React.ReactNode };
}): React.JSX.Element {
  return (
    <Box component="header" sx={{ mb: 3 }}>
      {back ? (
        <Box
          component={Link}
          href={back.href}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.25,
            ml: -0.5,
            mb: 0.5,
            fontSize: 13,
            color: 'var(--text-muted)',
            textDecoration: 'none',
            '&:hover': { color: 'var(--foreground)' },
          }}
        >
          <ChevronLeft size={16} aria-hidden />
          {back.label}
        </Box>
      ) : null}
      <Box component="h1" sx={{ m: 0, fontSize: 20, fontWeight: 500, color: 'var(--foreground)' }}>
        {title}
      </Box>
      {subtitle ? (
        <Box component="p" sx={{ m: 0, mt: 0.5, fontSize: 13, color: 'var(--text-muted)' }}>
          {subtitle}
        </Box>
      ) : null}
    </Box>
  );
}

/** A rounded card of rows, as a settings list groups them; the title is optional. */
export function AdminGroup({
  title,
  children,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Box component="section" sx={{ mb: 3 }}>
      {title ? (
        <Box
          component="h2"
          sx={{ fontSize: 15, fontWeight: 500, m: 0, mb: 1, color: 'var(--foreground)' }}
        >
          {title}
        </Box>
      ) : null}
      <Box
        component="ul"
        sx={{
          m: 0,
          p: 0,
          bgcolor: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          overflow: 'hidden',
          '& > li': { listStyle: 'none' },
          '& > li + li': { borderTop: '1px solid var(--border)' },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

/** A row that opens another page: dot, name, the state in words, and a chevron. */
export function AdminLinkRow({
  href,
  label,
  level,
  status,
}: {
  href: string;
  label: React.ReactNode;
  level?: SystemHealthLevel;
  status?: React.ReactNode;
}): React.JSX.Element {
  return (
    <li>
      <Box
        component={Link}
        href={href}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.5,
          color: 'var(--foreground)',
          textDecoration: 'none',
          '&:hover': { bgcolor: 'var(--surface-soft)' },
        }}
      >
        {level ? <StatusDot level={level} /> : null}
        <Box component="span" sx={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500 }}>
          {label}
        </Box>
        {status ? (
          <Box component="span" sx={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {status}
          </Box>
        ) : null}
        <ChevronRight size={18} aria-hidden style={{ color: 'var(--text-muted)' }} />
      </Box>
    </li>
  );
}
