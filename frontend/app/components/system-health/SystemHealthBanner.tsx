'use client';

import Box from '@mui/material/Box';
import Link from 'next/link';
import type React from 'react';
import { useSystemHealth } from '@/app/hooks/useSystemHealth';
import { useIntlayer, useLocale } from '@/app/i18n';
import { type BannerProblem, bannerProblem } from './banner-problem';
import { fill, formatHealthTime } from './health-format';

const useTexts = () => useIntlayer('systemHealthBanner');
type Texts = ReturnType<typeof useTexts>;

function messageOf(problem: BannerProblem, t: Texts, locale: string): string {
  switch (problem.kind) {
    case 'unanswered':
      return t.unanswered.value;
    case 'redis':
      return t.redis.value;
    case 'database':
      return t.database.value;
    case 'worker':
      return problem.since
        ? fill(t.worker.value, { time: formatHealthTime(problem.since, locale) })
        : t.workerNever.value;
    case 'stuck':
      return t.stuck.value;
    case 'setup':
      return t.setup.value;
  }
}

/**
 * For the server's admins only, and only while something is broken: what
 * stopped and a link to the page that says what to do. Everyone else never
 * asks the server about it.
 */
export function SystemHealthBanner(): React.JSX.Element | null {
  const t = useTexts();
  const { locale } = useLocale();
  const { isAdmin, health, unanswered } = useSystemHealth();
  const problem = isAdmin ? bannerProblem(health, unanswered) : null;
  if (!problem) {
    return null;
  }
  return (
    <Box
      role="status"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        minHeight: 44,
        pl: 2,
        pr: 1,
        borderRadius: '8px',
        bgcolor: 'var(--surface-soft)',
        fontSize: 14,
      }}
    >
      <Box
        aria-hidden
        sx={{
          flexShrink: 0,
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: 'var(--money-down)',
        }}
      />
      <Box
        component="span"
        sx={{ flex: 1, minWidth: 0, py: 1, fontWeight: 500, color: 'var(--foreground)' }}
      >
        {messageOf(problem, t, String(locale))}
      </Box>
      <Box
        component={Link}
        href="/admin/health"
        sx={{
          flexShrink: 0,
          px: 1,
          color: 'var(--primary)',
          fontWeight: 500,
          textDecoration: 'none',
          '&:hover': { textDecoration: 'underline' },
        }}
      >
        {t.open}
      </Box>
    </Box>
  );
}
