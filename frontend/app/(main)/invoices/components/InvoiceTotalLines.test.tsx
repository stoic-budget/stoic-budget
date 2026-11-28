// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InvoiceTotalLines, savedTotals } from './InvoiceTotalLines';

describe('InvoiceTotalLines (#684)', () => {
  it("shows the totals the invoice was issued with", () => {
    render(
      <InvoiceTotalLines
        totals={savedTotals({ subtotal: '100.00', taxTotal: '0.00', total: '100.00' })}
        currency="EUR"
        locale="en"
      />,
    );

    expect(screen.getAllByText('€100.00')).toHaveLength(2);
    expect(screen.getByText('€0.00')).toBeInTheDocument();
  });
});
