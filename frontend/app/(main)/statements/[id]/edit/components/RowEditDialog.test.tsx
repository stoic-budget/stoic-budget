import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Transaction } from '../editHelpers';
import { RowEditDialog, type RowEditLabels } from './RowEditDialog';

const labels: RowEditLabels = {
  editRow: 'Edit row',
  addRow: 'Add a missing row',
  date: 'Date',
  counterparty: 'Counterparty',
  paymentPurpose: 'Payment purpose',
  amount: 'Amount',
  moneyOut: 'Money out',
  moneyIn: 'Money in',
  save: 'Save',
  cancel: 'Cancel',
};

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label, { selector: 'input' }), { target: { value } });

describe('RowEditDialog', () => {
  it('adds a missing row as money out once date, payee and amount are given', async () => {
    const onSave = vi.fn(async () => true);
    const onClose = vi.fn();
    render(<RowEditDialog row={null} labels={labels} onClose={onClose} onSave={onSave} />);
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toHaveProperty('disabled', true);

    type('Date', '2026-09-08');
    type('Counterparty', 'ACME Cafe');
    type('Amount', '7,50');
    fireEvent.click(save);

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith({
      transactionDate: '2026-09-08',
      counterpartyName: 'ACME Cafe',
      paymentPurpose: '',
      amount: -7.5,
    });
  });

  it('opens a row with its own figures and keeps money in positive', async () => {
    const row = {
      id: 'row-1',
      transactionDate: '2026-09-20T00:00:00.000Z',
      counterpartyName: 'Member One',
      paymentPurpose: 'Salary',
      credit: 100,
      transactionType: 'income',
    } as Transaction;
    const onSave = vi.fn(async () => true);
    render(<RowEditDialog row={row} labels={labels} onClose={vi.fn()} onSave={onSave} />);
    type('Amount', '125');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        transactionDate: '2026-09-20',
        counterpartyName: 'Member One',
        paymentPurpose: 'Salary',
        amount: 125,
      }),
    );
  });
});
