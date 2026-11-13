// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LeftOutAccountsNote } from './LeftOutAccountsNote';

vi.mock('@/app/i18n', async () => {
  const { autoDictionary, value } = await import(
    '@/app/components/dashboard/__tests__/intlayer-mock'
  );
  return {
    useIntlayer: () =>
      autoDictionary({
        accountsLeftOut: value('Accounts not counted here: {{count}}.'),
        accountsLeftOutChange: value('Change'),
      }),
  };
});
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('LeftOutAccountsNote', () => {
  it('says how many accounts the figure leaves out, with the way to change it', () => {
    render(<LeftOutAccountsNote count={2} />);

    expect(screen.getByText(/Accounts not counted here: 2\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Change' })).toHaveAttribute('href', '/accounts');
  });

  it('says nothing when every account counts', () => {
    const { container } = render(<LeftOutAccountsNote count={0} />);

    expect(container).toBeEmptyDOMElement();
  });
});
