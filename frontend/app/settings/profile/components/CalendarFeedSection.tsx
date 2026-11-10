'use client';

import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type React from 'react';
import toast from 'react-hot-toast';
import { Copy } from '@/app/components/icons';
import { Button } from '@/app/components/ui/button';
import { useIntlayer, useLocale } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { CalendarFeedInclude } from '@/app/lib/contracts';
import { formatStoredDateTime } from '@/app/lib/user-format-store';
import { calendarFeedUrl, useCalendarFeed } from '@/app/settings/profile/hooks/useCalendarFeed';

const KINDS: ReadonlyArray<keyof CalendarFeedInclude> = [
  'payables',
  'subscriptions',
  'taxDeadlines',
  'invoices',
];

const mutedText = { fontSize: 14, color: 'var(--text-muted)' } as const;

/**
 * The member's own ICS feed: a private link to subscribe to from a calendar
 * app, shown once when it is made, and the choice of what it shows.
 */
export function CalendarFeedSection(): React.JSX.Element | null {
  const t = useIntlayer('settingsCalendarFeedSection');
  const { locale } = useLocale();
  const { query, issue, update, remove } = useCalendarFeed();
  const failed = (error: unknown) => toast.error(getApiErrorMessage(error, t.failed.value));
  const settings = query.data;
  if (!settings) return null;

  const token = issue.data?.token ?? null;
  const busy = issue.isPending || update.isPending || remove.isPending;

  const makeLink = (): void => {
    if (settings.enabled && !window.confirm(t.newLinkConfirm.value)) return;
    issue.mutate(undefined, { onError: failed });
  };
  const turnOff = (): void => {
    if (!window.confirm(t.turnOffConfirm.value)) return;
    remove.mutate(undefined, { onError: failed });
  };
  const copy = async (url: string): Promise<void> => {
    await navigator.clipboard.writeText(url);
    toast.success(t.copied.value);
  };

  if (!settings.enabled) {
    return (
      <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Typography sx={mutedText}>{t.intro}</Typography>
        <Button onClick={makeLink} disabled={busy}>
          {t.turnOn}
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Typography sx={mutedText}>{t.intro}</Typography>

      {token ? (
        <Stack spacing={0.75}>
          <Typography component="label" htmlFor="calendar-feed-link" sx={{ fontSize: 13 }}>
            {t.linkLabel}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              id="calendar-feed-link"
              fullWidth
              size="small"
              value={calendarFeedUrl(token)}
              slotProps={{ htmlInput: { readOnly: true, spellCheck: false } }}
              onFocus={event => event.target.select()}
            />
            <Button
              variant="outline"
              onClick={() => void copy(calendarFeedUrl(token))}
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              <Copy size={16} style={{ marginRight: 6 }} />
              {t.copy}
            </Button>
          </Stack>
          <Typography sx={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.linkOnce}</Typography>
        </Stack>
      ) : (
        <Typography sx={mutedText}>{t.linkHidden}</Typography>
      )}

      <Stack spacing={0.5}>
        <Typography sx={{ fontSize: 15, fontWeight: 500 }}>{t.kindsLabel}</Typography>
        {KINDS.map(kind => (
          <FormControlLabel
            key={kind}
            control={
              <Switch
                checked={settings.include[kind]}
                disabled={busy}
                onChange={(_event, value) => update.mutate({ [kind]: value }, { onError: failed })}
              />
            }
            label={<Typography sx={{ fontSize: 14 }}>{t[kind]}</Typography>}
          />
        ))}
      </Stack>

      <Typography sx={{ fontSize: 13, color: 'var(--text-muted)' }}>
        {settings.lastFetchedAt
          ? t.lastFetched.value.replace(
              '{{date}}',
              formatStoredDateTime(settings.lastFetchedAt, locale),
            )
          : t.neverFetched}
      </Typography>

      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        <Button variant="outline" onClick={makeLink} disabled={busy}>
          {t.newLink}
        </Button>
        <Button variant="ghost" onClick={turnOff} disabled={busy}>
          {t.turnOff}
        </Button>
      </Stack>
    </Stack>
  );
}
