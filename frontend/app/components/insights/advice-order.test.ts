import { describe, expect, it } from 'vitest';
import type { Insight } from '@/app/hooks/useInsights';
import { byImportance, isGoodNews, needsAttention } from './advice-order';

const insight = (overrides: Partial<Insight>): Insight => ({
  id: 'i',
  type: 'stoic.plan',
  category: 'stoic',
  severity: 'info',
  title: 'Title',
  message: 'Message',
  messageKey: null,
  messageParams: null,
  data: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
});

describe('advice order', () => {
  it('asks for attention from the serious line up, whatever the type', () => {
    expect(needsAttention(insight({ data: { priority: 40 } }))).toBe(true);
    expect(needsAttention(insight({ type: 'stoic.goal', data: { priority: 85 } }))).toBe(true);
    expect(needsAttention(insight({ data: { priority: 39 } }))).toBe(false);
  });

  it('always asks for attention on a warning, never on good news', () => {
    expect(needsAttention(insight({ severity: 'warn' }))).toBe(true);
    const praise = insight({ type: 'stoic.praise', data: { priority: 90 } });
    expect(isGoodNews(praise)).toBe(true);
    expect(needsAttention(praise)).toBe(false);
  });

  it('calls only the rising savings rate good news', () => {
    expect(isGoodNews(insight({ messageKey: 'trend.savings_rate_up' }))).toBe(true);
    expect(isGoodNews(insight({ messageKey: 'trend.savings_rate_down' }))).toBe(false);
  });

  it('calls a net worth milestone good news, and an unusual category not', () => {
    const milestone = insight({ type: 'pattern.net_worth_milestone', data: { priority: 26 } });
    expect(isGoodNews(milestone)).toBe(true);
    expect(needsAttention(milestone)).toBe(false);
    expect(isGoodNews(insight({ type: 'trend.category_anomaly', severity: 'warn' }))).toBe(false);
    expect(isGoodNews(insight({ type: 'pattern.idle_cash' }))).toBe(false);
  });

  it('sorts by importance, the newest first among equals', () => {
    const rows = [
      insight({ id: 'low', data: { priority: 10 } }),
      insight({ id: 'old', data: { priority: 50 }, createdAt: '2026-09-01T00:00:00.000Z' }),
      insight({ id: 'new', data: { priority: 50 } }),
      insight({ id: 'none' }),
    ];
    expect(rows.sort(byImportance).map(row => row.id)).toEqual(['new', 'old', 'low', 'none']);
  });
});
