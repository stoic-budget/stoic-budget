import type { RecurrenceRule } from '@/app/lib/contracts';

export type RepeatFrequency = 'none' | RecurrenceRule['frequency'];
/** Which day of the month a monthly or yearly bill falls on, read off its due date. */
export type MonthMode = 'day' | 'last' | 'weekday' | 'lastWeekday';
export type RepeatEnd = 'never' | 'until' | 'count';

/** What the repeat fields of the bill form hold. */
export interface RepeatDraft {
  frequency: RepeatFrequency;
  interval: string;
  monthMode: MonthMode;
  shift: NonNullable<RecurrenceRule['shift']>;
  end: RepeatEnd;
  until: string;
  count: string;
  /** The rule of a series being edited: its start and its day stay unless changed here. */
  original: RecurrenceRule | null;
}

export const emptyRepeat = (): RepeatDraft => ({
  frequency: 'none',
  interval: '1',
  monthMode: 'day',
  shift: 'none',
  end: 'never',
  until: '',
  count: '',
  original: null,
});

export function toRepeatDraft(rule: RecurrenceRule | null | undefined): RepeatDraft {
  if (!rule) return emptyRepeat();
  const monthMode: MonthMode = rule.nthWeekday
    ? rule.nthWeekday.week === -1
      ? 'lastWeekday'
      : 'weekday'
    : rule.monthDay === 'last'
      ? 'last'
      : 'day';
  return {
    frequency: rule.frequency,
    interval: String(rule.interval),
    monthMode,
    shift: rule.shift ?? 'none',
    end: rule.until ? 'until' : rule.count ? 'count' : 'never',
    until: rule.until ?? '',
    count: rule.count ? String(rule.count) : '',
    original: rule,
  };
}

/** Day of the month, weekday (0 is Sunday) and its week in the month (1–5) of a `YYYY-MM-DD`. */
export function dayParts(day: string): { dayOfMonth: number; weekday: number; week: number } {
  const date = new Date(`${day}T00:00:00Z`);
  const dayOfMonth = date.getUTCDate();
  return { dayOfMonth, weekday: date.getUTCDay(), week: Math.ceil(dayOfMonth / 7) };
}

const wholeNumber = (value: string, min: number, max: number): number | null => {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : null;
};

/**
 * The rule the fields describe, anchored on the bill's due date (the day of
 * the month, the weekday and its week come from it). Null when the bill does
 * not repeat, or when a field is not a usable number yet.
 */
export function toRecurrenceRule(draft: RepeatDraft, dueDate: string): RecurrenceRule | null {
  if (draft.frequency === 'none' || !dueDate) return null;
  const interval = wholeNumber(draft.interval, 1, 366);
  if (interval === null) return null;
  const count = draft.end === 'count' ? wholeNumber(draft.count, 1, 1000) : null;
  if (draft.end === 'count' && count === null) return null;
  if (draft.end === 'until' && !draft.until) return null;
  const { dayOfMonth, weekday, week } = dayParts(dueDate);
  const byMonth = draft.frequency === 'monthly' || draft.frequency === 'yearly';
  const { original } = draft;
  // The mode the form shows: one the due date no longer offers reads as "on day N".
  const monthMode = shownMonthMode(draft.monthMode, dueDate);
  // The same kind of day as before keeps the series' own day (a 31st stays a 31st).
  const keepsDay = original && toRepeatDraft(original).monthMode === monthMode;
  const monthPart: Partial<RecurrenceRule> = !byMonth
    ? {}
    : keepsDay
      ? {
          ...(original.monthDay !== undefined ? { monthDay: original.monthDay } : {}),
          ...(original.nthWeekday ? { nthWeekday: original.nthWeekday } : {}),
        }
      : monthMode === 'last'
        ? { monthDay: 'last' }
        : monthMode === 'weekday'
          ? { nthWeekday: { week: Math.min(week, 4) as 1 | 2 | 3 | 4, weekday } }
          : monthMode === 'lastWeekday'
            ? { nthWeekday: { week: -1, weekday } }
            : { monthDay: dayOfMonth };
  return {
    frequency: draft.frequency,
    interval,
    startDate: original?.startDate ?? dueDate,
    ...monthPart,
    ...(draft.shift !== 'none' ? { shift: draft.shift } : {}),
    ...(draft.end === 'until' ? { until: draft.until } : {}),
    ...(count ? { count } : {}),
  };
}

/** Whether the due date is in the last seven days of its month: only then is "last weekday" offered. */
export function isInLastWeek(day: string): boolean {
  const date = new Date(`${day}T00:00:00Z`);
  const length = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return date.getUTCDate() > length - 7;
}

/** The kinds of day a due date offers: the Nth weekday up to the 4th, the last one in the last week. */
export function monthModesFor(day: string): MonthMode[] {
  return [
    'day',
    'last',
    ...(dayParts(day).week <= 4 ? (['weekday'] as const) : []),
    ...(isInLastWeek(day) ? (['lastWeekday'] as const) : []),
  ];
}

/** The mode the form shows and sends: one the due date does not offer falls back to "on day N". */
export function shownMonthMode(mode: MonthMode, day: string): MonthMode {
  return monthModesFor(day).includes(mode) ? mode : 'day';
}
