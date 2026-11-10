// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'workspace-1' }));

import { PACK_MAX_BYTES, readPackFile } from './useRulePacks';

const pack = {
  kind: 'categorization-rules',
  version: 1,
  exportedAt: '2026-11-01T10:00:00.000Z',
  rules: [
    {
      name: 'ACME is electronics',
      isActive: true,
      matchMode: 'all',
      conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'ACME Store' }],
      result: { category: 'Electronics' },
    },
  ],
};
const file = (text: string, size?: number) => {
  const made = new File([text], 'rules.json', { type: 'application/json' });
  return size ? (Object.defineProperty(made, 'size', { value: size }) as File) : made;
};

describe('readPackFile', () => {
  it('reads a pack', async () => {
    expect(await readPackFile(file(JSON.stringify(pack)))).toEqual(pack);
  });

  it('refuses a file larger than the API takes, before reading it', async () => {
    expect(await readPackFile(file(JSON.stringify(pack), PACK_MAX_BYTES + 1))).toBe('tooBig');
  });

  it('refuses text that is not JSON, JSON that is not a pack, and a pack of the wrong shape', async () => {
    expect(await readPackFile(file('not json'))).toBe('notPack');
    expect(await readPackFile(file(JSON.stringify({ rules: [] })))).toBe('notPack');
    expect(
      await readPackFile(file(JSON.stringify({ ...pack, rules: [{ name: 'No conditions' }] }))),
    ).toBe('notPack');
  });
});

describe('useExportRulePack', () => {
  it('saves the pack the API answered, as JSON', async () => {
    const { act } = await import('@testing-library/react');
    const { renderHookWithQuery } = await import('@/app/test/query-wrapper');
    const { apiResponse } = await import('@/app/test/api-response');
    const api = (await import('@/app/lib/api')).default;
    const post = vi.spyOn(api, 'post').mockResolvedValue(apiResponse(pack));
    const blobs: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:pack';
    });
    Object.assign(window.URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const { useExportRulePack } = await import('./useRulePacks');
    const { result } = renderHookWithQuery(() => useExportRulePack());

    await act(() => result.current.mutateAsync(['rule-1']));

    expect(post).toHaveBeenCalledWith('/categorization-rule-packs/export', { ruleIds: ['rule-1'] });
    expect(JSON.parse(await blobs[0].text())).toEqual(pack);
    expect(click).toHaveBeenCalled();
  });
});
