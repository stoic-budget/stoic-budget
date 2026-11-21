// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { taxJurisdictionItem } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { TaxStep } from './TaxStep';

const get = vi.fn();

vi.mock('@/app/lib/api', () => ({
  default: { get: (...args: unknown[]) => get(...args) },
}));

vi.mock('@/app/i18n', () => ({
  useIntlayer: (key: string) =>
    key === 'onboardingPage'
      ? {
          tax: {
            title: 'Where do you pay tax?',
            countryLabel: 'Tax residence',
            notListed: "My country isn't listed",
            notListedHint: 'Tax features stay off',
            loadFailed: 'Could not load the list of countries.',
            countryPlaceholder: 'Choose a country',
            countrySearch: 'Search countries',
            countryNotFound: 'No countries found',
          },
        }
      : { closeDrawer: { value: 'Close' } },
}));

const jurisdiction = (code: string, name: string) =>
  taxJurisdictionItem({ id: `jurisdiction-${code}`, code, name });

const props = {
  locale: 'en' as const,
  taxCountry: null,
  onTaxCountryChange: vi.fn(),
  onDefer: vi.fn(),
};

describe('TaxStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue({ data: [jurisdiction('DE', 'Germany'), jurisdiction('PL', 'Poland')] });
  });

  it('asks only for the country, with a hint until one is chosen', async () => {
    const { unmount } = renderWithQuery(<TaxStep {...props} />);

    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(screen.getByText('Tax features stay off')).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    unmount();

    renderWithQuery(<TaxStep {...props} taxCountry="DE" />);
    expect(screen.queryByText('Tax features stay off')).toBeNull();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('picks the country from a sidebar list', async () => {
    const onTaxCountryChange = vi.fn();
    renderWithQuery(<TaxStep {...props} onTaxCountryChange={onTaxCountryChange} />);

    fireEvent.click(await screen.findByRole('button', { name: /Choose a country/ }));
    fireEvent.change(await screen.findByPlaceholderText('Search countries'), {
      target: { value: 'pol' },
    });
    expect(screen.queryByRole('button', { name: /Germany/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Poland/ }));
    expect(onTaxCountryChange).toHaveBeenCalledWith('PL');
  });

  it('lets the country wait', () => {
    const onDefer = vi.fn();
    renderWithQuery(<TaxStep {...props} taxCountry="DE" onDefer={onDefer} />);

    fireEvent.click(screen.getByRole('button', { name: "My country isn't listed" }));
    expect(onDefer).toHaveBeenCalledTimes(1);
  });

  it('says so when the country list cannot be loaded, and still lets the step be passed', async () => {
    get.mockRejectedValue(new Error('offline'));
    renderWithQuery(<TaxStep {...props} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the list of countries.',
    );
    expect(screen.getByRole('button', { name: "My country isn't listed" })).toBeEnabled();
  });
});
