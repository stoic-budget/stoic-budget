import { Category } from '../../../entities/category.entity';
import type { ImportCreatedRef } from '../../../entities/import-batch.entity';
import type { ImportContext } from '../targets/target.types';
import { categoryByName } from './category-by-name';
import { nameKey } from './import-values';

/**
 * A category by name for one import run (`categoryByName`), created on first
 * use and noted in `created` so undoing the import removes it. A dry run
 * never creates one.
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
    const found = await categoryByName(categoryRepo, { workspaceId, userId }, name, type, {
      create: !dryRun,
    });
    if (!found) {
      return null;
    }
    if (found.created) {
      created.push({ kind: 'category', id: found.id });
    }
    categoryCache.set(key, found.id);
    return found.id;
  };
}
