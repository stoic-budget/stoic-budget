import { balanceLineEnd } from '@/modules/parsing/helpers/statement-balance-line.helper';

describe('balanceLineEnd', () => {
  const read = (text: string, label: string) => {
    const index = text.indexOf(label) + label.length;
    return text.slice(index, balanceLineEnd(text, index));
  };

  it('stops at the end of the label line when it has text after the label', () => {
    expect(read('ending balance 12.00\non august 31, 2024 15.00', 'ending balance')).toBe(' 12.00');
  });

  it('reads the dated line under a label that stands alone', () => {
    expect(read('ending balance\non august 31, 2024 15.00\nnext', 'ending balance')).toBe(
      '\non august 31, 2024 15.00',
    );
    expect(read('ending balance\nas of august 31, 2024 15.00', 'ending balance')).toBe(
      '\nas of august 31, 2024 15.00',
    );
  });

  it('keeps to the label line when the next one is not its date', () => {
    expect(read('new balance\nprevious balance 10.00', 'new balance')).toBe('');
  });

  it('ends at the next balance label on the same line', () => {
    const text = 'previous balance $900.00 new balance $200.00';
    const index = 'previous balance'.length;
    expect(text.slice(index, balanceLineEnd(text, index, ['previous balance', 'new balance']))).toBe(' $900.00');
  });
});
