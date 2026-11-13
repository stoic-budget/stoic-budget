import { Category, CategorySource, CategoryType } from '../../../entities/category.entity';
import type { ImportCreatedRef } from '../../../entities/import-batch.entity';
import type { ImportContext } from '../targets/target.types';
import { nameKey } from './import-values';

/**
 * A category by name for one import run, created on first use and noted in
 * `created` so undoing the import removes it. A dry run never creates one.
 */
export function importCategoryResolver(
  manager: ImportContext['manager'],
  workspaceId: string,
  userId: string,
  dryRun: boolean,
  created: ImportCreatedRef[],
): ImportContext['category'] {
  const categoryRepo = manager.getRepository(Category);
  const categoryCache = new Map<string, string>();
  return async (name, type) => {
    const key = `${type}|${nameKey(name)}`;
    if (!nameKey(name)) {
      return null;
    }
    const cached = categoryCache.get(key);
    if (cached) {
      return cached;
    }
    const all = await categoryRepo.find({
      where: { workspaceId },
      select: { id: true, name: true, type: true },
    });
    const found =
      all.find(item => item.type === type && nameKey(item.name) === nameKey(name)) ??
      all.find(item => nameKey(item.name) === nameKey(name));
    if (found) {
      categoryCache.set(key, found.id);
      return found.id;
    }
    if (dryRun) {
      return null;
    }
    const saved = await categoryRepo.save(
      categoryRepo.create({
        workspaceId,
        userId,
        name: name.trim(),
        type: type === 'income' ? CategoryType.INCOME : CategoryType.EXPENSE,
        source: CategorySource.USER,
        isSystem: false,
      }),
    );
    created.push({ kind: 'category', id: saved.id });
    categoryCache.set(key, saved.id);
    return saved.id;
  };
}
