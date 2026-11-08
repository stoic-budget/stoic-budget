import type { Repository } from 'typeorm';
import { Category, CategorySource, CategoryType } from '../../../entities/category.entity';
import { nameKey } from './import-values';

export type CategoryKind = 'income' | 'expense';

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
  const all = await repository.find({
    where: { workspaceId: scope.workspaceId },
    select: { id: true, name: true, type: true, parentId: true },
  });
  const candidates =
    options.parentId === undefined ? all : all.filter(item => item.parentId === options.parentId);
  const found =
    candidates.find(item => item.type === type && nameKey(item.name) === key) ??
    candidates.find(item => nameKey(item.name) === key);
  if (found) {
    return { id: found.id, created: false };
  }
  if (!options.create) {
    return null;
  }
  const created = await repository.save(
    repository.create({
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
}
