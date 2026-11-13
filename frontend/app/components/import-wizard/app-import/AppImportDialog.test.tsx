// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiResponse } from '@/app/test/api-response';
import { walletItem } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { selectOption } from '@/app/test/select';
import type { AppImportResult } from './app-import-api';
import { AppImportDialog, hasWork } from './AppImportDialog';
import { AppImportSummary } from './AppImportSummary';
import { shownAccountChoices } from './useAppImport';

const api = vi.hoisted(() => ({ get: vi.fn() }));
const run = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({ default: api, api }));
vi.mock('./app-import-api', () => ({ runAppImport: run, undoAppImport: vi.fn() }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: { currency: 'USD' } }),
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));
vi.mock('@/app/components/ui/modal-shell', () => ({
  ModalShell: ({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) => (
    <div role="dialog">
      {children}
      {footer}
    </div>
  ),
  ModalFooter: ({
    onConfirm,
    confirmText,
    isConfirmDisabled,
    children,
  }: {
    onConfirm?: () => void;
    confirmText?: string;
    isConfirmDisabled?: boolean;
    children?: React.ReactNode;
  }) => (
    <div>
      {children}
      {onConfirm && (
        <button type="button" onClick={onConfirm} disabled={isConfirmDisabled}>
          {confirmText}
        </button>
      )}
    </div>
  ),
}));
vi.mock('@/app/i18n', async () => {
  const { autoDictionary } = await import('@/app/components/dashboard/__tests__/intlayer-mock');
  return { useIntlayer: () => autoDictionary(), useLocale: () => ({ locale: 'en' }) };
});

const preview = (walletId: string | null): AppImportResult => ({
  batchId: null,
  dryRun: true,
  files: [{ fileName: 'register.csv', app: 'ynab', kind: 'register', rows: 2 }],
  accounts: [
    {
      name: 'Checking',
      status: walletId ? 'matched' : 'created',
      walletId,
      currency: 'USD',
      transactions: 2,
      opening: 0,
      openingsSkipped: 0,
    },
  ],
  categories: { created: 1, matched: 0, groups: 1, items: [] },
  payees: { created: 1, matched: 0 },
  transactions: { created: 2, skipped: 0, linked: 0, errors: 0, transfers: 0, splits: 0 },
  budgets: { month: null, created: 0, updated: 0, skipped: 0 },
  problems: [],
});

describe('shownAccountChoices', () => {
  it('sends what the preview matched unless the person picked otherwise', () => {
    expect(shownAccountChoices(preview('w-1'), {})).toEqual({ Checking: 'w-1' });
    expect(shownAccountChoices(preview('w-1'), { Checking: null })).toEqual({ Checking: null });
    expect(shownAccountChoices(preview(null), {})).toEqual({ Checking: null });
  });
});

describe('AppImportDialog', () => {
  beforeEach(() => {
    run.mockReset();
    api.get.mockResolvedValue(
      apiResponse([walletItem({ id: 'w-1', name: 'Main Checking', currency: 'USD' })]),
    );
  });

  it('imports with exactly the account choice on screen', async () => {
    run.mockImplementation(async (_files: File[], options: { dryRun: boolean; accounts: Record<string, string | null> }) =>
      options.dryRun
        ? preview(options.accounts.Checking === null ? null : 'w-1')
        : { ...preview(null), dryRun: false, batchId: 'batch-1' },
    );
    renderWithQuery(<AppImportDialog isOpen onClose={vi.fn()} />);
    const file = new File(['Account,Flag'], 'register.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByTestId('app-import-input'), { target: { files: [file] } });

    const accountSelect = await screen.findByRole('combobox', { name: 'Checking' });
    await waitFor(() => expect(screen.getByText('actions.run')).not.toBeDisabled());
    selectOption(accountSelect, 'newAccount');
    await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('actions.run')).not.toBeDisabled());
    fireEvent.click(screen.getByText('actions.run'));

    await waitFor(() => expect(run).toHaveBeenCalledTimes(3));
    expect(run.mock.calls[2][1]).toMatchObject({
      dryRun: false,
      currency: 'USD',
      categorize: true,
      accounts: { Checking: null },
    });
    expect(await screen.findByTestId('app-import-result')).toBeInTheDocument();
  });
});

describe('AppImportSummary', () => {
  it('names rows that become a transfer leg and openings that stay, only when there are any', () => {
    const plain = renderWithQuery(<AppImportSummary result={preview('w-1')} />);
    expect(screen.queryByText('notes.linked')).toBeNull();
    expect(screen.queryByText('notes.openingsKept')).toBeNull();
    plain.unmount();

    const base = preview('w-1');
    renderWithQuery(
      <AppImportSummary
        result={{
          ...base,
          accounts: base.accounts.map(account => ({ ...account, openingsSkipped: 1 })),
          transactions: { ...base.transactions, linked: 1 },
        }}
      />,
    );
    expect(screen.getByText('notes.linked')).toBeInTheDocument();
    expect(screen.getByText('notes.openingsKept')).toBeInTheDocument();
  });
});

describe('hasWork', () => {
  it('counts what the server would write: linked rows and an opening a matched account takes', () => {
    const idle = { ...preview('w-1'), transactions: { ...preview('w-1').transactions, created: 0 } };
    expect(hasWork(idle)).toBe(false);
    expect(hasWork({ ...idle, transactions: { ...idle.transactions, linked: 1 } })).toBe(true);
    expect(
      hasWork({ ...idle, accounts: idle.accounts.map(account => ({ ...account, opening: 400 })) }),
    ).toBe(true);
  });
});
