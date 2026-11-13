'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import type { FollowableAccount } from '../lib/goal-account';

const NONE = '';

interface GoalAccountFieldProps {
  value: string | null;
  accounts: readonly FollowableAccount[];
  onChange: (walletId: string | null) => void;
}

/** "Follow an account": the goal's progress becomes that account's balance. */
export function GoalAccountField({ value, accounts, onChange }: GoalAccountFieldProps) {
  const t = useIntlayer('goalAccount');
  return (
    <Box>
      <Typography
        id="goal-account-label"
        variant="body2"
        sx={{ color: 'var(--text-muted)', display: 'block', mb: 0.5 }}
      >
        {t.follow}
      </Typography>
      <Select
        labelId="goal-account-label"
        inputProps={{ 'aria-labelledby': 'goal-account-label' }}
        fullWidth
        value={value ?? NONE}
        options={[
          { value: NONE, label: t.followNone.value },
          ...accounts.map(account => ({
            value: account.id,
            label: `${account.name} · ${account.currency}`,
          })),
        ]}
        onChange={next => onChange(next === NONE ? null : next)}
      />
      {value && (
        <Typography
          variant="caption"
          sx={{ color: 'var(--text-muted)', display: 'block', mt: 0.5 }}
        >
          {t.followHint}
        </Typography>
      )}
    </Box>
  );
}
