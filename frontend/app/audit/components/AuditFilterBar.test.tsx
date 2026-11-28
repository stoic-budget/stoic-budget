// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditEventFilter } from '@/lib/api/audit';
import { AuditFilterBar } from './AuditFilterBar';

// Late in the UTC day, when rounding a dateFrom that kept the hour used to tip 30 days over to 90.
const NOW = new Date('2026-11-28T22:30:00.000Z');

const renderBar = (filters: AuditEventFilter) => {
  const onFiltersChange = vi.fn();
  render(<AuditFilterBar filters={filters} onFiltersChange={onFiltersChange} />);
  return onFiltersChange;
};

describe('AuditFilterBar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('names the period it loads: none is all time, 30 days stays 30 at any hour', () => {
    renderBar({});
    expect(screen.getByRole('button', { name: /All time/ })).toBeTruthy();
    cleanup();

    renderBar({ dateFrom: '2026-10-29' });
    expect(screen.getByRole('button', { name: /Last 30 days/ })).toBeTruthy();
  });

  it('clears the dates on "All time", so the period picked before does not stay', async () => {
    const onFiltersChange = renderBar({ dateFrom: '2026-10-29' });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Last 30 days/ }));
    await user.click(screen.getByRole('menuitem', { name: /All time/ }));

    const update = onFiltersChange.mock.calls.at(-1)?.[0] as Partial<AuditEventFilter>;
    expect(Object.keys(update)).toContain('dateFrom');
    expect({ ...{ dateFrom: '2026-10-29' }, ...update }.dateFrom).toBeUndefined();
  });

  it('opens the filters as fields a keyboard reaches, each named by its label', async () => {
    renderBar({ action: 'delete' });
    const user = userEvent.setup();

    const toggle = screen.getByRole('button', { name: /Filters · 1/ });
    toggle.focus();
    await user.keyboard('{Enter}');

    const actor = screen.getByRole('combobox', { name: 'Actor' });
    const action = screen.getByRole('combobox', { name: 'Action' });
    expect(screen.getByRole('combobox', { name: 'Entity' })).toBeTruthy();

    // Tab walks the fields instead of closing the panel.
    actor.focus();
    await user.tab();
    expect(document.activeElement).toBe(action);
  });

  it('applies a filter as it is picked and clears all three at once', async () => {
    const onFiltersChange = renderBar({ action: 'delete' });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Filters · 1/ }));
    await user.click(screen.getByRole('combobox', { name: 'Actor' }));
    await user.click(screen.getByRole('option', { name: 'System' }));
    expect(onFiltersChange).toHaveBeenLastCalledWith({ actorType: 'system' });

    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onFiltersChange).toHaveBeenLastCalledWith({
      actorType: undefined,
      action: undefined,
      entityType: undefined,
    });
  });
});
