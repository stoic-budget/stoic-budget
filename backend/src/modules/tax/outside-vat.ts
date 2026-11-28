import type { EntityManager } from 'typeorm';
import { isUncategorizedName } from '../categories/uncategorized-category';

/**
 * Default categories (by `system_key`, whatever they are called now) whose rows
 * carry no VAT anywhere we tax: interest is an exempt financial service (VAT
 * Directive art. 135(1)(b)); wages and staff benefits are not a supply, nor
 * are cash taken from an ATM and money sent to a person. Insurance
 * (art. 135(1)(a)) is handled beside it, since the UAE taxes general insurance.
 */
const OUTSIDE_VAT_SYSTEM_KEYS: ReadonlySet<string> = new Set([
  'interest_income',
  'interest',
  'payroll',
  'benefits',
  'salary',
  'cash',
  'transfers_people',
]);

/**
 * Whether a default category (or one under it) books something no VAT is
 * charged on, or the row sits in the Uncategorized fallback. Matched by
 * `system_key`, so a renamed default and a user's own category that took the
 * default's role count too.
 */
export async function isOutsideVat(
  manager: EntityManager,
  workspaceId: string,
  categoryId: string,
  jurisdictionCode: string | null,
): Promise<boolean> {
  const rows: Array<{ name: string; system_key: string | null }> = await manager.query(
    `SELECT c.name, c.system_key FROM categories c
    WHERE c.workspace_id = $2
      AND (c.id = $1 OR c.id = (SELECT parent_id FROM categories WHERE id = $1 AND workspace_id = $2))`,
    [categoryId, workspaceId],
  );
  return rows.some(
    row =>
      // The Uncategorized fallback says nothing about the row, like no category.
      isUncategorizedName(row.name) ||
      (row.system_key !== null &&
        (OUTSIDE_VAT_SYSTEM_KEYS.has(row.system_key) ||
          (row.system_key === 'insurance' && jurisdictionCode?.toUpperCase() !== 'AE'))),
  );
}
