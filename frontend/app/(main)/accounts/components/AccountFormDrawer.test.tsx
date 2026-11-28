// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { WalletType } from '@/app/lib/contracts';
import { emptyAccountForm } from '../hooks/useAccounts';
import { AccountFormDrawer } from './AccountFormDrawer';

vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/components/transactions/hooks/useWorkspaceMembers', () => ({
  useWorkspaceMembers: () => [],
}));
vi.mock('@/app/components/receipts/components/CurrencyDrawer', () => ({
  CurrencyDrawer: () => null,
}));
vi.mock('@/app/hooks/useCurrencyPickerState', () => ({
  useCurrencyPickerState: () => ({ selectedCurrencyItem: null, setCurrencyDrawerOpen: () => {} }),
}));
vi.mock('@/app/components/ui/drawer-shell', () => ({
  DrawerShell: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div role="dialog">{children}</div> : null,
}));
vi.mock('@/app/i18n', async () => {
  const { autoDictionary, value } = await import(
    '@/app/components/dashboard/__tests__/intlayer-mock'
  );
  return {
    useLocale: () => ({ locale: 'en' }),
    useIntlayer: () =>
      autoDictionary({
        typeChecking: value('Checking'),
        typeCreditCard: value('Credit card'),
        typeLoan: value('Loan'),
        loanTermsDropped: value('Saving deletes the loan terms'),
        openingInvalid: value('Enter an amount, such as 1 500 or 1500.50'),
        save: value('Save'),
      }),
  };
});

const drawer = (type: WalletType, editing: boolean) =>
  render(
    <AccountFormDrawer
      open
      editing={editing}
      initial={{ ...emptyAccountForm('USD'), type, name: 'ACME Bank - Car loan' }}
      saving={false}
      onClose={() => {}}
      onSave={() => {}}
    />,
  );

describe('AccountFormDrawer', () => {
  it('warns that a loan turned into an everyday account loses its loan terms', () => {
    drawer('loan', true);
    expect(screen.queryByText('Saving deletes the loan terms')).toBeNull();

    // From one debt type to another the terms stay.
    fireEvent.click(screen.getByRole('radio', { name: 'Credit card' }));
    expect(screen.queryByText('Saving deletes the loan terms')).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: 'Checking' }));
    expect(screen.getByRole('note')).toHaveTextContent('Saving deletes the loan terms');

    fireEvent.click(screen.getByRole('radio', { name: 'Loan' }));
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('says nothing for a new account or one that never was a debt', () => {
    drawer('loan', false);
    fireEvent.click(screen.getByRole('radio', { name: 'Checking' }));
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('refuses to save an opening balance it cannot read, and saves one it can', () => {
    const onSave = vi.fn();
    render(
      <AccountFormDrawer
        open
        editing={false}
        initial={{ ...emptyAccountForm('USD'), type: 'checking', name: 'ACME Bank - Main' }}
        saving={false}
        onClose={() => {}}
        onSave={onSave}
      />,
    );
    const opening = document.getElementById('account-opening') as HTMLInputElement;
    const save = screen.getByRole('button', { name: 'Save' });

    fireEvent.change(opening, { target: { value: '0.125' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount');
    expect(save).toBeDisabled();

    fireEvent.change(opening, { target: { value: '1 500' } });
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ openingBalance: '1 500' }));
  });
});
