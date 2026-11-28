// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IconPicker } from './IconPicker';

const catalogue = vi.hoisted(() => ({
  nodes: {
    cigarette: [['path', { d: 'M1 1h1' }]],
    'shopping-cart': [['path', { d: 'M2 2h1' }]],
    plane: [['path', { d: 'M3 3h1' }]],
    zebra: [['path', { d: 'M4 4h1' }]],
  },
  words: { cigarette: ['smoking'], 'shopping-cart': ['trolley'], plane: [], zebra: [] },
}));

vi.mock('@/app/lib/icon-catalog-api', () => ({
  fetchIconNodes: () => Promise.resolve(catalogue.nodes),
  fetchIconWords: () => Promise.resolve(catalogue.words),
}));

// jsdom measures nothing, so the list shows every row it is given.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 40,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({ index, start: index * 40 })),
    scrollToIndex: vi.fn(),
  }),
}));

vi.mock('@/app/i18n', async () => {
  const { autoDictionary, value } = await import(
    '@/app/components/dashboard/__tests__/intlayer-mock'
  );
  return {
    useLocale: () => ({ locale: 'ru' }),
    useIntlayer: (key: string) =>
      key === 'categoryIcons'
        ? autoDictionary({ groceries: value('Продукты'), travel: value('Путешествия') })
        : autoDictionary({ noIcon: value('Без значка'), search: value('Найти значок') }),
  };
});

function Harness({ initial, onChange }: { initial: string | null; onChange: (v: unknown) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <IconPicker
      allowNone
      value={value}
      onChange={next => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

const field = () => screen.getByRole('combobox');

describe('IconPicker', () => {
  const onChange = vi.fn();
  beforeEach(() => onChange.mockClear());

  it('shows the current pick by its translated name, an old mdi value too', () => {
    render(<Harness initial="mdi:cart" onChange={onChange} />);
    expect(field()).toHaveValue('Продукты');
  });

  it('finds an icon by an English word and stores it as a Lucide value', async () => {
    render(<Harness initial={null} onChange={onChange} />);
    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: 'smok' } });
    const option = await screen.findByRole('option', { name: /Cigarette/ });
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith('lucide:cigarette');
    expect(field()).toHaveValue('Cigarette');
  });

  it('finds icons by a word of their group in the user’s language', async () => {
    render(<Harness initial={null} onChange={onChange} />);
    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: 'сигареты' } });
    expect(await screen.findByRole('option', { name: /Cigarette/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Zebra/ })).not.toBeInTheDocument();
  });

  it('picks the highlighted row with the keyboard, and Escape closes without a pick', async () => {
    render(<Harness initial="lucide:plane" onChange={onChange} />);
    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: 'cart' } });
    await screen.findByRole('option', { name: /Продукты/ });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('lucide:shopping-cart');

    fireEvent.focus(field());
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('offers "No icon" first and clears the pick with it', async () => {
    render(<Harness initial="lucide:plane" onChange={onChange} />);
    fireEvent.focus(field());
    const none = await screen.findByRole('option', { name: 'Без значка' });
    expect(screen.getAllByRole('option')[0]).toBe(none);
    fireEvent.click(none);
    expect(onChange).toHaveBeenCalledWith(null);
    expect(field()).toHaveValue('Без значка');
  });

  it('says so when nothing matches', async () => {
    render(<Harness initial={null} onChange={onChange} />);
    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: 'qwerty' } });
    expect(await screen.findByText('nothingFound')).toBeInTheDocument();
  });
});
