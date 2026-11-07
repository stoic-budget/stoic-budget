// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ParsingFacts } from './ParsingFacts';

const LABELS = {
  bank: { value: 'Bank' },
  bankDetectedBy: { value: 'Detected by' },
  format: { value: 'Format' },
  foundTransactions: { value: 'Transactions found' },
  createdTransactions: { value: 'Transactions created' },
  errors: { value: 'Errors' },
};

const facts = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('dl > div')).map(fact => fact.textContent);

describe('ParsingFacts', () => {
  it('leaves out what the parser did not find, and "created" when it equals "found"', () => {
    const { container } = render(
      <ParsingFacts
        details={{ detectedBank: 'other', transactionsFound: 51, transactionsCreated: 51 }}
        labels={LABELS}
      />,
    );

    expect(facts(container)).toEqual(['Bankother', 'Transactions found51']);
  });

  it('shows "created" and the error count when they say something', () => {
    const { container } = render(
      <ParsingFacts
        details={{ transactionsFound: 51, transactionsCreated: 48, errors: ['row 3: no date'] }}
        labels={LABELS}
      />,
    );

    expect(facts(container)).toEqual([
      'Transactions found51',
      'Transactions created48',
      'Errors1',
    ]);
  });

  it('renders nothing without any fact', () => {
    const { container } = render(<ParsingFacts details={{}} labels={LABELS} />);

    expect(container.firstChild).toBeNull();
  });
});
