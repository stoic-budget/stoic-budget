// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { transactionItem } from '@/app/test/fixtures/contracts';
import { AccountTransactionsCard } from './AccountTransactionsCard';

const payee = 'ACME Store - Wireless Buds';
/** A row as the account page's list answers it: with the balance after it. */
const pageRow = (id: string, counterpartyName: string, isPending: boolean, runningBalance: string | null) => ({
  ...transactionItem({ id, counterpartyName, isPending }),
  reimbursementOf: null,
  runningBalance,
  transferPairWallet: null,
});

describe('AccountTransactionsCard', () => {
  it('marks a row the bank still holds as pending, with no balance after it', () => {
    render(
      <AccountTransactionsCard
        transactions={[
          pageRow('tx-booked', 'ACME Payroll', false, '3100.00'),
          pageRow('tx-pending', payee, true, null),
        ]}
        money={value => value.toFixed(2)}
      />,
    );

    expect(screen.getAllByText('Pending')).toHaveLength(1);
    expect(screen.getByText('Pending').closest('div')).toHaveTextContent(payee);
    expect(screen.getByText(payee)).toHaveStyle({ color: 'var(--text-muted)' });
    expect(screen.getByText('ACME Payroll')).toHaveStyle({ color: 'var(--foreground)' });
  });
});
