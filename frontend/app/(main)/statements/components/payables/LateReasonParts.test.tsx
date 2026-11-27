// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Payable } from '@/app/lib/payables-api';
import { LateReasonMenuItem, LateReasonNote } from './LateReasonParts';

vi.mock('@/app/components/ui/dropdown-menu', () => ({
  DropdownMenuItem: ({ children, onClick }: { children: unknown; onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      {children as string}
    </button>
  ),
}));

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => new Proxy({}, { get: (_target, key) => ({ value: String(key) }) }),
}));

const overdue = {
  id: 'payable-1',
  direction: 'payable',
  dueDate: '2020-01-10',
  status: 'overdue',
  paidAt: null,
  skippedAt: null,
  lateReason: null,
} as unknown as Payable;

describe('LateReasonNote', () => {
  it('asks on an overdue bill, where the overdue notice lands, without opening the bill', () => {
    const onAsk = vi.fn();
    const onRow = vi.fn();
    render(
      // biome-ignore lint/a11y/useKeyWithClickEvents: a test stand-in for the row
      // biome-ignore lint/a11y/noStaticElementInteractions: a test stand-in for the row
      <div onClick={onRow}>
        <LateReasonNote payable={overdue} onAsk={onAsk} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'question' }));
    expect(onAsk).toHaveBeenCalledWith(overdue);
    expect(onRow).not.toHaveBeenCalled();
  });

  it('shows the reason given, and nothing on a bill that was not late', () => {
    const { rerender } = render(
      <LateReasonNote payable={{ ...overdue, lateReason: 'forgot' } as Payable} onAsk={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'forgot' })).toBeInTheDocument();
    rerender(
      <LateReasonNote
        payable={{ ...overdue, status: 'to_pay', dueDate: '2999-01-01' } as Payable}
        onAsk={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('a reason left on a bill no longer late can still be taken back from the menu', () => {
    const onSelect = vi.fn();
    const { rerender, container } = render(
      <LateReasonMenuItem
        payable={{ ...overdue, status: 'to_pay', dueDate: '2999-01-01' } as Payable}
        onSelect={onSelect}
      />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(
      <LateReasonMenuItem
        payable={{ ...overdue, status: 'to_pay', dueDate: '2999-01-01', lateReason: 'forgot' } as Payable}
        onSelect={onSelect}
      />,
    );
    expect(container).not.toBeEmptyDOMElement();
  });
});
