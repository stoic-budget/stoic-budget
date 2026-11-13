'use client';

import Typography from '@mui/material/Typography';
import { useIntlayer } from '@/app/i18n';
import type { GoalAccount } from '@/app/lib/contracts';
import { fillSlots } from '../lib/goal-account';

interface GoalAccountNoteProps {
  account: GoalAccount | null;
  /** The goal's currency, named when the account's balance cannot be converted into it. */
  goalCurrency: string;
}

/** One quiet line saying where a goal's progress comes from, when it is not its contributions. */
export function GoalAccountNote({ account, goalCurrency }: GoalAccountNoteProps) {
  const t = useIntlayer('goalAccount');
  if (!account) {
    return null;
  }
  const template =
    account.status === 'following'
      ? t.following.value
      : account.status === 'archived'
        ? t.archived.value
        : t.noRate.value;
  return (
    <Typography
      data-testid="goal-account-note"
      sx={{ display: 'block', fontSize: 13, color: 'var(--text-muted)' }}
    >
      {fillSlots(template, { account: account.name, from: account.currency, to: goalCurrency })}
    </Typography>
  );
}
