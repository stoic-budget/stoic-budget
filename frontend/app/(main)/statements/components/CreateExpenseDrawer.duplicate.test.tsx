// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearManualPrefill, stashManualPrefill } from '@/app/lib/manual-expense-prefill';
import type { ManualExpenseDraft } from '@/app/lib/statement-expense-drawer';
import CreateExpenseDrawer from './CreateExpenseDrawer';

vi.mock('./ExpenseAccountField', () => ({ ExpenseAccountField: () => null }));
vi.mock('@/app/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@mui/x-date-pickers/DatePicker', () => ({
  DatePicker: () => <input aria-label="Date" readOnly />,
}));

const TODAY = '2026-11-13';
const DUPLICATED: ManualExpenseDraft = {
  amount: '12.5',
  currency: 'EUR',
  merchant: 'ACME Store - Wireless Buds',
  description: 'Order 1042',
  categoryId: 'cat-snacks',
  taxRateId: '',
  walletId: '11111111-1111-4111-8111-111111111111',
};
const ALLOWED_KEYS = ['amount', 'categoryId', 'currency', 'description', 'merchant', 'taxRateId', 'walletId'];

function renderForm(onSubmitManual = vi.fn(async () => undefined)) {
  render(
    <CreateExpenseDrawer
      open
      initialMode="manual"
      categories={[{ id: 'cat-snacks', name: 'Snacks' }]}
      taxRates={[]}
      onClose={() => undefined}
      onSubmitScan={async () => undefined}
      onSubmitManual={onSubmitManual}
    />,
  );
  return onSubmitManual;
}

describe('CreateExpenseDrawer opened by Duplicate', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${TODAY}T10:00:00Z`));
  });
  afterEach(() => {
    clearManualPrefill();
    vi.useRealTimers();
  });

  it('shows the copied row, dated today, and sends it only on Save', async () => {
    stashManualPrefill(DUPLICATED);
    const onSubmitManual = renderForm();

    expect(screen.getByLabelText(/amount/i)).toHaveValue('12.5');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });
    expect(screen.getByLabelText('Merchant')).toHaveValue(DUPLICATED.merchant);
    expect(screen.getByLabelText(/description/i)).toHaveValue(DUPLICATED.description);
    expect(screen.getByRole('button', { name: /category snacks/i })).toBeInTheDocument();
    expect(onSubmitManual).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /create .* expense/i }));
    });

    expect(onSubmitManual).toHaveBeenCalledTimes(1);
    const [payload] = onSubmitManual.mock.calls[0] as unknown as [
      { draft: ManualExpenseDraft; date: string; files: File[] },
    ];
    expect(payload.date).toBe(TODAY);
    expect(payload.files).toEqual([]);
    expect(payload.draft).toEqual(DUPLICATED);
    expect(Object.keys(payload.draft).sort()).toEqual(ALLOWED_KEYS);
  });

  it('opens blank when nothing was duplicated', () => {
    renderForm();

    expect(screen.getByLabelText(/amount/i)).toHaveValue('');
  });
});
