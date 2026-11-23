import type { Mock } from 'vitest';
import { flowsSql } from '@/common/utils/counted-transactions.util';
import { SmbService } from '../../../../src/modules/smb/smb.service';

function queryBuilder() {
  const qb: Record<string, Mock> = {};
  for (const method of ['leftJoin', 'select', 'where', 'andWhere']) {
    qb[method] = vi.fn(() => qb);
  }
  qb.getRawMany = vi.fn(async () => []);
  return qb;
}

describe('SmbService bank rows', () => {
  it('reconciles bills against confirmed bank rows only', async () => {
    const qb = queryBuilder();
    const transactionRepository = { createQueryBuilder: vi.fn(() => qb) };
    const service = new SmbService(
      {} as never,
      transactionRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    // The rows the reconciliation and ageing views match bills against.
    await (service as unknown as { bankRows(id: string): Promise<unknown[]> }).bankRows('ws-1');

    expect(qb.andWhere).toHaveBeenCalledWith(flowsSql('t'));
  });
});

describe('SmbService invoice reminder', () => {
  const invoice = {
    id: 'inv-1',
    invoiceNumber: 'INV-1',
    status: 'sent',
    total: '1000.00',
    currency: 'EUR',
    dueDate: '2026-01-01',
    clientId: 'client-1',
    payableId: 'payable-1',
  };
  const remind = async (receivable: object) => {
    const mailer = { isConfigured: vi.fn(async () => true), send: vi.fn(async () => true) };
    const service = new SmbService(
      { findOne: vi.fn(async () => receivable) } as never,
      {} as never,
      { findOne: vi.fn(async () => ({ ...invoice })), update: vi.fn(async () => ({ affected: 1 })) } as never,
      { findOne: vi.fn(async () => ({ name: 'ACME Store', email: 'billing@example.com' })) } as never,
      {} as never,
      {} as never,
      mailer as never,
      {} as never,
      { createEvent: vi.fn(async () => undefined) } as never,
    );
    const result = await service.sendInvoiceReminder('ws-1', { name: 'Member One', locale: 'en' } as never, 'inv-1');
    return { result, mail: mailer.send.mock.calls[0]?.[0] as { subject: string; text: string } | undefined };
  };

  it("keeps the invoice's total and says what is still open of it", async () => {
    const { mail } = await remind({ status: 'partially_paid', amount: '1000.00', paidAmount: '900.00' });

    expect(mail?.subject).toContain('1000.00 EUR');
    expect(mail?.text).toContain('Of this, 100.00 EUR is still open.');
  });

  it('refuses a reminder for a paid invoice, whatever its stored status says', async () => {
    await expect(remind({ status: 'paid', amount: '1000.00', paidAmount: '1000.00' })).rejects.toThrow();
  });
});
