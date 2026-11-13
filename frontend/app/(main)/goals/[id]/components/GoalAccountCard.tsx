'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import type React from 'react';
import { useIntlayer } from '@/app/i18n';
import type { GoalAccount } from '@/app/lib/contracts';
import { tokens } from '@/lib/theme-tokens';
import { GoalAccountNote } from '../../components/GoalAccountNote';
import { fillSlots, followsAccount } from '../../lib/goal-account';

interface GoalAccountCardProps {
  account: GoalAccount | null;
  goalCurrency: string;
  /** Contributions kept in the log while the goal follows the account. */
  contributionCount: number;
}

/**
 * Where a goal following an account gets its progress, in place of its
 * movements: they are kept, but not counted, so listing them would mislead.
 * The account's own page carries the balance history.
 */
export function GoalAccountCard({
  account,
  goalCurrency,
  contributionCount,
}: GoalAccountCardProps): React.JSX.Element | null {
  const t = useIntlayer('goalAccount');
  if (!account) {
    return null;
  }
  const following = followsAccount({ account });
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: tokens.radius.md,
        bgcolor: 'background.paper',
        p: 2.5,
        mt: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: 15, fontWeight: 500, color: 'var(--foreground)' }}>
          {t.follow}
        </Typography>
        <Link href={`/accounts/${account.id}`} style={{ color: 'var(--primary)', fontSize: 14 }}>
          {t.balanceHistory}
        </Link>
      </Box>
      <GoalAccountNote account={account} goalCurrency={goalCurrency} />
      {following && contributionCount > 0 && (
        <Typography sx={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {fillSlots(t.kept.value, { count: String(contributionCount) })}
        </Typography>
      )}
    </Box>
  );
}
