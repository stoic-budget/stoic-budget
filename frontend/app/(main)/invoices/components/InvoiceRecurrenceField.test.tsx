// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Invoice } from '@/app/lib/invoices-api';

const api = vi.hoisted(() => ({ stopRecurring: vi.fn() }));
vi.mock('@/app/lib/invoices-api', () => ({ invoicesApi: api }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/app/i18n', () => {
  // Any path of keys reads as its last key: t.detail.stopRecurring.value === 'stopRecurring'.
  const keys = (name: string): unknown =>
    new Proxy({ value: name, toString: () => name }, { get: (target, key: string) => (key in target ? target[key as 'value'] : keys(key)) });
  return { useIntlayer: () => keys('root') };
});

import { InvoiceRecurrenceField } from './InvoiceRecurrenceField';

const invoice = (overrides: Partial<Invoice>): Invoice =>
  ({ id: 'inv-1', status: 'sent', isRecurring: true, recurrenceInterval: 'monthly', ...overrides }) as Invoice;

describe('InvoiceRecurrenceField', () => {
  beforeEach(() => {
    api.stopRecurring.mockReset();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('stops a sent invoice that repeats, after the person confirms', async () => {
    const stopped = invoice({ isRecurring: false, recurrenceInterval: null });
    api.stopRecurring.mockResolvedValue(stopped);
    const onStopped = vi.fn();
    render(<InvoiceRecurrenceField invoice={invoice({})} recurrenceInterval="monthly" onStopped={onStopped} />);

    fireEvent.click(screen.getByRole('button', { name: 'stopRecurring' }));

    await waitFor(() => expect(onStopped).toHaveBeenCalledWith(stopped));
    expect(api.stopRecurring).toHaveBeenCalledWith('inv-1');
  });

  it('offers nothing to stop for a void invoice or one that does not repeat', () => {
    const { rerender } = render(
      <InvoiceRecurrenceField invoice={invoice({ status: 'void' })} recurrenceInterval="monthly" onStopped={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: 'stopRecurring' })).toBeNull();

    rerender(
      <InvoiceRecurrenceField invoice={invoice({ isRecurring: false })} recurrenceInterval={null} onStopped={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: 'stopRecurring' })).toBeNull();
  });
});
