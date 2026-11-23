import { UNCATEGORIZED_CATEGORY_NAME } from '../categories/uncategorized-category';

/**
 * Income categories that are not earned from customers: wages (taxed at
 * source), interest (an exempt financial service). By `system_key`, so a
 * renamed default and its subcategories count too.
 */
const NOT_SALES_SYSTEM_KEYS = ['salary', 'interest_income'];

/**
 * SQL true when the row under `alias` is a sale: its category (or that
 * category's parent) is an income category, not wages or interest, and not
 * the Uncategorized fallback. A refund filed under an expense category, a
 * loan or a transfer left in Uncategorized, and a salary are not turnover.
 */
export function salesCategorySql(alias: string): string {
  const keys = NOT_SALES_SYSTEM_KEYS.map(key => `'${key}'`).join(', ');
  return `EXISTS (
    SELECT 1 FROM "categories" sc LEFT JOIN "categories" sp ON sp."id" = sc."parent_id"
     WHERE sc."id" = ${alias}."category_id" AND sc."workspace_id" = ${alias}."workspace_id"
       AND sc."type" = 'income'
       AND lower(trim(sc."name")) <> '${UNCATEGORIZED_CATEGORY_NAME.toLowerCase()}'
       AND coalesce(sc."system_key", '') NOT IN (${keys})
       AND coalesce(sp."system_key", '') NOT IN (${keys}))`;
}
