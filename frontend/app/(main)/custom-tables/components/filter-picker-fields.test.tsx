// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CategoriesFilterField, CurrencyFilterField } from './filter-picker-fields';

const text = (value: string) => ({ value, toString: () => value });

// The category drawer reads `.value`; the currency drawer renders most of its words as they are.
vi.mock('@/app/i18n', () => ({
  useLocale: () => ({ locale: 'en' }),
  useIntlayer: (key: string) =>
    key === 'receiptCurrencyDrawer'
      ? {
          closeDrawer: text('Close'),
          title: 'Currency',
          searchPlaceholder: text('Search'),
          recents: 'Recent',
          all: 'All',
          noResults: 'Nothing',
        }
      : {
          closeDrawer: text('Close'),
          title: text('Pick'),
          searchPlaceholder: text('Search'),
          noData: text('Nothing'),
          dialog: { createTitle: text('Create category') },
        },
}));

const CATEGORIES = [
  { id: 'c-1', name: 'Groceries' },
  { id: 'c-2', name: 'Transport' },
  { id: 'c-3', name: 'Rent' },
];

function renderCategories(value: string[]) {
  const onChange = vi.fn();
  render(
    <CategoriesFilterField
      label="Categories"
      value={value}
      categories={CATEGORIES}
      onChange={onChange}
      anyLabel="Any"
      emptyLabel="No categories"
      selectedLabel="{{count}} selected"
    />,
  );
  return onChange;
}

describe('CategoriesFilterField', () => {
  it('opens the category drawer and toggles each category, staying open', () => {
    const onChange = renderCategories(['c-1']);
    expect(screen.getByRole('button', { name: 'Categories' })).toHaveTextContent('Groceries');
    fireEvent.click(screen.getByRole('button', { name: 'Categories' }));

    fireEvent.click(screen.getByRole('button', { name: 'Transport' }));
    expect(onChange).toHaveBeenLastCalledWith(['c-1', 'c-2']);
    fireEvent.click(screen.getByRole('button', { name: 'Groceries' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(screen.getByRole('button', { name: 'Rent' })).toBeInTheDocument();
  });

  it('clears every pick with "Any" and closes', () => {
    const onChange = renderCategories(['c-1', 'c-2', 'c-3']);
    expect(screen.getByRole('button', { name: 'Categories' })).toHaveTextContent('3 selected');
    fireEvent.click(screen.getByRole('button', { name: 'Categories' }));

    fireEvent.click(screen.getByRole('button', { name: 'Any' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(screen.queryByRole('button', { name: 'Rent' })).toBeNull();
  });
});

describe('CurrencyFilterField', () => {
  it('picks from the app currency drawer, and "Any" clears the filter', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CurrencyFilterField label="Currency" value="" onChange={onChange} anyLabel="Any" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Currency' }));
    fireEvent.click(screen.getAllByRole('button', { name: /EUR/ })[0]);
    expect(onChange).toHaveBeenLastCalledWith('EUR');

    rerender(<CurrencyFilterField label="Currency" value="EUR" onChange={onChange} anyLabel="Any" />);
    expect(screen.getByRole('button', { name: 'Currency' })).toHaveTextContent('EUR');
    fireEvent.click(screen.getByRole('button', { name: 'Currency' }));
    fireEvent.click(screen.getByRole('button', { name: 'Any' }));
    expect(onChange).toHaveBeenLastCalledWith('');
  });
});
