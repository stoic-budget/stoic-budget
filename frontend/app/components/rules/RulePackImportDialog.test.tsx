// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();

vi.mock('@/app/lib/api', () => ({
  default: { post: (...args: unknown[]) => post(...args) },
}));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'workspace-1' }));

import type { RulePack, RulePackPreview } from '@/app/lib/contracts';
import { apiResponse } from '@/app/test/api-response';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { RulePackImportDialog } from './RulePackImportDialog';

const pack: RulePack = {
  kind: 'categorization-rules',
  version: 1,
  exportedAt: '2026-11-01T10:00:00.000Z',
  rules: [
    {
      name: 'Pet shop',
      folder: 'Pets',
      isActive: true,
      matchMode: 'all',
      conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'pet shop' }],
      result: { category: 'Pet food' },
    },
    {
      name: 'Round-ups',
      isActive: true,
      matchMode: 'all',
      conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'round up' }],
      result: { account: 'Savings jar', tags: [''] },
    },
    {
      name: 'Bakery',
      isActive: true,
      matchMode: 'all',
      conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'bakery' }],
      result: { comment: 'Bread' },
    },
  ],
};

function previewOf(createMissing: boolean): RulePackPreview {
  return {
    rules: [
      {
        name: 'Pet shop',
        folder: 'Pets',
        outcome: createMissing ? 'create' : 'skip',
        missing: [{ kind: 'category', name: 'Pet food', creatable: true }],
        invalid: false,
        exists: false,
        matches: 4,
      },
      {
        name: 'Round-ups',
        folder: null,
        outcome: 'skip',
        missing: [
          { kind: 'account', name: 'Savings jar', creatable: false },
          { kind: 'tag', name: '', creatable: false },
        ],
        invalid: false,
        exists: false,
        matches: 0,
      },
      {
        name: 'Bakery',
        folder: null,
        outcome: 'skip',
        missing: [],
        invalid: false,
        exists: true,
        matches: 2,
      },
    ],
    newFolders: createMissing ? ['Pets'] : [],
    truncated: false,
  };
}

describe('RulePackImportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    post.mockImplementation(async (url: string, body: { createMissing: boolean }) => {
      if (url === '/categorization-rule-packs/preview')
        return apiResponse(previewOf(body.createMissing));
      if (url === '/categorization-rule-packs/import')
        return apiResponse({ created: 1, skipped: 1 });
      throw new Error(`unexpected POST ${url}`);
    });
  });

  it('previews the pack, writes nothing until confirmed, then imports what it showed', async () => {
    const onClose = vi.fn();
    renderWithQuery(<RulePackImportDialog pack={pack} onClose={onClose} />);

    expect(await screen.findByText('1 of 3 rules will be added')).toBeTruthy();
    expect(screen.getByText('Missing: Pet food (category)')).toBeTruthy();
    // A blank name is a record deleted where the pack was made.
    expect(screen.getByText('Missing: Savings jar (account), deleted (tag)')).toBeTruthy();
    expect(screen.getByText('A rule with this name is already here')).toBeTruthy();
    expect(screen.getByText('New folders: Pets')).toBeTruthy();
    expect(post).toHaveBeenCalledWith('/categorization-rule-packs/preview', {
      pack,
      createMissing: true,
    });
    expect(post).not.toHaveBeenCalledWith('/categorization-rule-packs/import', expect.anything());

    await userEvent.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/categorization-rule-packs/import', {
        pack,
        createMissing: true,
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('asks again without making names, and offers nothing to import when every rule is left out', async () => {
    renderWithQuery(<RulePackImportDialog pack={pack} onClose={vi.fn()} />);
    await screen.findByText('1 of 3 rules will be added');

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Create missing categories, tags and payees' }),
    );

    expect(await screen.findByText('0 of 3 rules will be added')).toBeTruthy();
    expect(post).toHaveBeenLastCalledWith('/categorization-rule-packs/preview', {
      pack,
      createMissing: false,
    });
    expect(screen.getByRole('button', { name: 'Import' })).toHaveProperty('disabled', true);
  });
});
