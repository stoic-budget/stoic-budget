// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import { AccountCreditLimit } from './AccountCreditLimit';

vi.mock('@/app/i18n', async () => {
  const { autoDictionary, value } = await import(
    '@/app/components/dashboard/__tests__/intlayer-mock'
  );
  return {
    useLocale: () => ({ locale: 'en' }),
    useIntlayer: () =>
      autoDictionary({
        creditAvailable: value('Available {{amount}} of {{limit}}'),
        creditOverLimit: value('Over the limit by {{amount}}'),
        creditUsed: value('Share of the credit limit used'),
        unconvertedNote: value('Not in the total, no exchange rate: {{list}}'),
      }),
  };
});

const card = (balance: number, creditLimit: string | null = '5000.00') => ({
  type: 'credit_card' as const,
  balance,
  creditLimit,
  currency: 'EUR',
  unconvertedCurrencies: [] as string[],
});

describe('AccountCreditLimit', () => {
  it('shows what is left of the limit while money is owed', () => {
    render(<AccountCreditLimit account={card(-1200)} />);

    const line = screen.getByText(/Available/);
    expect(line).toHaveTextContent('Available €3,800.00 of €5,000.00');
    expect(line).toHaveStyle({ color: 'var(--text-muted)' });
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '24');
  });

  it('shows more than the limit available when the card is in credit', () => {
    render(<AccountCreditLimit account={card(150)} />);

    expect(screen.getByText(/Available/)).toHaveTextContent('Available €5,150.00 of €5,000.00');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('says by how much the limit is passed, in the overrun tone', () => {
    render(<AccountCreditLimit account={card(-5200)} />);

    const line = screen.getByText(/Over the limit/);
    expect(line).toHaveTextContent('Over the limit by €200.00');
    expect(line).toHaveStyle({ color: 'var(--money-down)' });
    expect(screen.queryByText(/Available/)).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('shows nothing without a limit', () => {
    const { container } = render(<AccountCreditLimit account={card(-1200, null)} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('keeps every amount private in privacy mode, and the words readable', () => {
    render(<AccountCreditLimit account={card(-1200)} />);

    const amounts = document.querySelectorAll(`.${PRIVATE_CLASS}`);
    expect([...amounts].map(node => node.textContent)).toEqual(['€3,800.00', '€5,000.00']);
    expect(screen.getByText(/Available/).firstChild?.textContent).toBe('Available ');
  });

  it('marks the figure where rows without a rate are left out, only where asked', () => {
    const account = { ...card(-1200), unconvertedCurrencies: ['GBP'] };
    const { rerender } = render(<AccountCreditLimit account={account} flagUnconverted />);

    expect(
      screen.getByRole('img', { name: 'Not in the total, no exchange rate: GBP' }),
    ).toBeInTheDocument();

    // The account page prints the note under the balance already.
    rerender(<AccountCreditLimit account={account} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
