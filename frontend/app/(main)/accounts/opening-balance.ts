/** Spaces, no-break spaces and apostrophes people type between thousands. */
const GROUP_SPACES = /[\s  ']/g;

/**
 * The opening balance as typed: "1 500", "1.500", "1,500.50", "1.500,50" and
 * "-200" all read as people mean them; empty is 0; anything else is 'invalid',
 * so the form says so instead of saving a number the person did not type
 * ("1 500" used to be saved as 0, "1.500" as 1.5).
 *
 * The last "." or "," is the decimal mark when one or two digits follow it;
 * with three digits after it, or in every other place, it groups thousands.
 */
export function parseOpeningBalance(text: string): number | 'invalid' {
  const compact = text.replace(GROUP_SPACES, '');
  if (compact === '') {
    return 0;
  }
  const match = /^(-?)(\d[\d.,]*)$/.exec(compact);
  if (!match) {
    return 'invalid';
  }
  const [, sign, digits] = match;
  const last = Math.max(digits.lastIndexOf('.'), digits.lastIndexOf(','));
  const decimals = last >= 0 && digits.length - last - 1 <= 2 ? digits.slice(last + 1) : '';
  const whole = decimals ? digits.slice(0, last) : digits;
  // Grouped thousands: one to three digits, then groups of exactly three.
  if (!/^\d+$/.test(whole) && !/^\d{1,3}([.,]\d{3})+$/.test(whole)) {
    return 'invalid';
  }
  if (decimals && !/^\d{1,2}$/.test(decimals)) {
    return 'invalid';
  }
  const value = Number(`${sign}${whole.replace(/[.,]/g, '')}${decimals ? `.${decimals}` : ''}`);
  return Number.isFinite(value) ? value : 'invalid';
}
