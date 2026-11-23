// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useInvoiceForm } from './useInvoiceForm';

const update = vi.hoisted(() => vi.fn(async () => ({ id: 'invoice-1' })));
vi.mock('@/app/lib/invoices-api', () => ({
  clientsApi: { list: vi.fn(async () => []) },
  invoicesApi: { update },
}));
vi.mock('@/app/lib/query-fn-schema', () => ({ apiQueryDecoded: vi.fn(async () => []) }));
vi.mock('@/app/i18n', async () => ({
  useIntlayer: () => new Proxy({}, { get: () => ({ value: '' }) }),
  useLocale: () => ({ locale: 'en' }),
}));

describe('useInvoiceForm update payload', () => {
  it('sends a cleared note, delivery date and recurrence as null, so the server clears them', () => {
    const { result } = renderHook(() => useInvoiceForm(false));
    act(() => {
      result.current.setNotes('');
      result.current.setDeliveryDate('');
      result.current.setRecurrenceInterval('' as never);
    });

    expect(result.current.buildUpdatePayload()).toMatchObject({
      notes: null,
      deliveryDate: null,
      recurrenceInterval: null,
      recurrenceEndDate: null,
    });
  });

  it('saves an edit with the cleared fields as null', async () => {
    const { result } = renderHook(() => useInvoiceForm(false));
    act(() => result.current.setNotes(''));

    await result.current.save('invoice-1');

    expect(update).toHaveBeenCalledWith(
      'invoice-1',
      expect.objectContaining({ notes: null, deliveryDate: null, recurrenceInterval: null }),
    );
  });

  it('sends what is filled in as it is', () => {
    const { result } = renderHook(() => useInvoiceForm(false));
    act(() => {
      result.current.setNotes('Thanks for the order');
      result.current.setDeliveryDate('2026-11-20');
    });

    expect(result.current.buildUpdatePayload()).toMatchObject({
      notes: 'Thanks for the order',
      deliveryDate: '2026-11-20',
    });
  });
});
