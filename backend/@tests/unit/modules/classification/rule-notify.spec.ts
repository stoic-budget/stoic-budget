import type { Transaction } from '@/entities/transaction.entity';
import {
  notifyRecipient,
  ruleNotifyMatches,
  ruleRowKey,
} from '@/modules/classification/engine/rule-notify';
import type { ClassificationRule } from '@/modules/classification/interfaces/classification-rule.interface';
import { RuleNotifyService } from '@/modules/classification/services/rule-notify.service';

const WORKSPACE = 'workspace-1';
const STORE = 'ACME Store - Wireless Buds';
const MEMBER_ONE = 'member-1';
const MEMBER_TWO = 'member-2';
const GADGETS = '22222222-2222-4222-8222-222222222222';

const row = (overrides: Partial<Transaction> = {}) =>
  ({
    id: 'row-1',
    workspaceId: WORKSPACE,
    counterpartyName: STORE,
    paymentPurpose: 'Card payment',
    debit: 25,
    credit: null,
    amount: 25,
    currency: 'EUR',
    categoryId: null,
    categorySource: null,
    payeeId: null,
    payeeSource: null,
    comments: null,
    fingerprint: 'fp-acme-1',
    statementId: 'statement-1',
    documentNumber: '1001',
    isPrivate: false,
    ownerMemberId: null,
    transactionDate: '2026-10-03',
    ...overrides,
  }) as unknown as Transaction;

const rule = (overrides: Partial<ClassificationRule> = {}): ClassificationRule => ({
  id: 'rule-notify',
  name: 'Tell me about ACME',
  type: 'category',
  conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'acme store' }],
  result: { notify: { memberId: null } },
  priority: 1,
  isActive: true,
  ...overrides,
});

describe('ruleRowKey', () => {
  it('prefers the dedupe fingerprint, so the same purchase imported again keeps its key', () => {
    expect(ruleRowKey(row())).toBe('fp:fp-acme-1');
    expect(ruleRowKey(row({ id: 'row-2', statementId: 'statement-2' }))).toBe('fp:fp-acme-1');
  });

  it('falls back to the statement and document number, then to the row itself', () => {
    expect(ruleRowKey(row({ fingerprint: null }))).toBe('doc:statement-1:1001');
    expect(ruleRowKey(row({ fingerprint: null, documentNumber: null }))).toBe('row:row-1');
  });
});

describe('notifyRecipient', () => {
  it('tells the member the rule names, or everyone', () => {
    expect(notifyRecipient(row(), { memberId: MEMBER_ONE })).toBe(MEMBER_ONE);
    expect(notifyRecipient(row(), { memberId: null })).toBeNull();
  });

  it("tells only a private row's owner, and nobody when the rule names someone else", () => {
    const own = row({ isPrivate: true, ownerMemberId: MEMBER_ONE });

    expect(notifyRecipient(own, { memberId: null })).toBe(MEMBER_ONE);
    expect(notifyRecipient(own, { memberId: MEMBER_ONE })).toBe(MEMBER_ONE);
    expect(notifyRecipient(own, { memberId: MEMBER_TWO })).toBeUndefined();
    expect(notifyRecipient(row({ isPrivate: true }), { memberId: null })).toBeUndefined();
  });
});

describe('ruleNotifyMatches', () => {
  it('pairs every matching rule that tells with the row; a rule that does not tell is no pair', () => {
    const quiet = rule({ id: 'rule-quiet', result: { comment: 'Seen' } });
    const other = rule({ id: 'rule-other', result: { notify: { memberId: MEMBER_TWO } } });

    const matches = ruleNotifyMatches([row()], [rule(), quiet, other]);

    expect(matches.map(match => [match.rule.id, match.memberId, match.key])).toEqual([
      ['rule-notify', null, 'fp:fp-acme-1'],
      ['rule-other', MEMBER_TWO, 'fp:fp-acme-1'],
    ]);
  });

  it('reads the row as the rules above left it in the same pass', () => {
    const files = rule({ id: 'rule-files', result: { categoryId: GADGETS }, priority: 2 });
    const asks = rule({
      conditions: [{ field: 'category', operator: 'equals', value: GADGETS }],
    });

    expect(ruleNotifyMatches([row()], [files, asks])).toHaveLength(1);
    expect(ruleNotifyMatches([row()], [asks])).toHaveLength(0);
  });

  it('leaves out a row the rule does not match', () => {
    expect(ruleNotifyMatches([row({ counterpartyName: 'Corner Bakery' })], [rule()])).toEqual([]);
  });
});

describe('RuleNotifyService', () => {
  function build(rows: Transaction[], rules: ClassificationRule[] = [rule()]) {
    // rule_notify_marks: a key already there is not claimed again (ON CONFLICT DO NOTHING).
    const marks = new Set<string>();
    const query = vi.fn(async (_sql: string, [ruleIds, keys]: [string[], string[]]) =>
      ruleIds.flatMap((ruleId, index) => {
        const mark = `${ruleId}|${keys[index]}`;
        if (marks.has(mark)) return [];
        marks.add(mark);
        return [{ rule_id: ruleId, row_key: keys[index] }];
      }),
    );
    const find = vi.fn(async () => rows);
    const owns = { countBy: async ({ id }: { id: { value: string[] } }) => id.value.length };
    const transactions = { find, query, manager: { getRepository: () => owns } };
    const classification = { getClassificationRules: vi.fn(async () => rules) };
    const emitter = { emitAsync: vi.fn(async () => []) };
    const service = new RuleNotifyService(
      transactions as never,
      classification as never,
      emitter as never,
    );
    return { service, emitter, find };
  }

  it('tells once about a row imported again under a new id with the same fingerprint', async () => {
    const first = build([row()]);
    await first.service.notifyNewRows(WORKSPACE, ['row-1']);
    first.find.mockResolvedValue([row({ id: 'row-2', statementId: 'statement-2' })]);
    const again = await first.service.notifyNewRows(WORKSPACE, ['row-2']);

    expect(again).toBe(0);
    expect(first.emitter.emitAsync).toHaveBeenCalledTimes(1);
    expect(first.emitter.emitAsync).toHaveBeenCalledWith(
      'rule.matched',
      expect.objectContaining({
        workspaceId: WORKSPACE,
        ruleId: 'rule-notify',
        ruleName: 'Tell me about ACME',
        memberId: null,
        transactionId: 'row-1',
        payee: STORE,
        amount: 25,
        currency: 'EUR',
        account: null,
      }),
    );
  });

  it('reads only the new rows of the workspace that are not duplicates', async () => {
    const { service, find } = build([row()]);
    await service.notifyNewRows(WORKSPACE, ['row-1']);

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: WORKSPACE, isDuplicate: false }),
      }),
    );
  });

  it('reads nothing when no rule of the workspace tells anyone', async () => {
    const { service, find, emitter } = build([row()], [rule({ result: { comment: 'Seen' } })]);

    expect(await service.notifyNewRows(WORKSPACE, ['row-1'])).toBe(0);
    expect(find).not.toHaveBeenCalled();
    expect(emitter.emitAsync).not.toHaveBeenCalled();
  });

  it('shortens a long rule name to what a notification title holds', async () => {
    const { service, emitter } = build([row()], [rule({ name: 'x'.repeat(250) })]);
    await service.notifyNewRows(WORKSPACE, ['row-1']);

    const [, event] = emitter.emitAsync.mock.calls[0];
    expect(event.ruleName).toHaveLength(121);
    expect(event.ruleName.endsWith('…')).toBe(true);
  });
});
