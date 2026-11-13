import type { Repository } from 'typeorm';
import { Category, CategorySource, CategoryType } from '../../../entities/category.entity';
import { DEFAULT_SYSTEM_CATEGORIES } from '../../categories/system-categories';
import { nameKey } from './import-values';

export type CategoryKind = 'income' | 'expense';

type Candidate = Pick<Category, 'id' | 'name' | 'type' | 'parentId' | 'systemKey'>;

/** Every name a system category goes by, its English one and older ones, by `systemKey`. */
const SYSTEM_NAMES = new Map<string, Set<string>>(
  DEFAULT_SYSTEM_CATEGORIES.map(item => [
    item.key,
    new Set([item.name, ...(item.aliases ?? [])].map(nameKey)),
  ]),
);

function loadCandidates(repository: Repository<Category>, workspaceId: string) {
  return repository.find({
    where: { workspaceId },
    select: { id: true, name: true, type: true, parentId: true, systemKey: true },
  });
}

/**
 * The stored name first, the row's kind before another kind. Then a system
 * category of the row's kind by any name it goes by, since older migrations
 * stored those in Russian while a file may say `Utilities`. Only of its kind:
 * an income row named `Other` must not land on the expense `Other expenses`.
 */
function pick(
  all: Candidate[],
  key: string,
  type: CategoryKind,
  parentId: string | undefined,
): Candidate | undefined {
  const candidates = parentId === undefined ? all : all.filter(item => item.parentId === parentId);
  const byStoredName = (item: Candidate) => nameKey(item.name) === key;
  return (
    candidates.find(item => item.type === type && byStoredName(item)) ??
    candidates.find(byStoredName) ??
    candidates.find(
      item =>
        item.type === type && Boolean(item.systemKey && SYSTEM_NAMES.get(item.systemKey)?.has(key)),
    )
  );
}

/**
 * The workspace category a file names, by name: the one of the row's kind
 * first, then one of any kind, and otherwise a new user category, unless the
 * caller only looks (`create: false`). Names compare without case or
 * punctuation. With `parentId` only that category's children count and a new
 * one is made under it; without it a category anywhere in the tree matches.
 */
export async function categoryByName(
  repository: Repository<Category>,
  scope: { workspaceId: string; userId: string },
  name: string,
  type: CategoryKind,
  options: { parentId?: string; create: boolean },
): Promise<{ id: string; created: boolean } | null> {
  const key = nameKey(name);
  if (!key) {
    return null;
  }
  const found = pick(
    await loadCandidates(repository, scope.workspaceId),
    key,
    type,
    options.parentId,
  );
  if (found) {
    return { id: found.id, created: false };
  }
  if (!options.create) {
    return null;
  }
  // The statements of one multi-account file are parsed at once and name the
  // same new categories; nothing unique stops two copies, so a workspace makes
  // its categories one at a time and looks again under the lock. Inside a
  // caller's transaction this is a savepoint and the lock lasts until it ends.
  return repository.manager.transaction(async manager => {
    await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `category-by-name:${scope.workspaceId}`,
    ]);
    const locked = manager.getRepository(Category);
    const again = pick(
      await loadCandidates(locked, scope.workspaceId),
      key,
      type,
      options.parentId,
    );
    if (again) {
      return { id: again.id, created: false };
    }
    const created = await locked.save(
      locked.create({
        workspaceId: scope.workspaceId,
        userId: scope.userId,
        name: name.trim(),
        type: type === 'income' ? CategoryType.INCOME : CategoryType.EXPENSE,
        parentId: options.parentId ?? null,
        source: CategorySource.USER,
        isSystem: false,
      }),
    );
    return { id: created.id, created: true };
  });
}
