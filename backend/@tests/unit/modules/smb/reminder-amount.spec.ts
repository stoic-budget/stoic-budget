import type { Repository } from 'typeorm';
import type { Invoice } from '../../../../src/entities/invoice.entity';
import { type Payable, PayableStatus } from '../../../../src/entities/payable.entity';
import { amountToRemind } from '../../../../src/modules/smb/reminder-amount';

const payables = (row: Partial<Payable> | null) =>
  ({ findOne: vi.fn(async () => row) }) as unknown as Repository<Payable>;
const invoice = { total: 1200, payableId: 'p-1' } as Invoice;

describe('amountToRemind', () => {
  it('asks for what is left of a partly paid invoice', async () => {
    const owed = payables({ status: PayableStatus.TO_PAY, amount: 1200, paidAmount: 500 });

    expect(await amountToRemind(owed, invoice, 'ws-1')).toBe(700);
  });

  it('asks for nothing once the receivable is paid', async () => {
    const owed = payables({ status: PayableStatus.PAID, amount: 1200, paidAmount: 1200 });

    expect(await amountToRemind(owed, invoice, 'ws-1')).toBeNull();
  });

  it('asks for the total of an invoice without a receivable', async () => {
    expect(await amountToRemind(payables(null), { total: 300, payableId: null } as Invoice, 'ws-1')).toBe(300);
  });
});
