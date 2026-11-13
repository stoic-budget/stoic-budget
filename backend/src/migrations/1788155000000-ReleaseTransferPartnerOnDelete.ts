import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Deleting one leg of a pair (a transfer, a reimbursement) left the other leg
 * pointing at a pair with nobody else in it. Every income and spending figure
 * skips rows that have a pair, so that leg dropped out of them for good, and
 * pairing skips it too, so a re-parsed statement could not pair with it again.
 * Rows are deleted in many places (reprocessing or re-teaching a statement,
 * deleting it from the trash, deleting one row), so the database releases the
 * other leg itself. A pair of one (a single-leg crypto or investment row)
 * has nobody else to release. Pairs left alone by earlier deletes stay as they are.
 */
export class ReleaseTransferPartnerOnDelete1788155000000 implements MigrationInterface {
  name = 'ReleaseTransferPartnerOnDelete1788155000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "release_transfer_partner"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        UPDATE "transactions"
           SET "transfer_pair_id" = NULL, "transfer_pair_source" = NULL, "transfer_pair_kind" = NULL
         WHERE "workspace_id" = OLD."workspace_id"
           AND "transfer_pair_id" = OLD."transfer_pair_id"
           AND "id" <> OLD."id";
        RETURN NULL;
      END;
      $$
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "TRG_transactions_release_transfer_partner" ON "transactions"
    `);
    await queryRunner.query(`
      CREATE TRIGGER "TRG_transactions_release_transfer_partner"
        AFTER DELETE ON "transactions"
        FOR EACH ROW WHEN (OLD."transfer_pair_id" IS NOT NULL)
        EXECUTE FUNCTION "release_transfer_partner"()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS "TRG_transactions_release_transfer_partner" ON "transactions"',
    );
    await queryRunner.query('DROP FUNCTION IF EXISTS "release_transfer_partner"()');
  }
}
