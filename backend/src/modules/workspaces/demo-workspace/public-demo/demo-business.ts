import type { DataSource } from 'typeorm';
import { TaxRate } from '../../../../entities/tax-rate.entity';
import { Transaction, TransactionType } from '../../../../entities/transaction.entity';
import type { BusinessProfileService } from '../../../business-profile/business-profile.service';
import type { ClientsService } from '../../../invoices/clients.service';
import type { InvoicesService } from '../../../invoices/invoices.service';
import type { PayablesService } from '../../../payables/payables.service';
import { addDays } from '../demo-dates';

export interface DemoBusinessDeps {
  dataSource: DataSource;
  businessProfile: BusinessProfileService;
  clients: ClientsService;
  invoices: InvoicesService;
  payables: PayablesService;
}

type Ids = { workspaceId: string; userId: string };

/** The studio's own letterhead: an invoice cannot be sent without a name and an address. */
const PROFILE = {
  legalName: 'Fjordline Design Studio',
  addressLines: 'Kastanienallee 12\n10435 Berlin',
  street: 'Kastanienallee 12',
  postalCode: '10435',
  city: 'Berlin',
  countryCode: 'DE',
  email: 'studio@example.com',
  paymentInstructions: 'Please transfer within 14 days, quoting the invoice number.',
};

/**
 * Invoices to two of the generator's clients and the bills the studio owes,
 * dated from the anchor: one invoice paid by an income row that is already
 * in the books, one open, one overdue, one draft; a bill paid by an existing
 * row, two coming up and one overdue.
 */
export async function seedDemoBusiness(
  deps: DemoBusinessDeps,
  ids: Ids,
  anchor: string,
): Promise<void> {
  await deps.businessProfile.update(ids.workspaceId, PROFILE);
  await seedInvoices(deps, ids, anchor);
  await seedBills(deps, ids, anchor);
}

async function seedInvoices(deps: DemoBusinessDeps, ids: Ids, anchor: string): Promise<void> {
  const brightline = await deps.clients.create(ids.workspaceId, {
    name: 'Brightline Studio',
    email: 'billing@brightline.example.com',
    countryCode: 'DE',
    paymentTermsDays: 14,
  });
  const morrow = await deps.clients.create(ids.workspaceId, {
    name: 'Morrow Health AG',
    email: 'accounts@morrow-health.example.com',
    countryCode: 'DE',
    paymentTermsDays: 30,
  });
  const taxRateId = await standardRateId(deps.dataSource, ids.workspaceId);
  const line = (description: string, euros: number) => ({
    description,
    quantity: 1,
    unitPrice: euros,
    ...(taxRateId ? { taxRateId } : {}),
  });
  const draft = (clientId: string, issueDate: string, euros: number, work: string) =>
    deps.invoices.create(ids.workspaceId, {
      clientId,
      issueDate,
      pricesIncludeTax: true,
      lineItems: [line(work, euros)],
    });

  // Paid: the money is the latest income row from this client, already booked.
  const income = await deps.dataSource.getRepository(Transaction).findOne({
    where: {
      workspaceId: ids.workspaceId,
      counterpartyName: 'Brightline Studio',
      transactionType: TransactionType.INCOME,
    },
    order: { transactionDate: 'DESC' },
  });
  if (income?.amount) {
    const paidOn = dayOf(income.transactionDate);
    const paid = await draft(
      brightline.id,
      addDays(paidOn, -12),
      Number(income.amount),
      'Brand identity, phase 2',
    );
    const sent = await deps.invoices.send(paid.id, ids.workspaceId, ids.userId);
    if (sent.payableId) {
      await deps.payables.markAsPaid(sent.payableId, ids.workspaceId, ids.userId, {
        linkedTransactionId: income.id,
      });
    }
  }

  const open = await draft(morrow.id, addDays(anchor, -9), 4_200, 'Patient app, design sprint');
  await deps.invoices.send(open.id, ids.workspaceId, ids.userId);
  const overdue = await draft(morrow.id, addDays(anchor, -48), 1_850, 'Annual report layout');
  await deps.invoices.send(overdue.id, ids.workspaceId, ids.userId);
  await draft(brightline.id, anchor, 2_600, 'Website redesign, discovery');
}

async function seedBills(deps: DemoBusinessDeps, ids: Ids, anchor: string): Promise<void> {
  const bill = (vendor: string, euros: number, dueDate: string, extra: object = {}) =>
    deps.payables.create(ids.workspaceId, ids.userId, {
      direction: 'payable',
      vendor,
      amount: euros,
      currency: 'EUR',
      dueDate,
      source: 'manual',
      ...extra,
    });

  await bill('Lindenhof Immobilien GmbH', 1_450, addDays(anchor, 6), {
    isRecurring: true,
    comment: 'Studio rent, next month',
  });
  await bill('Allianz Versicherung', 386, addDays(anchor, 21), {
    status: 'scheduled',
    comment: 'Professional liability, yearly',
  });
  await bill('Druckerei Weiss', 642.6, addDays(anchor, -5), {
    status: 'overdue',
    comment: 'Brochure print run for Morrow Health',
  });
  const adviser = await deps.dataSource.getRepository(Transaction).findOne({
    where: { workspaceId: ids.workspaceId, counterpartyName: 'Klein & Partner Steuerberatung' },
    order: { transactionDate: 'DESC' },
  });
  if (adviser?.amount) {
    // Paid is what the payment log says: the bill is settled by the booked row.
    const settled = await bill(
      'Klein & Partner Steuerberatung',
      Math.abs(Number(adviser.amount)),
      dayOf(adviser.transactionDate),
      { comment: 'Bookkeeping, monthly' },
    );
    await deps.payables.markAsPaid(settled.id, ids.workspaceId, ids.userId, {
      linkedTransactionId: adviser.id,
    });
  }
}

/** A `date` column comes back as a string, though the entity says Date. */
function dayOf(value: Date | string): string {
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

/** The workspace's 19 % rate, the one German sales usually carry. */
async function standardRateId(dataSource: DataSource, workspaceId: string): Promise<string | null> {
  const rates = await dataSource.getRepository(TaxRate).find({ where: { workspaceId } });
  return rates.find(rate => Number(rate.rate) === 19)?.id ?? null;
}
