/** What a `decimal(15,2)` column holds, as for the credit limit. */
const MAX_OPENING_BALANCE = 10_000_000_000_000;

/** Marks people type between thousands: spaces, no-break spaces, apostrophes, dots, commas. */
const GROUP_MARK = /[\s  '’.,]/;

/**
 * The opening balance as typed: "1 500", "1.500", "1’500", "1,500.50",
 * "1.500,50", "−200" and ",5" all read as people mean them; empty is 0;
 * anything that could mean two things, or that a column of cents cannot hold,
 * is 'invalid', so the form says so instead of saving a number the person did
 * not type ("1 500" used to be saved as 0, "1.500" as 1.5).
 *
 * The last "." or "," is the decimal mark when one or two digits follow it.
 * Thousands are groups of three after a first group of one to three digits,
 * all split by the same mark, which is not the decimal mark.
 */
export function parseOpeningBalance(text: string): number | 'invalid' {
  const trimmed = text.trim().replace(/−/g, '-');
  if (trimmed === '') {
    return 0;
  }
  const signed = /^(-?)\s*(.*)$/.exec(trimmed);
  const [sign, body] = [signed?.[1] ?? '', signed?.[2] ?? ''];
  const decimal = /^(.*?)([.,])(\d{1,2})$/.exec(body);
  const whole = decimal ? decimal[1] : body;
  const groups = whole.split(GROUP_MARK);
  const marks = new Set(whole.match(new RegExp(GROUP_MARK, 'g')) ?? []);
  const grouped =
    groups.length === 1
      ? /^\d*$/.test(whole) && (whole !== '' || Boolean(decimal))
      : marks.size === 1 &&
        !(decimal && marks.has(decimal[2])) &&
        /^[1-9]\d{0,2}$/.test(groups[0]) &&
        groups.slice(1).every(group => /^\d{3}$/.test(group));
  if (!grouped) {
    return 'invalid';
  }
  const value = Number(`${sign}${groups.join('') || '0'}${decimal ? `.${decimal[3]}` : ''}`);
  return Number.isFinite(value) && Math.abs(value) < MAX_OPENING_BALANCE ? value : 'invalid';
}
