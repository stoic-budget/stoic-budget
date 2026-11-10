import { resolveLocaleTag } from '@/app/lib/user-format';
import { formatStoredDateTime } from '@/app/lib/user-format-store';

/** Fills `{{name}}` slots; a replacer function, so a `$&` in a value stays literal. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (slot, name: string) => values[name] ?? slot);
}

export function formatHealthTime(iso: string, locale: string): string {
  return formatStoredDateTime(iso, locale);
}

/** "12 minutes", "3 hours", "2 days" in the reader's language. */
export function formatWait(seconds: number, locale: string): string {
  const tag = resolveLocaleTag(locale);
  const [value, unit] =
    seconds < 3600
      ? [Math.max(1, Math.round(seconds / 60)), 'minute']
      : seconds < 2 * 86400
        ? [Math.round(seconds / 3600), 'hour']
        : [Math.round(seconds / 86400), 'day'];
  return new Intl.NumberFormat(tag, { style: 'unit', unit, unitDisplay: 'long' }).format(value);
}

/** Free space: gigabytes with one decimal, megabytes below one. */
export function formatBytes(bytes: number, locale: string): string {
  const tag = resolveLocaleTag(locale);
  const gib = bytes / 1024 ** 3;
  return gib >= 1
    ? new Intl.NumberFormat(tag, {
        style: 'unit',
        unit: 'gigabyte',
        maximumFractionDigits: 1,
      }).format(gib)
    : new Intl.NumberFormat(tag, {
        style: 'unit',
        unit: 'megabyte',
        maximumFractionDigits: 0,
      }).format(bytes / 1024 ** 2);
}
