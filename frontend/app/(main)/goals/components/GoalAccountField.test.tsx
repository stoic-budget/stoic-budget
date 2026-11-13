// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GoalAccountField } from './GoalAccountField';

const ACCOUNTS = [
  { id: 'wallet-1', name: 'ACME Savings', currency: 'EUR' },
  { id: 'wallet-2', name: 'ACME Pocket', currency: 'USD' },
];

function open() {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Follow an account' }));
  return within(screen.getByRole('listbox'));
}

describe('GoalAccountField', () => {
  it('offers counting contributions and each account, and hands back the one picked', () => {
    const onChange = vi.fn();
    render(<GoalAccountField value={null} accounts={ACCOUNTS} onChange={onChange} />);

    const list = open();
    expect(list.getAllByRole('option').map(option => option.textContent)).toEqual([
      'None, count contributions',
      'ACME Savings · EUR',
      'ACME Pocket · USD',
    ]);
    fireEvent.click(list.getByText('ACME Pocket · USD'));
    expect(onChange).toHaveBeenCalledWith('wallet-2');
  });

  it('sends null when the person goes back to counting contributions', () => {
    const onChange = vi.fn();
    render(<GoalAccountField value="wallet-1" accounts={ACCOUNTS} onChange={onChange} />);

    fireEvent.click(open().getByText('None, count contributions'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('explains what following means only once an account is chosen', () => {
    const { rerender } = render(
      <GoalAccountField value={null} accounts={ACCOUNTS} onChange={vi.fn()} />,
    );
    expect(screen.queryByText(/nothing to add by hand/)).toBeNull();

    rerender(<GoalAccountField value="wallet-1" accounts={ACCOUNTS} onChange={vi.fn()} />);
    expect(screen.getByText(/nothing to add by hand/)).toBeInTheDocument();
  });
});
