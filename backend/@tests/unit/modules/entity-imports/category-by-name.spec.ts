import { CategoryType } from '@/entities/category.entity';
import { categoryByName } from '@/modules/entity-imports/helpers/category-by-name';

const WORKSPACE = 'workspace-1';
const scope = { workspaceId: WORKSPACE, userId: 'user-1' };

interface Stored {
  id: string;
  name: string;
  type: CategoryType;
  parentId: string | null;
  systemKey?: string | null;
}

/** A category repository over `stored`; `meanwhile` runs once the lock is taken, as another import would have. */
function repositoryOver(stored: Stored[], meanwhile?: () => void) {
  const calls: string[] = [];
  const repository = {
    find: vi.fn(async () => [...stored]),
    create: vi.fn((data: Partial<Stored>) => data),
    save: vi.fn(async (data: Partial<Stored>) => {
      calls.push('save');
      const saved = { ...data, id: `cat-${stored.length + 1}` } as Stored;
      stored.push(saved);
      return saved;
    }),
    manager: {
      transaction: async (work: (manager: unknown) => unknown) =>
        work({
          query: vi.fn(async (sql: string, params: unknown[]) => {
            calls.push(`${sql} ${JSON.stringify(params)}`);
            meanwhile?.();
          }),
          getRepository: () => repository,
        }),
    },
  };
  return { repository, calls };
}

describe('categoryByName', () => {
  it('takes the workspace lock before it makes a category', async () => {
    const stored: Stored[] = [];
    const { repository, calls } = repositoryOver(stored);

    const found = await categoryByName(repository as never, scope, 'Garden', 'expense', { create: true });

    expect(found).toEqual({ id: 'cat-1', created: true });
    expect(calls).toEqual([
      `SELECT pg_advisory_xact_lock(hashtextextended($1, 0)) ["category-by-name:${WORKSPACE}"]`,
      'save',
    ]);
  });

  it('takes the category another import made while it waited for the lock', async () => {
    const stored: Stored[] = [];
    const { repository } = repositoryOver(stored, () =>
      stored.push({ id: 'cat-other', name: 'Garden', type: CategoryType.EXPENSE, parentId: null }),
    );

    const found = await categoryByName(repository as never, scope, 'garden', 'expense', { create: true });

    expect(found).toEqual({ id: 'cat-other', created: false });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('only looks, without a lock, when it may not create', async () => {
    const { repository, calls } = repositoryOver([]);

    expect(await categoryByName(repository as never, scope, 'Garden', 'expense', { create: false })).toBeNull();
    expect(calls).toEqual([]);
  });

  it('finds a system category by its English name or an alias, whatever name it is stored under', async () => {
    const stored: Stored[] = [
      { id: 'cat-utilities', name: 'Коммунальные услуги', type: CategoryType.EXPENSE, parentId: null, systemKey: 'utilities' },
      { id: 'cat-rent', name: 'Rent', type: CategoryType.EXPENSE, parentId: null, systemKey: 'rent' },
      { id: 'cat-water', name: 'Вода', type: CategoryType.EXPENSE, parentId: 'cat-utilities' },
    ];
    const { repository } = repositoryOver(stored);
    const look = (name: string, parentId?: string) =>
      categoryByName(repository as never, scope, name, 'expense', { create: false, parentId });

    expect(await look('Utilities')).toEqual({ id: 'cat-utilities', created: false });
    expect(await look('Аренда')).toEqual({ id: 'cat-rent', created: false });
    expect(await look('Вода', 'cat-utilities')).toEqual({ id: 'cat-water', created: false });
    // A user category answers only to its own name.
    expect(await look('Water', 'cat-utilities')).toBeNull();
  });

  it('prefers a stored name over a system name', async () => {
    const stored: Stored[] = [
      { id: 'cat-system', name: 'Коммунальные услуги', type: CategoryType.EXPENSE, parentId: null, systemKey: 'utilities' },
      { id: 'cat-own', name: 'Utilities', type: CategoryType.EXPENSE, parentId: null },
    ];
    const { repository } = repositoryOver(stored);

    const found = await categoryByName(repository as never, scope, 'Utilities', 'expense', { create: false });

    expect(found).toEqual({ id: 'cat-own', created: false });
  });
});
