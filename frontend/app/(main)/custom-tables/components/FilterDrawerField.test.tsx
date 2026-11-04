// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterDrawerField, type FilterDrawerOption } from './FilterDrawerField';

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({ closeDrawer: { value: 'Close' } }),
}));

const LABELS = {
  any: 'Any',
  selected: '{{count}} selected',
  search: 'Search',
  noMatches: 'Nothing found',
};

const TYPES: FilterDrawerOption[] = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
];

function renderField(props: Partial<React.ComponentProps<typeof FilterDrawerField>> = {}) {
  const onChange = vi.fn();
  const view = render(
    <FilterDrawerField
      label="Type"
      options={TYPES}
      value={[]}
      onChange={onChange}
      labels={LABELS}
      {...props}
    />,
  );
  return { onChange, ...view };
}

describe('FilterDrawerField', () => {
  it('opens a drawer from the field, and one pick closes it', () => {
    const { onChange } = renderField();
    fireEvent.click(screen.getByRole('button', { name: 'Type' }));
    fireEvent.click(screen.getByRole('button', { name: 'Expense' }));

    expect(onChange).toHaveBeenCalledWith(['expense']);
    expect(screen.queryByRole('button', { name: 'Income' })).toBeNull();
  });

  it('keeps the drawer open for several picks and clears them with "Any"', () => {
    const { onChange } = renderField({ multiple: true, value: ['income'] });
    fireEvent.click(screen.getByRole('button', { name: 'Type' }));

    fireEvent.click(screen.getByRole('button', { name: 'Expense' }));
    expect(onChange).toHaveBeenLastCalledWith(['income', 'expense']);
    fireEvent.click(screen.getByRole('button', { name: 'Income' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    fireEvent.click(screen.getByRole('button', { name: 'Any' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(screen.getByRole('button', { name: 'Expense' })).toBeInTheDocument();
  });

  it('names the picks on the field, and counts them past two', () => {
    const options = ['A', 'B', 'C'].map(name => ({ value: name, label: `Bank ${name}` }));
    const { rerender } = renderField({ options, value: ['A', 'B'], multiple: true });
    expect(screen.getByRole('button', { name: 'Type' })).toHaveTextContent('Bank A, Bank B');

    rerender(
      <FilterDrawerField
        label="Type"
        options={options}
        value={['A', 'B', 'C']}
        multiple
        onChange={vi.fn()}
        labels={LABELS}
      />,
    );
    expect(screen.getByRole('button', { name: 'Type' })).toHaveTextContent('3 selected');
  });

  it('searches a long list by name and by the line under it', () => {
    const options = Array.from({ length: 9 }, (_, index) => ({
      value: `s-${index}`,
      label: `Bank ${index}`,
      description: index === 4 ? 'Apr 2022' : 'Jan 2024',
    }));
    renderField({ label: 'Statements', options, multiple: true });
    fireEvent.click(screen.getByRole('button', { name: 'Statements' }));

    fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
      target: { value: 'apr' },
    });
    expect(screen.getByRole('button', { name: /Bank 4/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bank 3/ })).toBeNull();

    fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
      target: { value: 'nowhere' },
    });
    expect(screen.getByText('Nothing found')).toBeInTheDocument();
  });

  it('says there is nothing to pick from on a disabled field', () => {
    renderField({ options: [], emptyLabel: 'No statements yet' });
    const field = screen.getByRole('button', { name: 'Type' });
    expect(field).toBeDisabled();
    expect(field).toHaveTextContent('No statements yet');
  });
});
