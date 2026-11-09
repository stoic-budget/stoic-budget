// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PayPeriodContext } from '@/app/lib/contracts';
import { currentMonthKey } from './month-end';
import {
  OverviewMonthProvider,
  useOverviewHrefMarker,
  useShowsOtherMonth,
} from './overview-month';

const payPeriods = vi.hoisted(() => ({ context: undefined as PayPeriodContext | undefined }));

vi.mock('@/app/i18n', () => ({ useLocale: () => ({ locale: 'en' }) }));
vi.mock('@/app/hooks/usePayPeriods', () => ({
  usePayPeriods: () => ({ data: undefined, context: payPeriods.context }),
}));

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

function OtherMonth() {
  return <output>{String(useShowsOtherMonth())}</output>;
}

function showsOther(month: string) {
  const { unmount } = render(
    <OverviewMonthProvider value={month}>
      <OtherMonth />
    </OverviewMonthProvider>,
  );
  const text = screen.getByRole('status').textContent;
  unmount();
  return text;
}

describe('the present month under the workspace month rule', () => {
  afterEach(() => {
    payPeriods.context = undefined;
    vi.useRealTimers();
  });

  it('is the period today falls in, not the calendar month', () => {
    // 9 November under day 15: the running period is "October" (15 Oct – 14 Nov).
    vi.useFakeTimers({ now: new Date(2026, 10, 9, 12), toFake: ['Date'] });
    payPeriods.context = { monthStart: { kind: 'day', day: 15 } };
    expect(showsOther('2026-10')).toBe('false');
    expect(showsOther('2026-11')).toBe('true');
    expect(marked('/review?month=2026-10', '2026-10')).toBe('/review?month=2026-10');
    expect(marked('/review?month=2026-11', '2026-11')).toContain('asOf=2026-11');
  });

  it('is the calendar month without a rule', () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 9, 12), toFake: ['Date'] });
    expect(showsOther('2026-11')).toBe('false');
    expect(showsOther('2026-10')).toBe('true');
  });
});
