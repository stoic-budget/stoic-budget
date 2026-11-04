// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { currentMonthKey } from './month-end';
import { OverviewMonthProvider, useOverviewHrefMarker } from './overview-month';

vi.mock('@/app/i18n', () => ({ useLocale: () => ({ locale: 'en' }) }));

const PAST = '2020-10';

function Marked({ href }: { href: string }) {
  return <output>{useOverviewHrefMarker()(href)}</output>;
}

function marked(href: string, month: string | null) {
  const { unmount } = render(
    <OverviewMonthProvider value={month}>
      <Marked href={href} />
    </OverviewMonthProvider>,
  );
  const text = screen.getByRole('status').textContent;
  unmount();
  return text;
}

describe('useOverviewHrefMarker', () => {
  it('marks a link that opens its page on the past month in view', () => {
    expect(marked(`/review?month=${PAST}`, PAST)).toBe(`/review?month=${PAST}&asOf=${PAST}`);
    expect(marked(`/reports?from=${PAST}-01&to=${PAST}-31`, PAST)).toContain(`asOf=${PAST}`);
    expect(marked(`/net-worth?range=30d&to=${PAST}-31`, PAST)).toContain(`asOf=${PAST}`);
  });

  it('leaves links to pages without that month, the current month and outside the Overview', () => {
    expect(marked('/goals', PAST)).toBe('/goals');
    expect(marked('/review?month=2019-01', PAST)).toBe('/review?month=2019-01');
    const now = currentMonthKey();
    expect(marked(`/review?month=${now}`, now)).toBe(`/review?month=${now}`);
    expect(marked(`/review?month=${PAST}`, null)).toBe(`/review?month=${PAST}`);
  });
});
