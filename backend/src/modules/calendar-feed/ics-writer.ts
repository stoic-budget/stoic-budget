/**
 * A strict iCalendar (RFC 5545) writer for all-day events: CRLF line ends,
 * content lines folded at 75 octets without splitting a UTF-8 character,
 * TEXT values escaped. Pure functions, no framework.
 */

const CRLF = '\r\n';
/** RFC 5545 §3.1: lines SHOULD NOT be longer than 75 octets, excluding the line break. */
const MAX_OCTETS = 75;

export interface IcsEvent {
  /** Globally unique and the same on every fetch, so a calendar app updates the event in place. */
  uid: string;
  /** The day, `YYYY-MM-DD`; the event lasts the whole day. */
  date: string;
  summary: string;
  description?: string | null;
  /** When the item this event shows last changed (LAST-MODIFIED); none for reference data. */
  lastModified?: Date | null;
  /** Days before the day to remind; null or undefined for no reminder. */
  alarmDaysBefore?: number | null;
}

export interface IcsCalendar {
  /** The product identifier, e.g. `-//Acme//Calendar feed//EN`. */
  prodId: string;
  /** The calendar's display name (X-WR-CALNAME / NAME). */
  name: string;
  /**
   * When this file was made: every event's DTSTAMP, since with a METHOD the
   * stamp is the object's creation time (§3.8.7.2), not the item's.
   */
  stamp: Date;
  events: IcsEvent[];
}

/**
 * A TEXT value (§3.3.11): backslash, semicolon and comma escaped, every line
 * break as `\n`. Other control characters are not allowed in a value and go.
 */
export function escapeText(value: string): string {
  return (
    value
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r\n|\r|\n/g, '\\n')
      // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point
      .replace(/[\u0000-\u0008\u000a-\u001f\u007f]/g, '')
  );
}

/**
 * One content line folded (§3.1): no physical line over 75 octets, the
 * continuation lines starting with a space (which counts). Folds between
 * code points, so a multi-byte character is never cut in two.
 */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = '';
  let octets = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char, 'utf8');
    if (octets + size > MAX_OCTETS) {
      parts.push(current);
      current = ` ${char}`;
      octets = 1 + size;
    } else {
      current += char;
      octets += size;
    }
  }
  parts.push(current);
  return parts.join(CRLF);
}

/** `YYYY-MM-DD` → `YYYYMMDD` (a DATE value). */
export function icsDate(day: string): string {
  return day.slice(0, 10).replace(/-/g, '');
}

/** The day after `YYYY-MM-DD`: an all-day event's DTEND is exclusive. */
export function nextDay(day: string): string {
  const next = new Date(`${day.slice(0, 10)}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/** A UTC DATE-TIME, `YYYYMMDDTHHMMSSZ`. */
export function icsTimestamp(at: Date): string {
  return `${at.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`;
}

function eventLines(event: IcsEvent, stamp: Date): string[] {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${escapeText(event.uid)}`,
    `DTSTAMP:${icsTimestamp(stamp)}`,
    `DTSTART;VALUE=DATE:${icsDate(event.date)}`,
    `DTEND;VALUE=DATE:${icsDate(nextDay(event.date))}`,
    `SUMMARY:${escapeText(event.summary)}`,
  ];
  if (event.lastModified) {
    lines.push(`LAST-MODIFIED:${icsTimestamp(event.lastModified)}`);
  }
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  }
  // A money date does not make anyone busy.
  lines.push('TRANSP:TRANSPARENT');
  if (event.alarmDaysBefore != null && event.alarmDaysBefore >= 0) {
    const days = Math.trunc(event.alarmDaysBefore);
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(event.summary)}`,
      days === 0 ? 'TRIGGER:PT0S' : `TRIGGER:-P${days}D`,
      'END:VALARM',
    );
  }
  lines.push('END:VEVENT');
  return lines;
}

/** The whole VCALENDAR object, every line folded and ended with CRLF. */
export function buildCalendar(calendar: IcsCalendar): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${escapeText(calendar.prodId)}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `NAME:${escapeText(calendar.name)}`,
    `X-WR-CALNAME:${escapeText(calendar.name)}`,
    // RFC 7986: how often a calendar app should read the feed again.
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
    ...calendar.events.flatMap(event => eventLines(event, calendar.stamp)),
    'END:VCALENDAR',
  ];
  return lines.map(line => `${foldLine(line)}${CRLF}`).join('');
}
