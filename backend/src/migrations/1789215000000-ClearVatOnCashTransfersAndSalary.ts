import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Takes the default VAT off rows booked to categories the engine now keeps
 * outside VAT: cash withdrawals, transfers to people and salary (not a
 * supply), the Uncategorized fallback (the row's kind is not known), and the
 * interest, payroll, benefits and (outside the UAE) insurance defaults found by
 * `system_key`, which the earlier ClearVatOnExemptSystemCategories matched by
 * English name on system rows only. A category one level under one counts too,
 * as in the engine.
 *
 * Only figures that came from the workspace default go — a rate the user
 * picked or a rule they wrote stays — and rows on a filed return keep what
 * was filed. The category set is worked out once, so the update is one pass
 * over the matching rows.
 */
export class ClearVatOnCashTransfersAndSalary1789215000000 implements MigrationInterface {
  name = 'ClearVatOnCashTransfersAndSalary1789215000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH outside AS (
        SELECT c."id", c."workspace_id"
        FROM "categories" c
        JOIN "workspaces" w ON w."id" = c."workspace_id"
        LEFT JOIN "tax_jurisdictions" j ON j."id" = w."tax_jurisdiction_id"
        WHERE c."system_key" IN (
            'interest_income', 'interest', 'payroll', 'benefits', 'salary', 'cash', 'transfers_people'
          )
          OR (c."system_key" = 'insurance' AND COALESCE(UPPER(j."code"), '') <> 'AE')
          OR LOWER(TRIM(c."name")) = 'uncategorized'
      ),
      targets AS (
        SELECT o."id", o."workspace_id" FROM outside o
        UNION
        SELECT child."id", child."workspace_id"
        FROM "categories" child
        JOIN outside o ON o."id" = child."parent_id" AND o."workspace_id" = child."workspace_id"
      )
      UPDATE "transactions" t SET
        "tax_rate_id" = NULL,
        "tax_rule_id" = NULL,
        "tax_source" = NULL,
        "tax_amount" = NULL,
        "tax_net_amount" = NULL,
        "tax_notional_amount" = NULL,
        "tax_reverse_charge" = false
      FROM targets
      WHERE t."category_id" = targets."id"
        AND t."workspace_id" = targets."workspace_id"
        AND t."tax_locked" = false
        AND t."tax_source" = 'default'
    `);
  }

  public async down(): Promise<void> {
    // Nothing to restore: re-applying the tax rules rebuilds any figure that should exist.
  }
}
