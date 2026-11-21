import {
  buildCalendar,
  escapeText,
  foldLine,
  type IcsEvent,
  nextDay,
} from '../../../../src/modules/calendar-feed/ics-writer';

const octets = (line: string) => Buffer.byteLength(line, 'utf8');
/** Undoes folding (§3.1): a CRLF followed by one space joins the lines. */
const unfold = (text: string) => text.replace(/\r\n /g, '');

const stamp = new Date('2026-11-09T08:30:00.000Z');
const changed = new Date('2026-10-01T12:00:00.000Z');
const event = (overrides: Partial<IcsEvent> = {}): IcsEvent => ({
  uid: 'payable-1@example.co.il',
  date: '2026-11-30',
  summary: 'Pay ACME Store',
  ...overrides,
});

describe('ICS writer', () => {
  describe('escapeText', () => {
    it('escapes backslash, semicolon, comma and every kind of line break', () => {
      expect(escapeText('a\\b;c,d')).toBe('a\\\\b\\;c\\,d');
      expect(escapeText('one\r\ntwo\nthree\rfour')).toBe('one\\ntwo\\nthree\\nfour');
    });

    it('escapes the backslash first, so an escape is never escaped twice', () => {
      expect(escapeText(',')).toBe('\\,');
      expect(escapeText('\\,')).toBe('\\\\\\,');
    });

    it('drops control characters a value may not carry, but keeps a tab', () => {
      expect(escapeText('ACME\u0000 Store\u0007\tBuds')).toBe('ACME Store\tBuds');
    });
  });

  describe('foldLine', () => {
    it('leaves a line of 75 octets alone and folds the 76th onto a new line', () => {
      const exact = `SUMMARY:${'x'.repeat(67)}`;
      expect(octets(exact)).toBe(75);
      expect(foldLine(exact)).toBe(exact);
      const folded = foldLine(`${exact}y`);
      expect(folded).toBe(`${exact}\r\n y`);
    });

    it('keeps every physical line within 75 octets, the leading space included', () => {
      const line = `DESCRIPTION:${'ACME Store - Wireless Buds, '.repeat(12)}`;
      const lines = foldLine(line).split('\r\n');
      expect(lines.length).toBeGreaterThan(2);
      for (const physical of lines) {
        expect(octets(physical)).toBeLessThanOrEqual(75);
      }
      expect(lines.slice(1).every(physical => physical.startsWith(' '))).toBe(true);
      expect(unfold(foldLine(line))).toBe(line);
    });

    it('never splits a multi-byte character, whatever its width', () => {
      // Two-, three- and four-byte characters, and a narrow no-break space from currency formatting.
      const line = `SUMMARY:${'Оплата ACME Store · 12 345,00 € — 支払い 💳 '.repeat(6)}`;
      const lines = foldLine(line).split('\r\n');
      for (const physical of lines) {
        expect(octets(physical)).toBeLessThanOrEqual(75);
        // A cut character would not survive a round trip through bytes.
        expect(Buffer.from(physical, 'utf8').toString('utf8')).toBe(physical);
        expect(physical).not.toContain('�');
      }
      expect(unfold(lines.join('\r\n'))).toBe(line);
    });

    it('folds before a character that would cross the limit, not inside it', () => {
      // 74 octets of ASCII then a 3-byte character: it moves whole to the next line.
      const line = `${'a'.repeat(74)}€`;
      expect(foldLine(line)).toBe(`${'a'.repeat(74)}\r\n €`);
    });
  });

  describe('buildCalendar', () => {
    const build = (events: IcsEvent[]) =>
      buildCalendar({
        prodId: '-//ACME Books//Calendar feed//EN',
        name: 'ACME Books, money',
        stamp,
        events,
      });

    it('ends every line with CRLF and has no bare LF or CR', () => {
      const text = build([event({ description: 'line one\nline two' })]);
      expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true);
      expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    });

    it('wraps the events in a VCALENDAR with version, PRODID and an escaped name', () => {
      const lines = unfold(build([event()])).split('\r\n');
      expect(lines.slice(0, 3)).toEqual([
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//ACME Books//Calendar feed//EN',
      ]);
      expect(lines).toContain('X-WR-CALNAME:ACME Books\\, money');
      expect(lines).toContain('METHOD:PUBLISH');
    });

    it('writes an all-day event: DTSTART as a DATE and DTEND the next day, with UID and DTSTAMP', () => {
      const lines = unfold(build([event({ date: '2026-12-31' })])).split('\r\n');
      expect(lines).toContain('UID:payable-1@example.co.il');
      expect(lines).toContain('DTSTAMP:20261109T083000Z');
      expect(lines).toContain('DTSTART;VALUE=DATE:20261231');
      expect(lines).toContain('DTEND;VALUE=DATE:20270101');
    });

    it('stamps every event with the time the file was made, and the item change as LAST-MODIFIED', () => {
      // With METHOD:PUBLISH, DTSTAMP is the object's creation time (§3.8.7.2), not the item's.
      const lines = unfold(build([event({ lastModified: changed }), event({ uid: 'tax-1' })])).split(
        '\r\n',
      );
      expect(lines.filter(line => line.startsWith('DTSTAMP:'))).toEqual([
        'DTSTAMP:20261109T083000Z',
        'DTSTAMP:20261109T083000Z',
      ]);
      expect(lines.filter(line => line.startsWith('LAST-MODIFIED:'))).toEqual([
        'LAST-MODIFIED:20261001T120000Z',
      ]);
    });

    it('escapes the summary and description', () => {
      const text = unfold(
        build([event({ summary: 'Pay ACME Store, Inc; ok', description: 'Due\nsoon\\later' })]),
      );
      expect(text).toContain('SUMMARY:Pay ACME Store\\, Inc\\; ok\r\n');
      expect(text).toContain('DESCRIPTION:Due\\nsoon\\\\later\r\n');
    });

    it('adds a display alarm the given number of days before, and none without one', () => {
      const withAlarm = unfold(build([event({ alarmDaysBefore: 3 })]));
      expect(withAlarm).toContain(
        'BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Pay ACME Store\r\nTRIGGER:-P3D\r\nEND:VALARM\r\n',
      );
      expect(unfold(build([event({ alarmDaysBefore: 0 })]))).toContain('TRIGGER:PT0S\r\n');
      expect(build([event({ alarmDaysBefore: null })])).not.toContain('VALARM');
      expect(build([event()])).not.toContain('VALARM');
    });

    it('folds long summaries in multi-byte text within the limit', () => {
      const text = build([event({ summary: `Оплатить ${'ACME Store – беспроводные наушники '.repeat(5)}` })]);
      for (const line of text.split('\r\n').filter(Boolean)) {
        expect(octets(line)).toBeLessThanOrEqual(75);
      }
    });
  });

  it('nextDay crosses months, years and leap days', () => {
    expect(nextDay('2026-01-31')).toBe('2026-02-01');
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
    expect(nextDay('2028-02-28')).toBe('2028-02-29');
  });
});
