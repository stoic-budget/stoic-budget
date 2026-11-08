import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Unlinking a transfer used to mark both rows `rejected`, which kept each of
 * them out of automatic pairing for good, even with its real counterpart.
 * The refusal now belongs to the pair: one row per two rows, written lower id
 * first. No CHECK on that order: a backup restore or a workspace version gives
 * every row a new id, which may flip it, so readers accept either order.
 * Rows already marked `rejected` stay as they are, since their partner is not
 * known any more.
 */
export class AddTransferPairRejections1788150000000 implements MigrationInterface {
  name = 'AddTransferPairRejections1788150000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "transfer_pair_rejections" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "tx_low_id" uuid NOT NULL,
        "tx_high_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transfer_pair_rejections" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_transfer_pair_rejections_pair" UNIQUE ("tx_low_id", "tx_high_id"),
        CONSTRAINT "FK_transfer_pair_rejections_workspace" FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_transfer_pair_rejections_low" FOREIGN KEY ("tx_low_id")
          REFERENCES "transactions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_transfer_pair_rejections_high" FOREIGN KEY ("tx_high_id")
          REFERENCES "transactions"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_transfer_pair_rejections_workspace" ON "transfer_pair_rejections" ("workspace_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_transfer_pair_rejections_high" ON "transfer_pair_rejections" ("tx_high_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "transfer_pair_rejections"');
  }
}
