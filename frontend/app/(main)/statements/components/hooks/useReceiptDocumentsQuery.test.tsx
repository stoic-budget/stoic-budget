// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useReceiptDocumentsQuery } from './useReceiptDocumentsQuery';

const api = vi.hoisted(() => ({ listReceipts: vi.fn() }));
vi.mock('@/app/lib/api', () => ({ receiptDocumentsApi: api }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));

const receipt = (index: number) => ({
  id: `r-${index}`,
  status: 'draft',
  parsedData: { amount: 10 + index, currency: 'EUR', vendor: `ACME Store ${index}` },
});

describe('useReceiptDocumentsQuery', () => {
  it('reads every receipt, not one page, and each only once', async () => {
    const all = Array.from({ length: 250 }, (_, index) => receipt(index));
    api.listReceipts.mockImplementation(async ({ offset }: { offset: number }) => ({
      // The first receipt of each next page repeats the last one: a row arrived meanwhile.
      data: { receipts: all.slice(Math.max(0, offset - 1), offset + 100), total: all.length },
    }));
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useReceiptDocumentsQuery({ enabled: true }), { wrapper });

    await waitFor(() => expect(result.current.data).toHaveLength(250));
    expect(api.listReceipts.mock.calls.map(([params]) => params.offset)).toEqual([0, 100, 200]);
  });
});
