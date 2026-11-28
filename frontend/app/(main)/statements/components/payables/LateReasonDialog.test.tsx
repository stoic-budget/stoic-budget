// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Payable } from '@/app/lib/payables-api';
import { LateReasonDialog } from './LateReasonDialog';

const label = (key: string) => ({ value: key });
vi.mock('@/app/i18n', () => ({
  useIntlayer: () => new Proxy({}, { get: (_target, key) => label(String(key)) }),
}));

const late = {
  id: 'payable-1',
  direction: 'payable',
  vendor: 'ACME Power',
  dueDate: '2026-09-10',
  status: 'overdue',
  lateReason: null,
  lateReasonNote: null,
} as unknown as Payable;

describe('LateReasonDialog', () => {
  it('saves the chosen reason with its note; nothing is saved before a reason is chosen', () => {
    const onSave = vi.fn();
    render(<LateReasonDialog payable={late} saving={false} onClose={vi.fn()} onSave={onSave} />);

    expect(screen.getByRole('button', { name: 'save' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'clear' })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'unexpected_expense' }));
    fireEvent.change(screen.getByLabelText('note'), { target: { value: 'Car repair' } });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    expect(onSave).toHaveBeenCalledWith('unexpected_expense', 'Car repair');
  });

  it('opens on the reason already given, and can take it back', () => {
    const onSave = vi.fn();
    render(
      <LateReasonDialog
        payable={{ ...late, lateReason: 'forgot', lateReasonNote: 'Away' } as Payable}
        saving={false}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    expect(screen.getByRole('radio', { name: 'forgot' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('note')).toHaveValue('Away');
    fireEvent.click(screen.getByRole('button', { name: 'clear' }));
    expect(onSave).toHaveBeenCalledWith(null, '');
  });

  it('is closed with no bill', () => {
    const { container } = render(
      <LateReasonDialog payable={null} saving={false} onClose={vi.fn()} onSave={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
