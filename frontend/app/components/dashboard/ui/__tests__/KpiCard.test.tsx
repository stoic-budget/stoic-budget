// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SectionSpanProvider } from '../../section-span';
import { KpiCard } from '../KpiCard';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('KpiCard', () => {
  it('shows the tone as a dot by the label, not on the value, and shows the caption', () => {
    const { container } = render(
      <KpiCard label="Spent" value="$3,072" tone="negative" caption="excludes transfers" />,
    );
    expect(screen.getByText('$3,072').className).toBe(
      'seneca-figure__value seneca-dashboard__stat-value seneca-private',
    );
    expect(container.querySelector('.seneca-dashboard__stat-dot--negative')).not.toBeNull();
    expect(screen.getByText('excludes transfers')).toBeInTheDocument();
  });

  it('marks the figure and the detail amounts for privacy mode, but not a count', () => {
    const { rerender } = render(
      <SectionSpanProvider value={6}>
        <KpiCard label="Income" value="$100" details={[{ label: 'Per day', value: '$10' }]} />
      </SectionSpanProvider>,
    );
    expect(screen.getByText('$100')).toHaveClass('seneca-private');
    expect(screen.getByText('$10')).toHaveClass('seneca-private');

    rerender(<KpiCard label="Counterparties" value={4} plainValue />);
    expect(screen.getByText('4')).not.toHaveClass('seneca-private');
  });

  it('draws no dot for a neutral tone', () => {
    const { container } = render(<KpiCard label="Net" value="$0" />);
    expect(container.querySelector('.seneca-dashboard__stat-dot')).toBeNull();
  });

  it('renders as a link when href is given', () => {
    render(<KpiCard label="Uncategorized" value={4} href="/statements/submit" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/statements/submit');
    expect(link.className).toContain('seneca-dashboard__stat--link');
  });

  it('renders a sparkline only with two or more points', () => {
    const { container, rerender } = render(
      <KpiCard label="Income" value="1" spark={{ points: [1] }} />,
    );
    expect(container.querySelector('svg')).toBeNull();
    rerender(<KpiCard label="Income" value="1" spark={{ points: [1, 2, 3] }} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('draws no sparkline when every point is zero', () => {
    const { container } = render(
      <KpiCard label="Income" value="$0" spark={{ points: [0, 0, 0] }} />,
    );
    expect(container.querySelector('svg')).toBeNull();
  });

  it('shows its details in a narrow tile too', () => {
    render(
      <SectionSpanProvider value={3}>
        <KpiCard label="Income" value="$100" details={[{ label: 'Average per day', value: '$10' }]} />
      </SectionSpanProvider>,
    );
    expect(screen.getByText('Average per day')).toBeInTheDocument();
    expect(screen.getByText('$10')).toBeInTheDocument();
  });
});
