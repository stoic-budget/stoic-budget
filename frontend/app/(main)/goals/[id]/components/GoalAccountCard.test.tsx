// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { GoalAccount } from '@/app/lib/contracts';
import { GoalAccountCard } from './GoalAccountCard';

const savings = (overrides: Partial<GoalAccount> = {}): GoalAccount => ({
  id: 'wallet-1',
  name: 'ACME Savings',
  currency: 'USD',
  balance: 1250,
  status: 'following',
  ...overrides,
});

describe('GoalAccountCard', () => {
  it('says the goal follows the account, keeps the contributions and links the balance history', () => {
    render(<GoalAccountCard account={savings()} goalCurrency="EUR" contributionCount={2} />);

    expect(screen.getByText('Follows ACME Savings: progress is its balance')).toBeInTheDocument();
    expect(screen.getByText(/Contributions added before \(2\) are kept/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Balance history' })).toHaveAttribute(
      'href',
      '/accounts/wallet-1',
    );
  });

  it('names the missing rate instead of counting the balance one to one', () => {
    render(
      <GoalAccountCard account={savings({ status: 'no_rate' })} goalCurrency="EUR" contributionCount={0} />,
    );

    expect(
      screen.getByText('No USD → EUR rate yet, so the balance of ACME Savings does not count'),
    ).toBeInTheDocument();
  });

  it('says an archived account handed the goal back to its contributions', () => {
    render(
      <GoalAccountCard account={savings({ status: 'archived' })} goalCurrency="EUR" contributionCount={3} />,
    );

    expect(
      screen.getByText('ACME Savings is archived, so this goal counts its contributions again'),
    ).toBeInTheDocument();
    // They count again, so there is nothing "kept aside" to explain.
    expect(screen.queryByText(/are kept/)).toBeNull();
  });

  it('shows nothing for a goal counting its contributions', () => {
    const { container } = render(
      <GoalAccountCard account={null} goalCurrency="EUR" contributionCount={3} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
