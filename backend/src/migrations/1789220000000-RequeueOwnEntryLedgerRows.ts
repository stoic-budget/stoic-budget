import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A manual expense or receipt scan on an account was booked by the ledger as a
 * bank statement of its own ("Other · EUR"), and the account's opening balance
 * was dropped. The posting rule is fixed; this queues those rows and their
 * workspaces' openings so the next sync books them to the account again.
 * Data only, and safe to run twice.
 */
export class RequeueOwnEntryLedgerRows1789220000000 implements MigrationInterface {
  name = 'RequeueOwnEntryLedgerRows1789220000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "transactions" t
         SET "ledger_dirty" = true, "ledger_error" = NULL, "ledger_attempted_at" = NULL
        FROM "statements" s
       WHERE s."id" = t."statement_id"
         AND s."workspace_id" = t."workspace_id"
         AND t."wallet_id" IS NOT NULL
         AND s."parsing_details"->>'detectedBy' IN ('manual-expense', 'receipt-scan')
    `);
    await queryRunner.query(`
      UPDATE "workspaces" w
         SET "ledger_openings_dirty" = true, "ledger_openings_attempted_at" = NULL
       WHERE EXISTS (
         SELECT 1 FROM "transactions" t JOIN "statements" s ON s."id" = t."statement_id"
          WHERE t."workspace_id" = w."id" AND t."wallet_id" IS NOT NULL
            AND s."parsing_details"->>'detectedBy' IN ('manual-expense', 'receipt-scan')
       )
    `);
  }

  public async down(): Promise<void> {
    // Nothing to undo: the rows are only queued for the ledger again.
  }
}
