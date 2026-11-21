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
  // Another frequency starts from this occurrence, the day the form shows; the
  // same one keeps the series' own start (a weekly series made monthly would
  // otherwise fall on its first week's day of the month).
  const original = draft.original?.frequency === draft.frequency ? draft.original : null;
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
    // Restarted here, a fixed number of payments keeps its total: those made already count.
    ...(count
      ? {
          count:
            draft.original && !original
              ? Math.max(1, count - occurrencesBefore(draft.original, dueDate))
              : count,
        }
      : {}),
  };
}

/** The day of the month a monthly or yearly rule falls on in this month (`month` 0-based). */
function ruleDayIn(rule: RecurrenceRule, year: number, month: number): number {
  const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  if (rule.nthWeekday) {
    const { week, weekday } = rule.nthWeekday;
    if (week === -1) {
      return length - ((new Date(Date.UTC(year, month, length)).getUTCDay() - weekday + 7) % 7);
    }
    const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
    return 1 + ((weekday - first + 7) % 7) + (week - 1) * 7;
  }
  if (rule.monthDay === 'last') return length;
  return Math.min(rule.monthDay ?? dayParts(rule.startDate).dayOfMonth, length);
}

/** How many occurrences of `rule` come before `day`, itself one of them. */
export function occurrencesBefore(rule: RecurrenceRule, day: string): number {
  const start = new Date(`${rule.startDate}T00:00:00Z`);
  const at = new Date(`${day}T00:00:00Z`);
  const days = Math.round((at.getTime() - start.getTime()) / 86_400_000);
  const months =
    (at.getUTCFullYear() - start.getUTCFullYear()) * 12 + at.getUTCMonth() - start.getUTCMonth();
  const units = {
    daily: days,
    weekly: Math.floor(days / 7),
    monthly: months,
    yearly: Math.floor(months / 12),
  }[rule.frequency];
  const byMonth = rule.frequency === 'monthly' || rule.frequency === 'yearly';
  // A rule on the 1st that starts on the 20th has nothing in its first month.
  const emptyFirst =
    byMonth && ruleDayIn(rule, start.getUTCFullYear(), start.getUTCMonth()) < start.getUTCDate();
  return Math.max(0, Math.floor(units / rule.interval) - (emptyFirst ? 1 : 0));
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
