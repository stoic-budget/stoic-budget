// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoice = {
  id: 'inv-1',
  status: 'draft',
  invoiceNumber: null,
  clientId: 'client-1',
  client: { id: 'client-1', name: 'ACME Store', email: 'member-1@example.com' },
  issueDate: '2026-11-01',
  dueDate: '2026-12-01',
  currency: 'EUR',
  total: '100.00',
  subtotal: '100.00',
  taxTotal: '0.00',
  lineItems: [],
  pricesIncludeTax: false,
  isRecurring: false,
  recurrenceInterval: null,
};
const api = vi.hoisted(() => ({
  getOne: vi.fn(),
  send: vi.fn(),
  deliveries: vi.fn(async () => []),
}));
vi.mock('@/app/lib/invoices-api', () => ({ invoicesApi: api, clientsApi: { list: vi.fn(async () => []) } }));
vi.mock('@/app/lib/credit-notes-api', () => ({
  creditNotesApi: { list: vi.fn(async () => []), forInvoice: vi.fn(async () => []) },
}));
// The form's own lookups (tax rates, clients): empty.
vi.mock('@/app/lib/api', () => ({ default: { get: vi.fn(async () => ({ data: [] })) } }));
vi.mock('@/app/lib/payables-api', () => ({ payablesApi: {} }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
const workspace = { currentWorkspace: { id: 'ws-1', currency: 'EUR' } };
vi.mock('@/app/contexts/WorkspaceContext', () => ({ useWorkspace: () => workspace }));
vi.mock('@/app/components/CustomDatePicker', () => ({ default: () => null }));
vi.mock('./PeppolPanel', () => ({ PeppolPanel: () => null }));
vi.mock('./invoice-wizard/InvoiceWizard', () => ({ InvoiceWizard: () => null }));
vi.mock('@/app/i18n', () => {
  // Any path of keys reads as its last key: t.actions.send.value === 'send'.
  const keys = (name: string): unknown =>
    new Proxy(Object.assign(() => name, { value: name, toString: () => name }), {
      get: (target, key) =>
        typeof key === 'symbol' || key in target ? Reflect.get(target, key) : keys(key),
    });
  return { useIntlayer: () => keys('root'), useLocale: () => ({ locale: 'en' }) };
});

import { InvoiceDetailView } from './InvoiceDetailView';

describe('InvoiceDetailView, issuing', () => {
  beforeEach(() => {
    api.getOne.mockResolvedValue(invoice);
    api.send.mockResolvedValue({ ...invoice, status: 'sent', invoiceNumber: 'INV-0007', shareToken: 'tok' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('opens the email to the client right after issuing: issued is not sent', async () => {
    render(<InvoiceDetailView invoiceId="inv-1" />);

    fireEvent.click(await screen.findByText('send'));

    const to = (await screen.findByLabelText('emailRecipient')) as HTMLInputElement;
    expect(to.value).toBe('member-1@example.com');
  });
});
