// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestQueryClient } from '@/app/test/query-wrapper';
import type { AuthorizationRequest } from './authorization-request';

const errorAddress = 'https://acme-assistant.example.net/landing?error=unsupported_response_type&state=s1';
const answer = vi.hoisted(() => ({ value: {} as unknown }));

vi.mock('@/app/lib/api', () => ({ default: { post: vi.fn() } }));
vi.mock('@/app/lib/query-fn-schema', () => ({
  apiQueryDecoded: () => Promise.resolve(answer.value),
  checkContract: (_name: string, data: unknown) => data,
}));

import { useOAuthConsent } from './useOAuthConsent';

const request = {
  clientId: '00000000-0000-4000-8000-000000000001',
  redirectUri: 'https://acme-assistant.example.net/landing',
  responseType: 'token',
} as AuthorizationRequest;

function renderConsent() {
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useOAuthConsent(request), { wrapper });
}

describe('useOAuthConsent', () => {
  const originalLocation = window.location;
  const assign = vi.fn();

  beforeEach(() => {
    assign.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, assign },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('never leaves on its own for a refused request: anyone can register that address', async () => {
    answer.value = { kind: 'redirect', redirectTo: errorAddress };

    const { result } = renderConsent();

    await waitFor(() => expect(result.current.refusal).not.toBeNull());
    expect(result.current.refusal?.back?.href).toBe(errorAddress);
    expect(result.current.loading).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });

  it('offers no link to an address that is not http(s)', async () => {
    answer.value = { kind: 'redirect', redirectTo: 'javascript:alert(1)' };

    const { result } = renderConsent();

    await waitFor(() => expect(result.current.refusal).not.toBeNull());
    expect(result.current.refusal?.back).toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });
});
