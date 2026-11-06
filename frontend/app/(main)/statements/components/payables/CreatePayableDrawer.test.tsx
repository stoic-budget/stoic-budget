// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Payable, PayableStatus } from '@/app/lib/payables-api';
import { categoryItem, walletItem } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { CreatePayableDrawer } from './CreatePayableDrawer';

const apiMocks = vi.hoisted(() => ({ apiQuery: vi.fn() }));

vi.mock('@/app/lib/query-fn', () => ({ apiQuery: apiMocks.apiQuery }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'workspace-1' }));
// One object for every render: the drawer's reset effect depends on these setters.
const currencyPicker = vi.hoisted(() => ({
  currencyDrawerOpen: false,
  setCurrencyDrawerOpen: () => undefined,
  currencySearch: '',
  setCurrencySearch: () => undefined,
  selectedMatchesSearch: false,
  currencyQuery: '',
  recentCurrencyItems: [],
  allCurrencyItems: [],
  pushRecentCurrency: () => undefined,
}));
vi.mock('@/app/hooks/useCurrencyPickerState', () => ({
  useCurrencyPickerState: () => currencyPicker,
}));
vi.mock('@/app/components/receipts/components/CurrencyDrawer', () => ({
  CurrencyDrawer: () => null,
}));
vi.mock('@/app/components/tags/TagPicker', () => ({ TagPicker: () => null }));

const label = (key: string): { value: string } =>
  new Proxy({ value: key } as Record<string, unknown>, {
    get: (target, prop) =>
      prop === Symbol.toPrimitive
        ? () => key
        : prop in target
          ? target[prop as string]
          : label(String(prop)),
  }) as { value: string };
vi.mock('@/app/i18n', () => ({
  useIntlayer: () =>
    new Proxy({}, { get: (_target, key) => label(String(key)) }) as Record<
      string,
      { value: string }
    >,
  useLocale: () => ({ locale: 'en' }),
}));

const labels = {
  createTitle: 'Create',
  editTitle: 'Edit',
  vendor: 'Vendor',
  amount: 'Amount',
  currency: 'Currency',
  dueDate: 'Due date',
  source: 'Source',
  status: 'Status',
  comment: 'Comment',
  save: 'Save',
  saving: 'Saving',
  cancel: 'Cancel',
  sourceOptions: { manual: 'Manual', invoice: 'Invoice', statement: 'Statement' },
  statusOptions: {
    to_pay: 'To receive',
    scheduled: 'Scheduled',
    paid: 'Received',
    overdue: 'Overdue',
    archived: 'Archived',
  },
};

const renderDrawer = (props: { payable?: Payable; currency?: string } = {}) => {
  const onSubmit = vi.fn(async () => undefined);
  renderWithQuery(
    <CreatePayableDrawer
      open
      payable={props.payable}
      direction="receivable"
      defaultCurrency={props.currency ?? 'EUR'}
      onClose={vi.fn()}
      onSubmit={onSubmit}
      labels={labels}
    />,
  );
  return onSubmit;
};

const fillIn = (vendor: string, amount: string) => {
  fireEvent.change(screen.getByLabelText('Vendor'), { target: { value: vendor } });
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: amount } });
};

// The status field has its label through `htmlFor` only, so it is found by its id.
const statusField = () => document.getElementById('payable-status') as HTMLElement;

const settle = async () => {
  fireEvent.mouseDown(statusField());
  fireEvent.click(within(await screen.findByRole('listbox')).getByText('Received'));
};

const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }));

describe('CreatePayableDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.apiQuery.mockImplementation(async ({ url }: { url: string }) =>
      url === '/wallets'
        ? [
            walletItem({ id: 'wallet-usd', name: 'Dollars', currency: 'USD' }),
            walletItem({ id: 'wallet-eur', name: 'Till', currency: 'EUR' }),
            walletItem({ id: 'wallet-eur-2', name: 'Savings', currency: 'EUR' }),
          ]
        : [categoryItem({ id: 'cat-in', name: 'Sales', type: 'income' })],
    );
  });

  it('asks for no account while the money has not moved, and sends no payment', async () => {
    const onSubmit = renderDrawer();
    fillIn('Client One', '250');

    expect(screen.queryByRole('combobox', { name: 'account' })).not.toBeInTheDocument();
    expect(apiMocks.apiQuery).not.toHaveBeenCalled();
    save();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const [payload] = onSubmit.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(payload).toMatchObject({ vendor: 'Client One', amount: 250, status: 'to_pay' });
    expect(payload).not.toHaveProperty('payment');
  });

  it('offers accounts in the entry currency once it is settled, and sends the chosen one', async () => {
    const onSubmit = renderDrawer();
    fillIn('Client One', '250');
    await settle();

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'account' })).toHaveTextContent('Till'),
    );
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'account' }));
    const list = within(await screen.findByRole('listbox'));
    expect(list.queryByText('Dollars')).not.toBeInTheDocument();
    fireEvent.click(list.getByText('Savings'));
    save();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const today = new Date().toISOString().slice(0, 10);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'paid',
        // No due date of its own: it goes by the day it was paid.
        dueDate: today,
        payment: { payFromWalletId: 'wallet-eur-2', paidOn: today, categoryId: undefined },
      }),
    );
  });

  it('falls back to cash in hand when no account has the currency', async () => {
    const onSubmit = renderDrawer({ currency: 'GBP' });
    fillIn('Client One', '250');
    await settle();

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'account' })).toHaveTextContent('inHand'),
    );
    expect(screen.getByText('inHandHint')).toBeInTheDocument();
    save();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ payment: expect.objectContaining({ inHand: true }) }),
    );
  });

  it('does not let an edit turn an open bill paid', async () => {
    renderDrawer({
      payable: {
        id: 'payable-1',
        vendor: 'Client One',
        amount: '250.00',
        currency: 'EUR',
        status: 'to_pay' as PayableStatus,
      } as Payable,
    });

    fireEvent.mouseDown(statusField());
    expect(within(await screen.findByRole('listbox')).queryByText('Received')).not.toBeInTheDocument();
  });
});
