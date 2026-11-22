/*
 * Chart design adapted from Aurum by ZProger (https://github.com/ZProger/Aurum).
 * Reimplemented for Seneca; no Aurum source code was copied.
 */

/**
 * Keys (`YYYY-MM` or `YYYY-MM-DD`, ascending) where a new calendar year starts. Charts show an
 * X axis only for these year landmarks, so the list is empty when the data sits inside one year.
 */
export function computeYearTicks(keys: readonly string[]): string[] {
  const ticks: string[] = [];
  for (let index = 1; index < keys.length; index++) {
    if (keys[index].slice(0, 4) !== keys[index - 1].slice(0, 4)) {
      ticks.push(keys[index]);
    }
  }
  return ticks;
}

/** Local-time date for a `YYYY-MM` or `YYYY-MM-DD` key (no UTC shift). */
function parseKey(key: string): Date {
  const [year, month = 1, day = 1] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatMonthLabel(key: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(parseKey(key));
}

/** The month alone ("Oct"), for an axis whose years are marked apart. */
export function formatShortMonthLabel(key: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short' }).format(parseKey(key));
}

export function formatDayLabel(key: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parseKey(key));
}

/** `3 Oct` — no year, for dense X axis ticks on a daily chart. */
export function formatShortDayLabel(key: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(parseKey(key));
}

/** A gain or a balance needs no plus; a loss or a debt keeps its typographic minus. */
export function formatNetAmount(value: number, formatAmount: (value: number) => string): string {
  return value < 0 ? `−${formatAmount(Math.abs(value))}` : formatAmount(value);
}

/** `+1 200 ₸` / `−300 ₸` — the magnitude goes through the caller's currency formatter. */
export function formatSignedAmount(value: number, formatAmount: (value: number) => string): string {
  return `${value >= 0 ? '+' : '−'}${formatAmount(Math.abs(value))}`;
}

/**
 * A number short enough to sit on an axis: 184 600 reads as 184.6K. The axis
 * is there for proportion, not for the exact figure — the tooltip has that.
 */
export function compactNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}
