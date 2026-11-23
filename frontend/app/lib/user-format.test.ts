import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { formatInvoiceDate } from '@/app/(main)/invoices/components/invoices-format';
import { formatDay } from '@/app/(main)/accounts/components/account-detail-styles';
import { formatDate, toDate } from './user-format';

describe('calendar days west of Greenwich', () => {
  const zone = process.env.TZ;
  beforeAll(() => {
    // Node rereads TZ when it changes: New York is five hours behind UTC in March.
    process.env.TZ = 'America/New_York';
  });
  afterAll(() => {
    process.env.TZ = zone;
  });

  it('shows a transaction dated 1 March as 1 March, not 28 February', () => {
    expect(formatDate('2026-03-01', { dateFormat: 'dmy' })).toBe('01.03.2026');
    // The same day as a `date` column serializes it.
    expect(formatDate('2026-03-01T00:00:00.000Z', { dateFormat: 'dmy' })).toBe('01.03.2026');
  });

  it('shows an invoice due on 1 March on 1 March', () => {
    expect(formatInvoiceDate('2026-03-01', 'en-US')).toBe('Mar 1, 2026');
  });

  it('still shows a real instant in local time', () => {
    expect(formatDate('2026-03-01T03:00:00.000Z', { dateFormat: 'dmy' })).toBe('28.02.2026');
  });

  it('shows account and loan days as that day too', () => {
    expect(formatDay('2026-03-01', 'en-US')).toBe('Mar 1, 2026');
  });

  it('reads an impossible day as no day, not one rolled into the next month', () => {
    expect(toDate('2026-13-01')).toBeNull();
    expect(toDate('2026-02-30')).toBeNull();
  });
});
