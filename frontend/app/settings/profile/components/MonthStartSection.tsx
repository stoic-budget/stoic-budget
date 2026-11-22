'use client';

import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMemo, useState } from 'react';
import { resolveLocale } from '@/app/(main)/dashboard/helpers/dashboard-helpers';
import { Alert } from '@/app/components/ui/alert';
import { Button } from '@/app/components/ui/button';
import { useIntlayer, useLocale } from '@/app/i18n';
import type { MonthStartSetting, PayPeriodsResponse } from '@/app/lib/contracts';
import {
  formatPeriodRange,
  periodBounds,
  periodOf,
  shiftMonth,
} from '@/app/lib/contracts/workspaces/pay-period';
import { useMonthStartSetting } from '@/app/settings/profile/hooks/useMonthStartSetting';

type Kind = MonthStartSetting['kind'];

const KINDS: Array<{
  kind: Kind;
  label: 'kindDay' | 'kindLastDay' | 'kindLastBusinessDay' | 'kindSalary';
}> = [
  { kind: 'day', label: 'kindDay' },
  { kind: 'last_day', label: 'kindLastDay' },
  { kind: 'last_business_day', label: 'kindLastBusinessDay' },
  { kind: 'salary', label: 'kindSalary' },
];

type Draft = { kind: Kind; day: string };

const draftOf = (monthStart: MonthStartSetting | undefined): Draft =>
  monthStart?.kind === 'day'
    ? { kind: 'day', day: String(monthStart.day) }
    : { kind: monthStart?.kind ?? 'day', day: '1' };

/** The contract's rule: a whole number from 1 to 31, nothing else. */
const DAY = /^(?:[1-9]|[12]\d|3[01])$/;

/** What the form sends: exactly the choice on screen, null while the day is not valid. */
export function settingOf(draft: Draft): MonthStartSetting | null {
  if (draft.kind !== 'day') return { kind: draft.kind };
  const day = draft.day.trim();
  return DAY.test(day) ? { kind: 'day', day: Number(day) } : null;
}

const sameSetting = (a: MonthStartSetting | null, b: MonthStartSetting | undefined): boolean =>
  JSON.stringify(a) === JSON.stringify(b ?? null);

const todayKey = (): string => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/** This month and the next under the rule on screen, with the salary and holidays known. */
function usePreview(setting: MonthStartSetting | null, data: PayPeriodsResponse | undefined) {
  const { locale } = useLocale();
  return useMemo(() => {
    if (!setting) return null;
    const context = { monthStart: setting, salary: data?.salary, holidays: data?.holidays };
    const current = periodOf(context, todayKey());
    const format = (key: string) =>
      formatPeriodRange(periodBounds(context, key), resolveLocale(locale));
    return { current: format(current), next: format(shiftMonth(current, 1)) };
  }, [setting, data, locale]);
}

function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([resolveLocale(locale)], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Settings → Data → Start of the month: the day the workspace's month begins. */
export function MonthStartSection() {
  const t = useIntlayer('monthStartSection');
  const { locale } = useLocale();
  const { data, saving, error, saved, save } = useMonthStartSetting(t.saveError.value);
  const [draft, setDraft] = useState<Draft>(() => draftOf(data?.monthStart));
  // The saved rule arrives after the first render: the form adopts it once.
  const [seen, setSeen] = useState(data?.monthStart);
  if (data?.monthStart !== seen) {
    setSeen(data?.monthStart);
    setDraft(draftOf(data?.monthStart));
  }
  const setting = settingOf(draft);
  const preview = usePreview(setting, data);
  const note =
    draft.kind === 'salary'
      ? data?.salary
        ? t.salaryFound.value.replace('{{day}}', String(data.salary.dayOfMonth))
        : t.salaryMissing.value
      : draft.kind === 'last_business_day'
        ? data?.holidayCountry
          ? t.holidaysCountry.value.replace('{{country}}', countryName(data.holidayCountry, locale))
          : t.holidaysNone.value
        : null;

  return (
    <Stack spacing={2}>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {saved && sameSetting(setting, data?.monthStart) ? (
        <Alert variant="success">{t.saved.value}</Alert>
      ) : null}
      <Stack spacing={0.75}>
        <Typography component="label" htmlFor="month-start-kind" variant="body2">
          {t.startsLabel.value}
        </Typography>
        <TextField
          select
          size="small"
          id="month-start-kind"
          value={draft.kind}
          disabled={saving}
          onChange={event =>
            setDraft(current => ({ ...current, kind: event.target.value as Kind }))
          }
          sx={{ maxWidth: 360 }}
        >
          {KINDS.map(option => (
            <MenuItem key={option.kind} value={option.kind}>
              {t[option.label].value}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      {draft.kind === 'day' ? (
        <Stack spacing={0.75}>
          <Typography component="label" htmlFor="month-start-day" variant="body2">
            {t.dayLabel.value}
          </Typography>
          <TextField
            size="small"
            id="month-start-day"
            value={draft.day}
            disabled={saving}
            onChange={event => setDraft(current => ({ ...current, day: event.target.value }))}
            // The terracotta of a real problem, not the library's red.
            sx={{
              maxWidth: 120,
              '& .MuiOutlinedInput-notchedOutline':
                setting === null ? { borderColor: 'var(--money-down)' } : {},
            }}
            slotProps={{
              htmlInput: {
                inputMode: 'numeric',
                maxLength: 2,
                'aria-describedby': 'month-start-day-help',
                'aria-invalid': setting === null,
              },
            }}
          />
          <Typography
            id="month-start-day-help"
            variant="caption"
            sx={{ color: setting === null ? 'var(--money-down)' : 'var(--text-muted)' }}
          >
            {setting === null ? t.dayInvalid.value : t.dayHint.value}
          </Typography>
        </Stack>
      ) : null}
      {note ? (
        <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
          {note}
        </Typography>
      ) : null}
      {preview ? (
        <Stack component="dl" spacing={0.5} sx={{ m: 0 }} aria-live="polite">
          {[
            { label: t.current.value, value: preview.current },
            { label: t.next.value, value: preview.next },
          ].map(row => (
            <Stack key={row.label} direction="row" spacing={2} sx={{ alignItems: 'baseline' }}>
              <Typography
                component="dt"
                variant="body2"
                sx={{ color: 'var(--text-muted)', minWidth: 140 }}
              >
                {row.label}
              </Typography>
              <Typography
                component="dd"
                variant="body2"
                sx={{ m: 0, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}
              >
                {row.value}
              </Typography>
            </Stack>
          ))}
        </Stack>
      ) : null}
      <div>
        <Button
          onClick={() => setting && void save(setting)}
          disabled={saving || !setting || sameSetting(setting, data?.monthStart)}
        >
          {t.save.value}
        </Button>
      </div>
    </Stack>
  );
}
