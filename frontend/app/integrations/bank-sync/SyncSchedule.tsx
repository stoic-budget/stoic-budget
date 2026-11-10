'use client';

import { Box, TextField, Typography } from '@mui/material';
import type React from 'react';
import { useIntlayer, useLocale } from '@/app/i18n';
import { useUserFormat } from '@/app/lib/user-format-store';
import { useSyncInterval } from './hooks/useSyncInterval';
import type { BankSyncConnection, RunAction } from './types';

/** The intervals offered, in hours; one set another way (the API) is listed too. */
const INTERVALS = [1, 2, 3, 4, 6, 8, 12, 24];

/**
 * How often auto-sync pulls this connection, when it pulls next, and whether
 * failed pulls are holding it back — with the reason, so a paused feed never
 * looks like a quiet one.
 */
export function SyncSchedule({
  connection,
  busy,
  onRun,
  onReload,
}: {
  connection: BankSyncConnection;
  busy: string | null;
  onRun: RunAction;
  onReload: () => Promise<void>;
}): React.JSX.Element {
  const t = useIntlayer('bankSyncSchedule');
  const panel = useIntlayer('bankSyncPanel');
  const { locale } = useLocale();
  const { formatDateTime } = useUserFormat();
  const saveInterval = useSyncInterval();
  const { schedule } = connection;
  const reasons = {
    provider_busy: t.reasonProviderBusy,
    credential_refused: t.reasonCredentialRefused,
    pull_failed: t.reasonPullFailed,
  } satisfies Record<NonNullable<typeof schedule.backoffReason>, unknown>;
  const now = Date.now();
  const hours = new Intl.NumberFormat(locale, { style: 'unit', unit: 'hour', unitDisplay: 'long' });
  const options = INTERVALS.includes(schedule.intervalHours)
    ? INTERVALS
    : [...INTERVALS, schedule.intervalHours].sort((a, b) => a - b);

  const backoffUntil = schedule.backoffUntil ? new Date(schedule.backoffUntil).getTime() : null;
  const paused =
    connection.status !== 'needs_reauth' &&
    schedule.consecutiveFailures > 0 &&
    backoffUntil !== null &&
    backoffUntil > now;
  const nextPullAt = schedule.nextPullAt ? new Date(schedule.nextPullAt).getTime() : null;
  const showNext = connection.config.autoSync && connection.status === 'connected' && !paused;

  const choose = (value: number) =>
    onRun(
      `interval:${connection.id}`,
      async () => {
        await saveInterval(connection.id, value);
        await onReload();
        return { tone: 'ok', text: panel.saved.value };
      },
      panel.saveFailed.value,
    );

  return (
    <Box
      data-testid={`bank-sync-schedule-${connection.id}`}
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}
    >
      <TextField
        select
        size="small"
        label={t.interval.value}
        value={schedule.intervalHours}
        onChange={event => void choose(Number(event.target.value))}
        disabled={busy !== null}
        sx={{ width: { xs: '100%', sm: 220 } }}
        slotProps={{
          select: { native: true },
          inputLabel: { shrink: true },
          htmlInput: { 'data-testid': `bank-sync-interval-${connection.id}` },
        }}
      >
        {options.map(value => (
          <option key={value} value={value}>
            {hours.format(value)}
          </option>
        ))}
      </TextField>

      {showNext ? (
        <Typography sx={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {nextPullAt === null || nextPullAt <= now
            ? t.nextPullSoon
            : t.nextPull.value.replace('{time}', () => formatDateTime(nextPullAt))}
        </Typography>
      ) : null}

      {paused ? (
        <Typography
          role="status"
          data-testid={`bank-sync-paused-${connection.id}`}
          sx={{ fontSize: 13, color: 'var(--attention)' }}
        >
          {t.paused.value
            .replace('{count}', () => String(schedule.consecutiveFailures))
            .replace('{time}', () => formatDateTime(backoffUntil))}
          {schedule.backoffReason ? `: ${reasons[schedule.backoffReason].value}` : ''}
        </Typography>
      ) : null}
    </Box>
  );
}
