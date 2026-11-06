import { Payee } from '@/entities/payee.entity';
import { ownsRuleRefs } from '@/modules/classification/engine/rule-refs';
import {
  hasApplicableAction,
  resolveRulePayee,
} from '@/modules/classification/helpers/rule-validation';

const WORKSPACE = 'workspace-1';

/** A workspace with the payees given, by name; a new one gets the id `payee-new`. */
function build(existing: Record<string, string> = {}) {
  const lookup = { name: '' };
  const query = {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn((_sql: string, params: { name: string }) => {
      lookup.name = params.name;
      return query;
    }),
    getOne: vi.fn(async () => {
      const id = existing[lookup.name.toLowerCase()];
      return id ? { id, name: lookup.name } : null;
    }),
  };
  const payees = {
    createQueryBuilder: vi.fn(() => query),
    create: vi.fn((value: object) => value),
    save: vi.fn(async (value: object) => ({ ...value, id: 'payee-new' })),
    countBy: vi.fn(async ({ id }: { id: { value: string[] } }) =>
      id.value.filter(one => Object.values(existing).includes(one)).length,
    ),
  };
  const others = { countBy: async ({ id }: { id: { value: string[] } }) => id.value.length };
  const manager = { getRepository: (entity: unknown) => (entity === Payee ? payees : others) };
  return { manager: manager as never, payees };
}

describe('the payee a rule gives a row', () => {
  it('is the workspace payee of the name typed, whatever its case', async () => {
    const { manager, payees } = build({ 'corner café': 'payee-cafe' });

    const result = await resolveRulePayee(manager, WORKSPACE, {
      comment: 'Team coffee',
      payeeName: 'Corner Café',
    });

    expect(result).toEqual({ comment: 'Team coffee', payeeId: 'payee-cafe' });
    expect(payees.save).not.toHaveBeenCalled();
  });

  it('is made when the workspace has no payee of that name', async () => {
    const { manager, payees } = build();

    const result = await resolveRulePayee(manager, WORKSPACE, { payeeName: ' Garden Centre ' });

    expect(result).toEqual({ payeeId: 'payee-new' });
    expect(payees.create).toHaveBeenCalledWith({ workspaceId: WORKSPACE, name: 'Garden Centre' });
  });

  it('is the id when both an id and a name are given, and nothing is looked up without a name', async () => {
    const { manager, payees } = build();

    await expect(
      resolveRulePayee(manager, WORKSPACE, { payeeId: 'payee-cafe', payeeName: 'Garden Centre' }),
    ).resolves.toEqual({ payeeId: 'payee-cafe' });
    await expect(resolveRulePayee(manager, WORKSPACE, { categoryId: 'cat-1' })).resolves.toEqual({
      categoryId: 'cat-1',
    });
    expect(payees.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('makes a rule unusable once it is gone: the row would point at nothing', async () => {
    const { manager } = build({ 'corner café': 'payee-cafe' });

    await expect(ownsRuleRefs(manager, WORKSPACE, { payeeId: 'payee-cafe' })).resolves.toBe(true);
    await expect(ownsRuleRefs(manager, WORKSPACE, { payeeId: 'payee-merged' })).resolves.toBe(false);
  });

  it('is something "apply to existing rows" can write, like a comment', () => {
    expect(hasApplicableAction({ payeeId: 'payee-cafe' })).toBe(true);
    expect(hasApplicableAction({ comment: 'Team coffee' })).toBe(true);
    expect(hasApplicableAction({ ownerMemberId: null })).toBe(false);
  });
});
