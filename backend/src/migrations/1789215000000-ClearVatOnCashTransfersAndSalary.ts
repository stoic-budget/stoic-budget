import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Takes the default VAT off rows booked to categories that carry none: cash
 * withdrawals, transfers to people and salary (not a supply), and the
 * Uncategorized fallback (the row's kind is not known). The engine now skips
 * them; this clears what it assessed before. The defaults are found by their
 * `system_key`, so a renamed one counts too.
 *
 * Only figures that came from the workspace default go — a rate the user
 * picked or a rule they wrote stays — and rows on a filed return keep what
 * was filed.
 */
export class ClearVatOnCashTransfersAndSalary1789215000000 implements MigrationInterface {
  name = 'ClearVatOnCashTransfersAndSalary1789215000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "transactions" t SET
        "tax_rate_id" = NULL,
        "tax_rule_id" = NULL,
        "tax_source" = NULL,
        "tax_amount" = NULL,
        "tax_net_amount" = NULL,
        "tax_notional_amount" = NULL,
        "tax_reverse_charge" = false
      FROM "categories" c
      WHERE t."tax_locked" = false
        AND t."tax_source" = 'default'
        AND t."workspace_id" = c."workspace_id"
        AND (
          t."category_id" = c."id"
          OR t."category_id" IN (SELECT child."id" FROM "categories" child WHERE child."parent_id" = c."id")
        )
        AND (
          c."system_key" IN ('cash', 'transfers_people', 'salary')
          OR LOWER(TRIM(c."name")) = 'uncategorized'
        )
    `);
  }

  public async down(): Promise<void> {
    // Nothing to restore: re-applying the tax rules rebuilds any figure that should exist.
  }
}
