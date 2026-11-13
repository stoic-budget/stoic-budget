/** The contract's bounds for `BalanceCheckBody.balance`: finite, strictly inside ±10^13. */
const LIMIT = 1e13;

/** A decimal separator: the last `.` or `,`, followed by one or two digits. */
const DECIMAL = /^(.*?)([.,])(\d{1,2})$/;
/** Thousands groups: one to three digits, then groups of exactly three. */
const groupsOk = (groups: string[]) =>
  /^\d{1,3}$/.test(groups[0]) && groups.slice(1).every(group => /^\d{3}$/.test(group));

/**
 * The balance as typed into the number the API takes, or null when it cannot
 * be read one way only. Reads `1234.56`, `1234,56`, `1,234.56`, `1.234,56`,
 * `1 234,56`, `-1,000`: a last `.`/`,` with one or two digits after it is the
 * decimal point; any other separator must split the whole part into groups of
 * three. Anything else (`1,2,3`, `12.34.5`, `1,23,456`) is refused rather
 * than guessed. For a debt the person types what is owed; the API keeps a
 * debt below zero, as the opening balance does.
 */
export function parseBankBalance(text: string, isDebt: boolean): number | null {
  let plain = text.trim().replace(/[   ]/g, ' ');
  const negative = /^[-−–]/.test(plain);
  if (negative) {
    plain = plain.slice(1).trim();
  }
  if (!(/^\d[\d., ]*$/.test(plain) && /\d$/.test(plain))) {
    return null;
  }
  const decimal = plain.match(DECIMAL);
  const whole = decimal ? decimal[1] : plain;
  const cents = decimal ? decimal[3] : '';
  if (decimal && whole.includes(decimal[2])) {
    return null;
  }
  const separators = new Set(whole.replace(/\d/g, ''));
  if (separators.size > 1) {
    return null;
  }
  const [separator] = [...separators];
  if (separator !== undefined && !groupsOk(whole.split(separator))) {
    return null;
  }
  const digits = whole.replace(/\D/g, '');
  if (digits === '') {
    return null;
  }
  const value = Number(`${negative ? '-' : ''}${digits}${cents ? `.${cents}` : ''}`);
  if (!Number.isFinite(value) || Math.abs(value) >= LIMIT) {
    return null;
  }
  return isDebt ? -value : value;
}

/** Today as the person's own calendar has it, `YYYY-MM-DD`. */
export function localToday(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
