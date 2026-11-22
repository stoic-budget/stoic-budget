import { movePayeesInto, sameTruncatedName } from '@/modules/payees/payee-truncation';

describe('sameTruncatedName', () => {
  it.each([
    ['member one kum', 'member one kumar das'],
    ['memberonekum', 'member one kum'],
    ['memberonekumarda s', 'member one kumar das'],
    ['example tech', 'example technologies lim'],
  ])('takes "%s" and "%s" for one name cut short or respaced', (a, b) => {
    expect(sameTruncatedName(a, b)).toBe(true);
    expect(sameTruncatedName(b, a)).toBe(true);
  });

  it.each([
    ['ravi', 'ravi kumar'], // too short to be a cut-off rather than a first name
    ['acme shop', 'acme shoes'],
    ['member one', 'member two'],
    ['acme store', 'acme store berlin'], // whole words: a branch, not a cut-off
    ['example bakery', 'example bakery gmbh'],
  ])('keeps "%s" and "%s" apart', (a, b) => {
    expect(sameTruncatedName(a, b)).toBe(false);
  });
});

describe('movePayeesInto', () => {
  const WORKSPACE = 'workspace-1';
  const TARGET = '11111111-1111-4111-8111-111111111111';
  const SOURCE = '22222222-2222-4222-8222-222222222222';

  it('points the rules that ask about a merged payee at the one it joins', async () => {
    const asked = [
      { field: 'payee', operator: 'equals', value: SOURCE },
      { matchMode: 'any', conditions: [{ field: 'payee', operator: 'not_equals', value: [SOURCE] }] },
    ];
    const query = vi.fn(async (sql: string) =>
      sql.includes('SELECT id, conditions') ? [{ id: 'rule-1', conditions: asked }] : [],
    );

    await movePayeesInto({ query } as never, WORKSPACE, TARGET, [SOURCE]);

    const rewrite = query.mock.calls.find(([sql]) => sql.includes('SET conditions'));
    expect(rewrite?.[1]).toEqual([
      JSON.stringify([
        { field: 'payee', operator: 'equals', value: TARGET },
        { matchMode: 'any', conditions: [{ field: 'payee', operator: 'not_equals', value: [TARGET] }] },
      ]),
      WORKSPACE,
      'rule-1',
    ]);
  });
});
