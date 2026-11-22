// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const offers = vi.hoisted(() => ({ last: null as null | { message: string; onApply: () => void } }));
const search = vi.hoisted(() => ({ params: new URLSearchParams() }));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock('@/app/lib/api', () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    put: (...args: unknown[]) => put(...args),
  },
}));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'workspace-1' }));
vi.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: () => true }),
}));
vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => search.params,
  usePathname: () => '/rules/new',
  useRouter: () => router,
}));
vi.mock('@/app/components/payees/offer-action-toast', () => ({
  offerAction: (options: { message: string; onApply: () => void }) => {
    offers.last = options;
  },
}));

import type { CategorizationRule, CategorizationRuleTestResult } from '@/app/lib/contracts';
import { apiResponse } from '@/app/test/api-response';
import { categoryItem, walletItem } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { selectOption } from '@/app/test/select';
import { RuleEditorView } from './RuleEditorView';

const STORE = 'ACME Store - Wireless Buds';
const ELECTRONICS = categoryItem({ id: '00000000-0000-4000-8000-000000000001', name: 'Electronics' });
const CARD = walletItem({ id: '00000000-0000-4000-8000-000000000002', name: 'Everyday card' });

const CAFE = {
  id: '00000000-0000-4000-8000-000000000009',
  name: 'Corner Café',
  mode: 'auto' as const,
  category: null,
  defaultCategory: null,
  countryCode: null,
  vatId: null,
  vatIdStatus: null,
  vatIdName: null,
  vatIdCheckedAt: null,
  supplyType: null,
  transactionCount: 3,
  lastSeen: null,
};

const saved: CategorizationRule = {
  id: 'rule-1',
  name: 'ACME is electronics',
  description: null,
  conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'ACME Store' }],
  matchMode: 'all',
  result: { categoryId: ELECTRONICS.id },
  priority: 2,
  isActive: true,
  groupId: null,
  matchCount: 0,
  lastMatchedAt: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
};

function match(id: string, wonBy: { id: string; name: string } | null = null) {
  return {
    id,
    date: '2026-10-01',
    amount: '25.00',
    counterparty: STORE,
    purpose: 'Order 1001',
    matchReason: 'counterparty_name contains "acme store"',
    direction: 'expense' as const,
    currency: 'EUR',
    categoryId: null,
    decided: false,
    wonBy,
  };
}

let preview: CategorizationRuleTestResult;

beforeEach(() => {
  vi.clearAllMocks();
  offers.last = null;
  search.params = new URLSearchParams();
  preview = {
    totalTransactions: 40,
    matchedTransactions: 2,
    overridable: 2,
    shadowed: 0,
    movable: 0,
    truncated: false,
    matches: [match('tx-1'), match('tx-2')],
  };
  get.mockImplementation(async (url: string) => {
    if (url === '/categorization-rules/rule-1') return apiResponse(saved);
    if (url === '/categories') return apiResponse([ELECTRONICS]);
    if (url === '/wallets') return apiResponse([CARD]);
    if (url === '/tags') return apiResponse([]);
    if (url === `/payees/${CAFE.id}`) return apiResponse(CAFE);
    if (url.startsWith('/workspaces/')) return apiResponse({ members: [] });
    throw new Error(`unexpected GET ${url}`);
  });
  post.mockImplementation(async (url: string, body: { name?: string }) => {
    if (url === '/categorization-rules/test') return apiResponse(preview);
    if (url === '/categorization-rules') return apiResponse({ ...saved, id: 'rule-new', ...body });
    if (url.endsWith('/apply'))
      return apiResponse({
        applied: 2,
        skippedManual: 0,
        tagged: 0,
        moved: 0,
        commented: 0,
        renamed: 0,
        excluded: 0,
      });
    throw new Error(`unexpected POST ${url}`);
  });
  put.mockResolvedValue(apiResponse(saved));
});

describe('RuleEditorView', () => {
  it('starts a rule from a row: its payee, its direction and its category', async () => {
    search.params = new URLSearchParams({
      payee: STORE,
      categoryId: ELECTRONICS.id,
      direction: 'expense',
    });
    renderWithQuery(<RuleEditorView id="new" />);

    expect(await screen.findByRole('heading', { name: 'New rule' })).toBeTruthy();
    const values = screen.getAllByLabelText('Value');
    expect((values[0] as HTMLInputElement).value).toBe(STORE);
    // The rows it would match, as a table, money out with a typographic minus.
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getAllByText('−€25.00')).toHaveLength(2);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/categorization-rules/test',
        {
          conditions: [
            { field: 'counterparty_name', operator: 'contains', value: STORE },
            { field: 'direction', operator: 'equals', value: 'expense' },
          ],
        },
        expect.anything(),
      ),
    );
  });

  it('offers every way a bank says money moved as a payment type', async () => {
    renderWithQuery(<RuleEditorView id="new" />);
    await screen.findByRole('heading', { name: 'New rule' });

    selectOption(screen.getAllByLabelText('Field')[0], 'Payment type');
    fireEvent.mouseDown(screen.getAllByLabelText('Value')[0]);

    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
      'Card',
      'Bank transfer in',
      'Bank transfer out',
      'Direct debit',
      'Standing order',
      'Cash',
      'Fee',
      'Interest',
    ]);
  });

  it('saves without a priority, so the server puts the new rule on top, and asks before moving rows', async () => {
    search.params = new URLSearchParams({ payee: STORE });
    preview = { ...preview, movable: 2 };
    renderWithQuery(<RuleEditorView id="new" />);
    await screen.findByRole('table');
    selectOption(screen.getByRole('combobox', { name: 'Account' }), CARD.name);
    // The preview is asked again with the account, to count the rows that would move.
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/categorization-rules/test',
        expect.objectContaining({ walletId: CARD.id }),
        expect.anything(),
      ),
    );
    expect(
      screen.getByText(
        'A matching row goes to this account, even when its statement belongs to another one.',
      ),
    ).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Save rule' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/categorization-rules', {
        name: `Payee contains “${STORE}”`,
        conditions: [{ field: 'counterparty_name', operator: 'contains', value: STORE }],
        matchMode: 'all',
        result: { walletId: CARD.id },
      }),
    );
    expect(router.push).toHaveBeenCalledWith('/rules');
    await waitFor(() =>
      expect(offers.last?.message).toBe(
        'This rule moves 2 existing rows to Everyday card. Apply it to them?',
      ),
    );
  });

  it('edits a saved rule and offers to refile the matches nobody chose', async () => {
    renderWithQuery(<RuleEditorView id="rule-1" />);

    const name = await screen.findByLabelText('Name');
    await waitFor(() => expect((name as HTMLInputElement).value).toBe('ACME is electronics'));
    fireEvent.change(name, { target: { value: 'ACME gadgets' } });
    await screen.findByRole('table');
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/categorization-rules/test',
        expect.objectContaining({ ruleId: 'rule-1' }),
        expect.anything(),
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Save rule' }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/categorization-rules/rule-1', {
        name: 'ACME gadgets',
        conditions: saved.conditions,
        matchMode: 'all',
        result: { categoryId: ELECTRONICS.id },
      }),
    );
    await waitFor(() => expect(offers.last?.message).toBe('Refile 2 existing rows with this rule?'));
    offers.last?.onApply();
    await waitFor(() => expect(post).toHaveBeenCalledWith('/categorization-rules/rule-1/apply'));
  });

  it('warns when a rule above sets the category of every row this one matches', async () => {
    const above = { id: 'rule-top', name: 'Any store' };
    preview = { ...preview, shadowed: 2, matches: [match('tx-1', above), match('tx-2', above)] };
    renderWithQuery(<RuleEditorView id="rule-1" />);

    expect(await screen.findByText(/this rule's category never applies/)).toBeTruthy();
    expect(screen.getAllByText('category set by “Any store”, a rule above')).toHaveLength(2);
  });

  it('says nothing of the rules above for a rule that sets no category: rules add up', async () => {
    const above = { id: 'rule-top', name: 'Any store' };
    preview = { ...preview, shadowed: 2, matches: [match('tx-1', above), match('tx-2', above)] };
    get.mockImplementation(async (url: string) => {
      if (url === '/categorization-rules/rule-1')
        return apiResponse({ ...saved, result: { walletId: CARD.id } });
      if (url === '/categories') return apiResponse([ELECTRONICS]);
      if (url === '/wallets') return apiResponse([CARD]);
      if (url === '/tags') return apiResponse([]);
      if (url.startsWith('/workspaces/')) return apiResponse({ members: [] });
      throw new Error(`unexpected GET ${url}`);
    });
    renderWithQuery(<RuleEditorView id="rule-1" />);

    await screen.findByRole('table');
    expect(screen.queryByText(/never applies/)).toBeNull();
    expect(screen.queryByText(/a rule above/)).toBeNull();
  });

  it('keeps several values in one condition, any of which matches', async () => {
    renderWithQuery(<RuleEditorView id="rule-1" />);
    const value = (await screen.findByLabelText('Value')) as HTMLInputElement;
    await waitFor(() => expect(value.value).toBe('ACME Store'));

    // Enter keeps what was typed as a chip and starts the next value.
    fireEvent.keyDown(value, { key: 'Enter' });
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'Corner Bakery' } });

    expect(screen.getByRole('button', { name: 'Remove ACME Store' })).toBeTruthy();
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/categorization-rules/test',
        expect.objectContaining({
          conditions: [
            { field: 'counterparty_name', operator: 'contains', value: ['ACME Store', 'Corner Bakery'] },
          ],
        }),
        expect.anything(),
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Remove ACME Store' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save rule' }));
    // One value left is saved as a plain one.
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(
        '/categorization-rules/rule-1',
        expect.objectContaining({
          conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'Corner Bakery' }],
        }),
      ),
    );
  });

  it('asks for any one of the conditions, with a range of amounts as one of them', async () => {
    renderWithQuery(<RuleEditorView id="rule-1" />);
    await screen.findByRole('table');
    // One condition has nothing to combine with.
    expect(screen.queryByRole('combobox', { name: 'How the conditions combine' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Add condition' }));
    selectOption(screen.getAllByLabelText('Field')[1], 'Amount');
    selectOption(screen.getAllByLabelText('Check')[1], 'is between');
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '20.5' } });
    selectOption(
      screen.getByRole('combobox', { name: 'How the conditions combine' }),
      'When any of these matches',
    );

    const conditions = [
      { field: 'counterparty_name', operator: 'contains', value: 'ACME Store' },
      { field: 'amount', operator: 'between', value: 10, valueTo: 20.5 },
    ];
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/categorization-rules/test',
        expect.objectContaining({ conditions, matchMode: 'any' }),
        expect.anything(),
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save rule' }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(
        '/categorization-rules/rule-1',
        expect.objectContaining({ conditions, matchMode: 'any' }),
      ),
    );
  });

  it('writes a comment and gives a payee, and can take the payee off again', async () => {
    get.mockImplementation(async (url: string) => {
      if (url === '/categorization-rules/rule-1')
        return apiResponse({ ...saved, result: { payeeId: CAFE.id } });
      if (url === `/payees/${CAFE.id}`) return apiResponse(CAFE);
      if (url === '/categories') return apiResponse([ELECTRONICS]);
      if (url === '/wallets') return apiResponse([CARD]);
      if (url === '/tags') return apiResponse([]);
      if (url.startsWith('/workspaces/')) return apiResponse({ members: [] });
      throw new Error(`unexpected GET ${url}`);
    });
    renderWithQuery(<RuleEditorView id="rule-1" />);

    // The payee the rule names is shown by its name, with what the rule will not do.
    expect(await screen.findByText('Corner Café')).toBeTruthy();
    expect(screen.getByText('A payee you chose for a row by hand stays.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Comment'), { target: { value: 'Team coffee' } });
    expect(screen.getByText('Written only when the row has no comment yet.')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Save rule' }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(
        '/categorization-rules/rule-1',
        expect.objectContaining({ result: { payeeId: CAFE.id, comment: 'Team coffee' } }),
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Remove Corner Café' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save rule' }));
    await waitFor(() =>
      expect(put).toHaveBeenLastCalledWith(
        '/categorization-rules/rule-1',
        expect.objectContaining({ result: { comment: 'Team coffee' } }),
      ),
    );
  });

  it('adds a group with its own "any of these", and a blank check that sends no value', async () => {
    renderWithQuery(<RuleEditorView id="rule-1" />);
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: 'Add group' }));
    const group = screen.getByRole('combobox', { name: 'How this group’s conditions combine' });
    expect(group.textContent).toContain('Any of these');
    // The group's first condition: a payee text; then a second one on the comment.
    fireEvent.change(screen.getAllByLabelText('Value')[1], { target: { value: 'Corner Bakery' } });
    await userEvent.click(screen.getAllByRole('button', { name: 'Add condition' })[0]);
    selectOption(screen.getAllByLabelText('Field')[2], 'Comment');
    selectOption(screen.getAllByLabelText('Check')[2], 'is empty');
    // Nothing to type for a blank check, and the rule says how such fields are read.
    expect(screen.getAllByLabelText('Value')).toHaveLength(2);
    expect(screen.getByText(/read as the rules above this one leave the row/)).toBeTruthy();

    const conditions = [
      { field: 'counterparty_name', operator: 'contains', value: 'ACME Store' },
      {
        matchMode: 'any',
        conditions: [
          { field: 'counterparty_name', operator: 'contains', value: 'Corner Bakery' },
          { field: 'comment', operator: 'is_empty', value: '' },
        ],
      },
    ];
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/categorization-rules/test',
        expect.objectContaining({ conditions, ruleId: 'rule-1' }),
        expect.anything(),
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save rule' }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(
        '/categorization-rules/rule-1',
        expect.objectContaining({ conditions }),
      ),
    );

    // A group taken away takes its conditions with it.
    await userEvent.click(screen.getByRole('button', { name: 'Remove group' }));
    expect(screen.getAllByLabelText('Field')).toHaveLength(1);
  });

  it('opens a rule on the category and tags by their names, and drops a group left empty', async () => {
    const tag = { id: '00000000-0000-4000-8000-000000000005', name: 'Gadgets', color: null, usageCount: 1 };
    get.mockImplementation(async (url: string) => {
      if (url === '/categorization-rules/rule-1')
        return apiResponse({
          ...saved,
          conditions: [
            { field: 'category', operator: 'not_equals', value: ELECTRONICS.id },
            { matchMode: 'all', conditions: [{ field: 'tags', operator: 'equals', value: tag.id }] },
          ],
          result: { walletId: CARD.id },
        });
      if (url === '/categories') return apiResponse([ELECTRONICS]);
      if (url === '/wallets') return apiResponse([CARD]);
      if (url === '/tags') return apiResponse([tag]);
      if (url.startsWith('/workspaces/')) return apiResponse({ members: [] });
      throw new Error(`unexpected GET ${url}`);
    });
    renderWithQuery(<RuleEditorView id="rule-1" />);

    expect(await screen.findByRole('button', { name: 'Value' })).toBeTruthy();
    expect(screen.getAllByText('Electronics').length).toBeGreaterThan(0);
    expect(await screen.findByText('Gadgets')).toBeTruthy();
    expect(screen.getAllByLabelText('Check')[0].textContent).toContain('is not');
    expect(screen.getAllByLabelText('Check')[1].textContent).toContain('has any of');

    // The tag taken off leaves the group with nothing to ask: it is not sent.
    await userEvent.click(screen.getByRole('button', { name: 'Remove Gadgets' }));
    await waitFor(() =>
      expect(post).toHaveBeenLastCalledWith(
        '/categorization-rules/test',
        expect.objectContaining({
          conditions: [{ field: 'category', operator: 'not_equals', value: ELECTRONICS.id }],
        }),
        expect.anything(),
      ),
    );
  });

  it('asks for a condition before it looks anything up', async () => {
    renderWithQuery(<RuleEditorView id="new" />);

    expect(await screen.findByText('Fill in at least one condition.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save rule' })).toHaveProperty('disabled', true);
    expect(post).not.toHaveBeenCalled();
  });
});

describe('the notify and leave-out-of-budgets actions', () => {
  it('tells everyone about new rows, says old ones tell nobody, and leaves rows out of budgets', async () => {
    search.params = new URLSearchParams({ payee: STORE });
    renderWithQuery(<RuleEditorView id="new" />);
    await screen.findByRole('table');

    selectOption(screen.getByRole('combobox', { name: 'Notify' }), 'Everyone in the workspace');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Leave out of budgets' }));

    expect(screen.getByText(/Only new rows notify/)).toBeTruthy();
    expect(screen.getByText(/Applying the rule to these rows notifies no one/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Save rule' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/categorization-rules', {
        name: `Payee contains “${STORE}”`,
        conditions: [{ field: 'counterparty_name', operator: 'contains', value: STORE }],
        matchMode: 'all',
        result: { notify: { memberId: null }, excludeFromBudgets: true },
      }),
    );
    // Leaving rows out of budgets is offered on the matches already there; telling is not.
    await waitFor(() => expect(offers.last?.message).toContain('2'));
  });

  it('keeps both actions when a saved rule is edited', async () => {
    get.mockImplementation(async (url: string) => {
      if (url === '/categorization-rules/rule-1')
        return apiResponse({
          ...saved,
          result: { notify: { memberId: null }, excludeFromBudgets: true },
        });
      if (url === '/categories') return apiResponse([ELECTRONICS]);
      if (url === '/wallets') return apiResponse([CARD]);
      if (url === '/tags') return apiResponse([]);
      if (url.startsWith('/workspaces/')) return apiResponse({ members: [] });
      throw new Error(`unexpected GET ${url}`);
    });
    renderWithQuery(<RuleEditorView id="rule-1" />);
    const name = await screen.findByLabelText('Name');
    await waitFor(() => expect((name as HTMLInputElement).value).toBe('ACME is electronics'));
    fireEvent.change(name, { target: { value: 'ACME, noted' } });

    await userEvent.click(screen.getByRole('button', { name: 'Save rule' }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(
        '/categorization-rules/rule-1',
        expect.objectContaining({
          result: expect.objectContaining({ notify: { memberId: null }, excludeFromBudgets: true }),
        }),
      ),
    );
  });
});
