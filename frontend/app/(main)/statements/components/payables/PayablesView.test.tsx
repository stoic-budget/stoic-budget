import { fireEvent, screen, waitFor } from '@testing-library/react';
import { createTestQueryClient, renderWithQuery } from '@/app/test/query-wrapper';
import React from 'react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { selectOption } from '@/app/test/select';
// Статический импорт (vi.mock поднимается выше): динамический в первом тесте
// грузил модуль внутри его 5-секундного таймаута и падал под нагрузкой.
import { PayablesView } from './PayablesView';

const navigationState = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
}));

const authState = vi.hoisted(() => ({
  user: { id: 'user-1' },
  loading: false,
}));

const workspaceState = vi.hoisted(() => ({
  currentWorkspace: { id: 'workspace-1', currency: 'KZT' },
  loading: false,
}));

const apiMocks = vi.hoisted(() => ({
  list: vi.fn(),
  getOne: vi.fn(),
  getSummary: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  markAsPaid: vi.fn(),
  addPayment: vi.fn(),
  removePayment: vi.fn(),
  archive: vi.fn(),
  delete: vi.fn(),
  exportList: vi.fn(),
}));

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

// The dialog has its own test; here it only has to hand the choice back —
// either a full settlement or one payment among several.
vi.mock('./MarkPaidDialog', () => ({
  MarkPaidDialog: (props: {
    payable: { id: string } | null;
    onConfirm: (
      payable: { id: string },
      result: { kind: 'full' | 'payment'; payload: Record<string, unknown> },
    ) => void;
    onRemovePayment: (payable: { id: string }, paymentId: string) => void;
  }) =>
    props.payable ? (
      <>
        <button
          type="button"
          onClick={() =>
            props.onConfirm(props.payable as { id: string }, {
              kind: 'full',
              payload: { payFromWalletId: 'wallet-1' },
            })
          }
        >
          Confirm payment
        </button>
        <button
          type="button"
          onClick={() =>
            props.onConfirm(props.payable as { id: string }, {
              kind: 'payment',
              payload: { amount: 400 },
            })
          }
        >
          Confirm part
        </button>
        <button
          type="button"
          onClick={() => props.onRemovePayment(props.payable as { id: string }, 'payment-1')}
        >
          Remove payment
        </button>
      </>
    ) : null,
}));

vi.mock('@/app/hooks/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => workspaceState,
}));

vi.mock('@/app/hooks/useTags', () => ({
  useTags: () => ({ data: [], isSuccess: true }),
}));

vi.mock('@/app/i18n', async () => {
  // Every dictionary is served for real (English), so the labels below are the shipped copy.
  const { useIntlayer } = await vi.importActual<typeof import('react-intlayer')>('react-intlayer');
  return { useLocale: () => ({ locale: 'en' }), useIntlayer };
});

vi.mock('next/navigation', () => ({
  useSearchParams: () => navigationState.searchParams,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/statements/pay',
}));

vi.mock('@mui/x-date-pickers/DatePicker', async () => {
  const ReactModule = await import('react');
  return {
    DatePicker: ({ label }: { label: string }) =>
      ReactModule.createElement('input', { 'aria-label': label, readOnly: true }),
  };
});

vi.mock('@/app/lib/payables-api', () => ({
  __esModule: true,
  default: apiMocks,
  payablesApi: apiMocks,
}));

vi.mock('react-hot-toast', () => ({
  default: toastMock,
}));

vi.mock('@/app/components/ui/dropdown-menu', () => {
  const ReactModule = React;
  const DropdownContext = ReactModule.createContext<{
    open: boolean;
    setOpen: (open: boolean) => void;
  } | null>(null);

  return {
    DropdownMenu: ({ children }: { children: React.ReactNode }) => {
      const [open, setOpen] = ReactModule.useState(false);
      return (
        <DropdownContext.Provider value={{ open, setOpen }}>{children}</DropdownContext.Provider>
      );
    },
    DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => {
      const context = ReactModule.useContext(DropdownContext);
      if (!ReactModule.isValidElement(children)) {
        return <>{children}</>;
      }

      const child = children as React.ReactElement<{ onClick?: (event: React.MouseEvent) => void }>;

      return ReactModule.cloneElement(child, {
        onClick: (event: React.MouseEvent) => {
          child.props.onClick?.(event);
          context?.setOpen(!context.open);
        },
      });
    },
    DropdownMenuContent: ({ children }: { children: React.ReactNode }) => {
      const context = ReactModule.useContext(DropdownContext);
      if (!context?.open) {
        return null;
      }
      return <div>{children}</div>;
    },
    DropdownMenuItem: ({
      children,
      onClick,
    }: { children: React.ReactNode; onClick?: () => void }) => {
      const context = ReactModule.useContext(DropdownContext);
      return (
        <button
          type="button"
          onClick={() => {
            onClick?.();
            context?.setOpen(false);
          }}
        >
          {children}
        </button>
      );
    },
  };
});

describe('PayablesView', () => {
  beforeEach(() => {
    navigationState.searchParams = new URLSearchParams();
    Object.values(apiMocks).forEach(mockFn => mockFn.mockReset());
    toastMock.success.mockReset();
    toastMock.error.mockReset();

    apiMocks.getSummary.mockResolvedValue({
      toPay: 1200,
      overdue: 300,
      dueThisWeek: 450,
      paidThisMonth: 800,
      paidTotal: 1800,
      toPayCount: 2,
      overdueCount: 1,
      paidTotalCount: 2,
      dueThisWeekCount: 1,
      unbookedTotal: 0,
      unbookedCount: 0,
      convertedCurrencies: [],
    });
    apiMocks.list.mockResolvedValue({
      data: [
        {
          id: 'payable-1',
          vendor: 'ACME LLC',
          amount: 1200,
          currency: 'KZT',
          dueDate: '2026-03-28',
          status: 'to_pay',
          linkedTransactionId: null,
          source: 'manual',
          isRecurring: false,
          comment: 'Office supplies',
          statementId: null,
          paidAt: null,
          dueSoonNotifiedAt: null,
          createdAt: '2026-03-20T00:00:00.000Z',
          updatedAt: '2026-03-20T00:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    apiMocks.markAsPaid.mockResolvedValue({});
    apiMocks.addPayment.mockResolvedValue({ id: 'payable-1', status: 'partially_paid' });
    apiMocks.exportList.mockResolvedValue({
      blob: new Blob(['csv'], { type: 'text/csv' }),
      fileName: 'payables.csv',
      contentType: 'text/csv',
    });
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    HTMLAnchorElement.prototype.click = vi.fn();
  });

  it('loads summary and list data', async () => {
    const createObjectUrl = vi.fn(() => 'blob:payables');
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(window.URL, 'createObjectURL', {
      value: createObjectUrl,
      writable: true,
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      value: revokeObjectUrl,
      writable: true,
    });

    renderWithQuery(<PayablesView />);

    expect(await screen.findByText('ACME LLC')).toBeInTheDocument();
    expect(screen.getAllByText('Paid').length).toBeGreaterThan(0);
    // Overview figures in whole units; the first card is everything open, overdue included.
    expect(screen.getByText('KZT 1,800')).toBeInTheDocument();
    expect(screen.getByText('KZT 1,500')).toBeInTheDocument();
    expect(screen.queryByText('Sort')).not.toBeInTheDocument();
    expect(apiMocks.getSummary).toHaveBeenCalledTimes(1);
    expect(apiMocks.list).toHaveBeenCalledTimes(1);
  });

  it('marks a payable as paid through the payment dialog', async () => {
    renderWithQuery(<PayablesView />);

    const button = await screen.findByRole('button', { name: 'Mark paid' });
    fireEvent.click(button);
    expect(apiMocks.markAsPaid).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm payment' }));

    await waitFor(() => {
      expect(apiMocks.markAsPaid).toHaveBeenCalledWith('payable-1', {
        payFromWalletId: 'wallet-1',
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Confirm payment' })).not.toBeInTheDocument();
    });
    expect(toastMock.success).toHaveBeenCalledWith('Marked as paid');
  });

  it('keeps the dialog open when the payment leaves the bill partly unpaid', async () => {
    renderWithQuery(<PayablesView />);

    fireEvent.click(await screen.findByRole('button', { name: 'Mark paid' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm part' }));

    await waitFor(() => {
      expect(apiMocks.addPayment).toHaveBeenCalledWith('payable-1', { amount: 400 });
    });
    expect(apiMocks.markAsPaid).not.toHaveBeenCalled();
    // Still short, so the next instalment can be recorded straight away.
    expect(screen.getByRole('button', { name: 'Confirm part' })).toBeInTheDocument();
  });

  it('opens currency drawer from the payable form currency field', async () => {
    renderWithQuery(<PayablesView />);

    await screen.findByText('ACME LLC');
    fireEvent.click(screen.getByRole('button', { name: 'Add payable' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Currency' }));

    expect(await screen.findByText('Select a currency')).toBeInTheDocument();
    const usdOption = screen.getAllByText(/^USD -/)[0].closest('button');
    expect(usdOption).not.toBeNull();
    fireEvent.click(usdOption as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Currency' })).toHaveTextContent('USD');
    });
  });

  it('uses receivable wording and illustration for the receive direction', async () => {
    apiMocks.list.mockResolvedValueOnce({ data: [], total: 0, page: 1, limit: 20, totalPages: 1 });

    const { container } = renderWithQuery(<PayablesView direction="receivable" />);

    expect(await screen.findByText('No receivables found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add receivable' })).toBeInTheDocument();
    expect(screen.getByText('To receive')).toBeInTheDocument();
    // Empty states draw a line icon in a circle now, not a picture.
    expect(container.querySelector('.seneca-empty-state__icon svg')).not.toBeNull();
    expect(apiMocks.getSummary).toHaveBeenCalledWith('receivable');
  });

  it('preselects the workspace currency when adding an entry', async () => {
    workspaceState.currentWorkspace = { id: 'workspace-1', currency: 'usd' };

    try {
      renderWithQuery(<PayablesView />);

      await screen.findByText('ACME LLC');
      fireEvent.click(screen.getByRole('button', { name: 'Add payable' }));

      expect(await screen.findByRole('button', { name: 'Currency' })).toHaveTextContent('USD');
    } finally {
      workspaceState.currentWorkspace = { id: 'workspace-1', currency: 'KZT' };
    }
  });

  it('does not offer mark paid for archived rows', async () => {
    apiMocks.list.mockResolvedValueOnce({
      data: [
        {
          id: 'payable-archived',
          vendor: 'Archived Vendor',
          amount: 100,
          currency: 'KZT',
          dueDate: '2026-03-28',
          status: 'archived',
          linkedTransactionId: null,
          source: 'manual',
          isRecurring: false,
          comment: null,
          statementId: null,
          paidAt: null,
          dueSoonNotifiedAt: null,
          createdAt: '2026-03-20T00:00:00.000Z',
          updatedAt: '2026-03-20T00:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    renderWithQuery(<PayablesView />);

    expect(await screen.findByText('Archived Vendor')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark paid' })).not.toBeInTheDocument();
  });

  it('asks for confirmation before deleting', async () => {
    (window.confirm as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);

    renderWithQuery(<PayablesView />);

    await screen.findByText('ACME LLC');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    });

    fireEvent.click(await screen.findByText('Delete'));

    expect(window.confirm).toHaveBeenCalledWith('Delete ACME LLC?');
    expect(apiMocks.delete).not.toHaveBeenCalled();
  });

  it('corrects to the last available page after filtered results shrink', async () => {
    apiMocks.list
      .mockResolvedValueOnce({
        data: [
          {
            id: 'payable-41',
            vendor: 'Page Two Vendor',
            amount: 10,
            currency: 'KZT',
            dueDate: '2026-03-28',
            status: 'to_pay',
            linkedTransactionId: null,
            source: 'manual',
            isRecurring: false,
            comment: null,
            statementId: null,
            paidAt: null,
            dueSoonNotifiedAt: null,
            createdAt: '2026-03-20T00:00:00.000Z',
            updatedAt: '2026-03-20T00:00:00.000Z',
          },
        ],
        total: 21,
        page: 2,
        limit: 20,
        totalPages: 2,
      })
      .mockResolvedValueOnce({
        data: [],
        total: 20,
        page: 2,
        limit: 20,
        totalPages: 1,
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'payable-1',
            vendor: 'Page One Vendor',
            amount: 10,
            currency: 'KZT',
            dueDate: '2026-03-28',
            status: 'to_pay',
            linkedTransactionId: null,
            source: 'manual',
            isRecurring: false,
            comment: null,
            statementId: null,
            paidAt: null,
            dueSoonNotifiedAt: null,
            createdAt: '2026-03-20T00:00:00.000Z',
            updatedAt: '2026-03-20T00:00:00.000Z',
          },
        ],
        total: 20,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

    renderWithQuery(<PayablesView />);

    await screen.findByText('Page Two Vendor');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Go to page 2' }));
    });

    await screen.findByText('Page One Vendor');
    // Back to a single page: no page count and no page buttons.
    expect(screen.queryByText('Showing 1–20 of 20')).not.toBeInTheDocument();
  });

  it('applies status filter from search params on first load', async () => {
    navigationState.searchParams = new URLSearchParams('status=overdue');

    renderWithQuery(<PayablesView />);

    await screen.findByText('ACME LLC');

    await waitFor(() => {
      expect(apiMocks.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'overdue' }));
    });
  });

  const openRowAction = async (action: string) => {
    await screen.findByText('ACME LLC');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    });
    fireEvent.click(await screen.findByText(action));
  };

  it('says why the list could not load', async () => {
    apiMocks.list.mockRejectedValueOnce(new Error('the server is away'));

    renderWithQuery(<PayablesView />);

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('the server is away'));
  });

  it('edits the freshly read entry, then reloads without the skeleton', async () => {
    const entry = (await apiMocks.list()).data[0];
    apiMocks.list.mockClear();
    apiMocks.getOne.mockResolvedValue({ ...entry, comment: 'Read just now' });
    apiMocks.update.mockResolvedValue({});

    renderWithQuery(<PayablesView />);
    await openRowAction('Edit');
    expect(await screen.findByDisplayValue('Read just now')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(apiMocks.update).toHaveBeenCalledWith(
        'payable-1',
        expect.objectContaining({ comment: 'Read just now' }),
      ),
    );
    await waitFor(() => expect(apiMocks.list).toHaveBeenCalledTimes(2));
    expect(toastMock.success).toHaveBeenCalledWith('Payable updated');
    expect(screen.getByText('ACME LLC')).toBeInTheDocument();
  });

  it('keeps the form open when saving fails', async () => {
    apiMocks.create.mockRejectedValue(new Error('vendor refused'));

    renderWithQuery(<PayablesView />);
    await screen.findByText('ACME LLC');
    fireEvent.click(screen.getByRole('button', { name: 'Add payable' }));
    fireEvent.change(await screen.findByLabelText(/Vendor/), { target: { value: 'Example Shop' } });
    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('vendor refused'));
    expect(apiMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ direction: 'payable' }),
      expect.any(String),
    );
    expect(screen.getByDisplayValue('Example Shop')).toBeInTheDocument();

    // Saving the same form again is the same request: it must not book the money twice.
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(apiMocks.create).toHaveBeenCalledTimes(2));
    expect(apiMocks.create.mock.calls[1][1]).toBe(apiMocks.create.mock.calls[0][1]);
  });

  it('archives and reloads', async () => {
    apiMocks.archive.mockResolvedValue({});
    renderWithQuery(<PayablesView />);

    await openRowAction('Archive');

    await waitFor(() => expect(apiMocks.archive).toHaveBeenCalledWith('payable-1'));
    await waitFor(() => expect(apiMocks.list).toHaveBeenCalledTimes(2));
    expect(toastMock.success).toHaveBeenCalledWith('Payable archived');
  });

  it('deletes after confirmation, and reports a refusal', async () => {
    apiMocks.delete.mockRejectedValueOnce(new Error('still linked'));
    renderWithQuery(<PayablesView />);

    await openRowAction('Delete');

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('still linked'));
    expect(apiMocks.list).toHaveBeenCalledTimes(1);

    apiMocks.delete.mockResolvedValueOnce({});
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    });
    fireEvent.click(await screen.findByText('Delete'));
    await waitFor(() => expect(apiMocks.list).toHaveBeenCalledTimes(2));
    expect(toastMock.success).toHaveBeenCalledWith('Payable deleted');
  });

  it('removes a payment and reopens on the updated bill', async () => {
    apiMocks.removePayment.mockResolvedValue({ id: 'payable-1', status: 'to_pay' });
    renderWithQuery(<PayablesView />);
    await screen.findByText('ACME LLC');
    fireEvent.click(screen.getByText('Mark paid'));

    fireEvent.click(await screen.findByRole('button', { name: 'Remove payment' }));

    await waitFor(() =>
      expect(apiMocks.removePayment).toHaveBeenCalledWith('payable-1', 'payment-1'),
    );
    await waitFor(() => expect(apiMocks.list).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: 'Remove payment' })).toBeInTheDocument();
  });

  it('follows a new status in the address and goes back to page one', async () => {
    navigationState.searchParams = new URLSearchParams('status=overdue');
    const Page = () => {
      const [, redraw] = React.useState(0);
      return (
        <>
          <button type="button" onClick={() => redraw(n => n + 1)}>
            Redraw
          </button>
          <PayablesView />
        </>
      );
    };
    renderWithQuery(<Page />);
    await waitFor(() =>
      expect(apiMocks.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'overdue', page: 1 }),
      ),
    );

    navigationState.searchParams = new URLSearchParams('status=paid&source=nonsense');
    fireEvent.click(screen.getByRole('button', { name: 'Redraw' }));

    await waitFor(() =>
      expect(apiMocks.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'paid', source: undefined, page: 1 }),
      ),
    );
  });

  it('keeps the rows on screen while a change reloads them', async () => {
    apiMocks.archive.mockResolvedValue({});
    let answer: (value: unknown) => void = () => {};
    renderWithQuery(<PayablesView />);
    await screen.findByText('ACME LLC');
    apiMocks.list.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          answer = resolve;
        }),
    );

    await openRowAction('Archive');

    await waitFor(() => expect(apiMocks.archive).toHaveBeenCalled());
    expect(screen.getByText('ACME LLC')).toBeInTheDocument();
    await act(async () => {
      answer({ data: [], total: 0, page: 1, limit: 20, totalPages: 1 });
    });
  });

  it('reads the rows again when the page is opened a second time', async () => {
    const client = createTestQueryClient();
    const first = renderWithQuery(<PayablesView />, { client });
    await screen.findByText('ACME LLC');
    first.unmount();

    renderWithQuery(<PayablesView />, { client });

    // Last visit's rows at once, and fresh ones behind them.
    expect(screen.getByText('ACME LLC')).toBeInTheDocument();
    await waitFor(() => expect(apiMocks.list).toHaveBeenCalledTimes(2));
  });
});
