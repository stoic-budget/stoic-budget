import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Earlier VAT statuses of a workspace, each with the day the next one took
 * over, so a row is assessed under the status of its own date. Workspaces
 * start with none: their current status keeps applying to the whole past.
 */
export class AddVatStatusHistory1789250000000 implements MigrationInterface {
  name = 'AddVatStatusHistory1789250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workspaces" ADD COLUMN "vat_status_history" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "vat_status_history"`);
  }
}
