import {
  amountsWithoutDates,
  balanceLineEnd,
  figureUnderLabel,
} from '@/modules/parsing/helpers/statement-balance-line.helper';

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

describe('figureUnderLabel', () => {
  const under = (text: string, label: string) => {
    const start = text.toLowerCase().indexOf(label);
    return figureUnderLabel(text, text.toLowerCase(), { start, end: start + label.length });
  };

  it('reads the figure printed under a label that ends a row of box headings', () => {
    const text = [
      'Statement Page IBAN BIC (SWIFT) Previous balance as at 29.03.2018',
      '5 1/7 DE00 1000 2000 3000 4000 00 EXAMDEXX EUR +12,898.29',
    ].join('\n');
    expect(under(text, 'previous balance')).toBe(12898.29);
  });

  it('looks one line further when the first line under it has no figure', () => {
    const text = ['Branch number Account number New balance', '701 0123456 00', 'EUR +15,509.61'].join('\n');
    expect(under(text, 'new balance')).toBe(15509.61);
  });

  it('reads nothing under a label alone on its line: the row under it brings its own balance', () => {
    expect(under('Balance Brought Forward\n2024-05-01 ACME -R200.00 R7 822.73', 'balance brought forward')).toBeNull();
    expect(under('Opening Balance:\nMember One\n10.00', 'opening balance')).toBeNull();
  });

  it('reads nothing under a label with text after it on its line', () => {
    expect(under('New balance due by the end of the month\nEUR 15.00', 'new balance')).toBeNull();
  });
});

describe('amountsWithoutDates', () => {
  it('leaves out a date of either order, never reading "29.03" as money', () => {
    expect(amountsWithoutDates('as at 29.03.2018 EUR 12.50')).toEqual([12.5]);
  });
});

describe('balanceLineEnd in a two-column summary', () => {
  it("ends after the label's figure when another column's label follows it", () => {
    const text = 'beginning balance 353,060.27 electronic payments 120,100.00';
    const index = 'beginning balance'.length;
    expect(text.slice(index, balanceLineEnd(text, index))).toBe(' 353,060.27 ');
  });
});
