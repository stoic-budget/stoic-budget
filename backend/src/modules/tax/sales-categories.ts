import { UNCATEGORIZED_CATEGORY_NAME } from '../categories/uncategorized-category';

/** Wages are taxed at source, and interest is an exempt financial service: neither is a sale. */
const WAGES = 'salary';
const INTEREST = 'interest_income';

/**
 * SQL true when the row under `alias` is earned from customers: its category is
 * an income category, neither it nor any category above it is wages (or, for
 * VAT turnover, interest), and it is not the Uncategorized fallback. A refund
 * filed under an expense category, a loan or a transfer left in Uncategorized,
 * and a salary are not. By `system_key`, so a renamed default counts too.
 *
 * `uncategorizedRows`: whether a row with no category at all counts (the
 * reserve keeps a client payment recorded without one; the threshold, which
 * only counts filed sales, does not).
 */
export function salesCategorySql(
  alias: string,
  options: { interest?: boolean; uncategorizedRows?: boolean } = {},
): string {
  const excluded = options.interest ? [WAGES] : [WAGES, INTEREST];
  const keys = excluded.map(key => `'${key}'`).join(', ');
  const filed = `EXISTS (
    SELECT 1 FROM "categories" sc
     WHERE sc."id" = ${alias}."category_id" AND sc."workspace_id" = ${alias}."workspace_id"
       AND sc."type" = 'income'
       AND lower(trim(sc."name")) <> '${UNCATEGORIZED_CATEGORY_NAME.toLowerCase()}'
       AND NOT EXISTS (
         WITH RECURSIVE up AS (
           SELECT c."id", c."parent_id", c."system_key", 0 AS depth FROM "categories" c WHERE c."id" = sc."id"
           UNION ALL
           SELECT p."id", p."parent_id", p."system_key", up.depth + 1
             FROM "categories" p JOIN up ON p."id" = up."parent_id"
            WHERE up.depth < 20
         )
         SELECT 1 FROM up WHERE up."system_key" IN (${keys})))`;
  return options.uncategorizedRows ? `(${alias}."category_id" IS NULL OR ${filed})` : filed;
}
