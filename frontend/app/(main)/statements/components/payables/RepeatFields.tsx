'use client';

import type React from 'react';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { FORM_CONTROL_SX, Input } from '@/app/components/ui/input';
import { Select } from '@/app/components/ui/select';
import { useIntlayer, useLocale } from '@/app/i18n';
import {
  dayParts,
  type MonthMode,
  monthModesFor,
  type RepeatDraft,
  type RepeatEnd,
  type RepeatFrequency,
  shownMonthMode,
} from './recurrence-draft';

interface RepeatFieldsProps {
  value: RepeatDraft;
  onChange: (value: RepeatDraft) => void;
  /** The day the repeat is anchored on: the bill's due date, or a series' own day. */
  anchor: string;
  remindDaysBefore: string;
  onRemindChange: (value: string) => void;
}

const fill = (template: string, values: Record<string, string | number>): string =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );

/**
 * How a bill repeats: how often, on which day of the month, what happens on a
 * weekend or holiday, when it ends, and how many days ahead to remind.
 */
export function RepeatFields({
  value,
  onChange,
  anchor,
  remindDaysBefore,
  onRemindChange,
}: RepeatFieldsProps): React.JSX.Element {
  const t = useIntlayer('payableRecurrence');
  const { locale } = useLocale();
  const set = (patch: Partial<RepeatDraft>) => onChange({ ...value, ...patch });
  const repeats = value.frequency !== 'none';
  const byMonth = value.frequency === 'monthly' || value.frequency === 'yearly';
  const parts = anchor ? dayParts(anchor) : null;
  const weekdayName = anchor
    ? new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
        new Date(`${anchor}T00:00:00Z`),
      )
    : '';
  const intervalLabel = {
    none: t.intervalMonths.value,
    daily: t.intervalDays.value,
    weekly: t.intervalWeeks.value,
    monthly: t.intervalMonths.value,
    yearly: t.intervalYears.value,
  }[value.frequency];
  const monthLabels: Record<MonthMode, string> = {
    day: fill(t.monthDay.value, { day: parts?.dayOfMonth ?? '' }),
    last: t.lastDay.value,
    weekday: fill(t.weekdayOfMonth.value, { week: parts?.week ?? '', weekday: weekdayName }),
    lastWeekday: fill(t.lastWeekdayOfMonth.value, { weekday: weekdayName }),
  };
  const monthOptions = anchor
    ? monthModesFor(anchor).map(mode => ({ value: mode, label: monthLabels[mode] }))
    : [];

  return (
    <div className="seneca-payable-drawer__repeat">
      <div className="seneca-payable-drawer__2col">
        <div className="seneca-payable-drawer__field-group">
          <label className="seneca-payable-drawer__field-label" htmlFor="payable-repeat">
            {t.repeats.value}
          </label>
          <Select
            fullWidth
            id="payable-repeat"
            sx={FORM_CONTROL_SX}
            value={value.frequency}
            onChange={next => set({ frequency: next as RepeatFrequency })}
            options={[
              { value: 'none', label: t.never.value },
              { value: 'daily', label: t.daily.value },
              { value: 'weekly', label: t.weekly.value },
              { value: 'monthly', label: t.monthly.value },
              { value: 'yearly', label: t.yearly.value },
            ]}
          />
        </div>
        <div className="seneca-payable-drawer__field-group">
          <label className="seneca-payable-drawer__field-label" htmlFor="payable-remind">
            {t.remindDaysBefore.value}
          </label>
          <Input
            id="payable-remind"
            type="number"
            min="0"
            max="60"
            step="1"
            value={remindDaysBefore}
            onChange={event => onRemindChange(event.target.value)}
          />
        </div>
      </div>

      {repeats && (
        <>
          {!anchor && <p className="seneca-payable-drawer__hint">{t.needsDueDate.value}</p>}
          <div className="seneca-payable-drawer__2col">
            <div className="seneca-payable-drawer__field-group">
              <label className="seneca-payable-drawer__field-label" htmlFor="payable-interval">
                {intervalLabel}
              </label>
              <Input
                id="payable-interval"
                type="number"
                min="1"
                max="366"
                step="1"
                value={value.interval}
                onChange={event => set({ interval: event.target.value })}
              />
            </div>
            {byMonth && monthOptions.length > 0 && (
              <div className="seneca-payable-drawer__field-group">
                <label className="seneca-payable-drawer__field-label" htmlFor="payable-month-day">
                  {t.on.value}
                </label>
                <Select
                  fullWidth
                  id="payable-month-day"
                  sx={FORM_CONTROL_SX}
                  value={shownMonthMode(value.monthMode, anchor)}
                  onChange={next => set({ monthMode: next as MonthMode })}
                  options={monthOptions}
                />
              </div>
            )}
          </div>

          <div className="seneca-payable-drawer__field-group">
            <label className="seneca-payable-drawer__field-label" htmlFor="payable-shift">
              {t.shift.value}
            </label>
            <Select
              fullWidth
              id="payable-shift"
              sx={FORM_CONTROL_SX}
              value={value.shift}
              onChange={next => set({ shift: next as RepeatDraft['shift'] })}
              options={[
                { value: 'none', label: t.shiftNone.value },
                { value: 'previous', label: t.shiftPrevious.value },
                { value: 'next', label: t.shiftNext.value },
              ]}
            />
          </div>

          <div className="seneca-payable-drawer__2col">
            <div className="seneca-payable-drawer__field-group">
              <label className="seneca-payable-drawer__field-label" htmlFor="payable-end">
                {t.ends.value}
              </label>
              <Select
                fullWidth
                id="payable-end"
                sx={FORM_CONTROL_SX}
                value={value.end}
                onChange={next => set({ end: next as RepeatEnd })}
                options={[
                  { value: 'never', label: t.endNever.value },
                  { value: 'until', label: t.endUntil.value },
                  { value: 'count', label: t.endCount.value },
                ]}
              />
            </div>
            {value.end === 'until' && (
              <div className="seneca-payable-drawer__field-group">
                <label className="seneca-payable-drawer__field-label" htmlFor="payable-until">
                  {t.untilLabel.value}
                </label>
                <CustomDatePicker
                  id="payable-until"
                  large
                  value={value.until || null}
                  onChange={next => set({ until: next })}
                />
              </div>
            )}
            {value.end === 'count' && (
              <div className="seneca-payable-drawer__field-group">
                <label className="seneca-payable-drawer__field-label" htmlFor="payable-count">
                  {t.countLabel.value}
                </label>
                <Input
                  id="payable-count"
                  type="number"
                  min="1"
                  max="1000"
                  step="1"
                  value={value.count}
                  onChange={event => set({ count: event.target.value })}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
