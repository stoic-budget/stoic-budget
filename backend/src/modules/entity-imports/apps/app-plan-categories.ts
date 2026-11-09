import { nameKey } from '../helpers/import-values';
import type { AppBudgetRow } from './app-model';

export interface ExistingCategory {
  id: string;
  name: string;
  parentId: string | null;
  type: 'income' | 'expense';
}

export interface PlannedCategory {
  key: string;
  group: string | null;
  name: string;
  type: 'income' | 'expense';
  /** The workspace category the rows go to; null until a new one is created. */
  id: string | null;
  status: 'created' | 'matched';
}

export interface PlannedGroup {
  key: string;
  name: string;
  type: 'income' | 'expense';
  id: string | null;
  status: 'created' | 'matched';
}

export const categoryKey = (group: string | null, name: string): string =>
  `${nameKey(group ?? '')}|${nameKey(name)}`;

/** A category the rows or the plan use, with whether money mostly came in through it. */
export interface CategoryUse {
  group: string | null;
  name: string;
  inflows: number;
  outflows: number;
}

/** The categories of the transaction rows and the plan, keyed by group and name. */
export function categoryUses(
  rows: Array<{ group: string | null; category: string | null; amount: number }>,
  budgets: AppBudgetRow[],
): Map<string, CategoryUse> {
  const uses = new Map<string, CategoryUse>();
  const note = (group: string | null, name: string, amount: number) => {
    const key = categoryKey(group, name);
    const use = uses.get(key) ?? { group, name, inflows: 0, outflows: 0 };
    if (amount > 0) {
      use.inflows += 1;
    } else if (amount < 0) {
      use.outflows += 1;
    }
    uses.set(key, use);
  };
  for (const row of rows) {
    if (row.category) {
      note(row.group, row.category, row.amount);
    }
  }
  for (const budget of budgets) {
    note(budget.group, budget.category, 0);
  }
  return uses;
}

/**
 * Each category under its group: the same group and name in the workspace
 * first, then the same name and type anywhere; anything else is created, under
 * a group of that name (an existing top-level one, or a new one).
 */
export function planCategories(
  uses: Map<string, CategoryUse>,
  existing: ExistingCategory[],
): { categories: Map<string, PlannedCategory>; groups: Map<string, PlannedGroup> } {
  const roots = existing.filter(item => !item.parentId);
  const categories = new Map<string, PlannedCategory>();
  const groups = new Map<string, PlannedGroup>();
  // A name is unique per type in a workspace: two groups' "Misc" become one category.
  const planned = new Map<string, PlannedCategory>();
  const sameName = (name: string, type: string) =>
    existing.find(item => item.type === type && nameKey(item.name) === nameKey(name));
  for (const [key, use] of uses) {
    const type = use.inflows > use.outflows ? 'income' : 'expense';
    const parent = use.group
      ? roots.find(root => nameKey(root.name) === nameKey(use.group ?? ''))
      : undefined;
    const found =
      (parent &&
        existing.find(
          item => item.parentId === parent.id && nameKey(item.name) === nameKey(use.name),
        )) ||
      sameName(use.name, type);
    const twin = planned.get(`${type}|${nameKey(use.name)}`);
    if (!found && twin) {
      categories.set(key, twin);
      continue;
    }
    // A group named like an existing category, or like the category itself, would repeat
    // the name: the category stays top-level.
    const repeats =
      use.group &&
      !parent &&
      (sameName(use.group, type) || nameKey(use.group) === nameKey(use.name));
    const group = !found && repeats ? null : use.group;
    const category: PlannedCategory = {
      key,
      group,
      name: use.name,
      type,
      id: found?.id ?? null,
      status: found ? 'matched' : 'created',
    };
    categories.set(key, category);
    if (found) {
      continue;
    }
    planned.set(`${type}|${nameKey(use.name)}`, category);
    if (group && !groups.has(nameKey(group))) {
      groups.set(nameKey(group), {
        key: nameKey(group),
        name: group,
        type,
        id: parent?.id ?? null,
        status: parent ? 'matched' : 'created',
      });
    }
  }
  return { categories, groups };
}
