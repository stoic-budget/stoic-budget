import { describe, expect, it } from 'vitest';
import type { StatementForTable } from './StatementsListTable';
import { resolveStatementRowData } from './statement-row-data';

describe('resolveStatementRowData', () => {
  it('names a scanned receipt row by the vendor typed on the receipt', () => {
    const fileName = 'photo_2026-01-02_10-00-00.jpg';
    const vendor = 'ACME Case for Tablet Pro Series';
    const row: StatementForTable = {
      id: 'receipt-1',
      source: 'scan',
      fileName,
      subject: fileName,
      sender: 'camera-scan',
      status: 'approved',
      createdAt: '2026-01-02T10:00:00.000Z',
      bankName: 'receipt',
      fileType: 'receipt',
      parsedData: { amount: 63, currency: 'USD', vendor },
    };

    expect(resolveStatementRowData(row, 'Scanning').merchantLabel).toBe(vendor);
  });
});
