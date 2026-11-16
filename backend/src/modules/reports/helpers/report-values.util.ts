// Cell values, dates and periods as the reports read them: custom-table cells
// are free text, so numbers and dates are parsed leniently.

function toParsableDateInput(value: unknown): string | number | Date | null {
  if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) {
    return value;
  }

  return null;
}

export function toStartOfUtcDay(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

export function toEndOfUtcDay(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(23, 59, 59, 999);
  return copy;
}

export function formatMonthPeriod(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

export function formatMonthLabel(date: Date): string {
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${month}.${year}`;
}

export function getIsoWeekInfo(date: Date): { year: number; week: number } {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: target.getUTCFullYear(), week };
}

export function normalizeText(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const text = String(value).trim();
  return text.length ? text : null;
}

export function parseNumber(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const raw = String(value).trim();
  if (!raw.length) {
    return null;
  }

  const normalized = raw
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, '')
    .replace(/,/g, '.');

  if (!/^[-+]?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }
  const asNumber = Number(normalized);
  return Number.isFinite(asNumber) ? asNumber : null;
}

export function parseDate(value: unknown): Date | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw.length) {
      return null;
    }
    const v = raw.split('T')[0];

    const ymd = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) {
      const year = Number(ymd[1]);
      const month = Number(ymd[2]);
      const day = Number(ymd[3]);
      return new Date(Date.UTC(year, month - 1, day));
    }

    const dmyDot = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (dmyDot) {
      const day = Number(dmyDot[1]);
      const month = Number(dmyDot[2]);
      const year = Number(dmyDot[3]);
      return new Date(Date.UTC(year, month - 1, day));
    }

    const dmySlash = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmySlash) {
      const day = Number(dmySlash[1]);
      const month = Number(dmySlash[2]);
      const year = Number(dmySlash[3]);
      return new Date(Date.UTC(year, month - 1, day));
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  try {
    const dateInput = toParsableDateInput(value);
    if (dateInput === null) {
      return null;
    }

    const parsed = new Date(dateInput);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

export function toDateKey(value: unknown): string {
  if (typeof value === 'string') {
    // Postgres DATE columns often come back as 'YYYY-MM-DD'
    return value.split('T')[0];
  }
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  try {
    const dateInput = toParsableDateInput(value);
    if (dateInput === null) {
      return new Date().toISOString().split('T')[0];
    }

    const asDate = new Date(dateInput);
    if (!Number.isNaN(asDate.getTime())) {
      return asDate.toISOString().split('T')[0];
    }
  } catch {
    // ignore
  }
  return new Date().toISOString().split('T')[0];
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The calendar day of a `date` column as YYYY-MM-DD. Postgres hands such a
 * column back as that string, not as the `Date` the entity declares, so
 * calling Date methods on it throws.
 */
export function dayOf(value: Date | string): string {
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}
