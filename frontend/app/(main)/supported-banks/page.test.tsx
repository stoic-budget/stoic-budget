// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listSupportedBanks, resolveBankLogo } from '@bank-logos';

const content = vi.hoisted(() => ({
  title: 'Supported banks',
  subtitle: 'Banks currently supported for statement parsing',
  parserStatus: 'Parser is active',
  comingSoon: 'More banks are coming soon',
  formatsLabel: 'Supported format',
  pdfStatements: 'PDF statements',
}));

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => content,
}));

vi.mock('next/image', () => ({
  default: (props: React.ComponentProps<'img'>) => <img {...props} alt={props.alt ?? 'image'} />,
}));

// Imported once at collection: a dynamic import inside a test spends its
// timeout on the module graph under a loaded run.
import SupportedBanksPage from './page';

const renderPage = async (): Promise<HTMLElement> => {
  const container = document.createElement('div');
  const root = createRoot(container);

  await act(async () => {
    root.render(<SupportedBanksPage />);
  });

  return container;
};

describe('SupportedBanksPage', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('renders a card with the name of every supported bank', async () => {
    const container = await renderPage();
    const banks = listSupportedBanks();

    // The page heading lives in the app shell now; the card opens on the parser status.
    expect(container.textContent).toContain(content.parserStatus);
    expect(container.querySelectorAll('[data-supported-bank]')).toHaveLength(banks.length);
    for (const bank of banks) {
      const card = container.querySelector(`[data-supported-bank="${bank.key}"]`);
      expect(card?.textContent).toContain(bank.displayName);
    }
  });

  it('shows a bank its own logo and a line icon instead of the white placeholder', async () => {
    const container = await renderPage();
    const placeholder = resolveBankLogo(null).src;

    for (const bank of listSupportedBanks()) {
      const card = container.querySelector(`[data-supported-bank="${bank.key}"]`);
      const image = card?.querySelector('img');
      if (bank.src === placeholder) {
        expect(image).toBeNull();
        expect(card?.querySelector('[data-testid="bank-logo-fallback-icon"]')).toBeTruthy();
      } else {
        expect(image?.getAttribute('src')).toBe(bank.src);
      }
    }
  });

  it('names the format once, not on every card', async () => {
    const container = await renderPage();

    expect(container.textContent?.split(content.pdfStatements)).toHaveLength(2);
  });
});
