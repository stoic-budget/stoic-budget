import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Why a bill was paid late, as the person says it: one of six reasons and a
 * short note. Null until they say; bills written before this have none. Read
 * back as a yearly summary on the bills page and as advice when the same
 * reason keeps coming back.
 */
export class AddPayableLateReason1789510000000 implements MigrationInterface {
  name = 'AddPayableLateReason1789510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payables" ADD COLUMN IF NOT EXISTS "late_reason" varchar(32) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "payables" ADD COLUMN IF NOT EXISTS "late_reason_note" varchar(200) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "payables" DROP CONSTRAINT IF EXISTS "CHK_payables_late_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payables" ADD CONSTRAINT "CHK_payables_late_reason"
         CHECK ("late_reason" IS NULL OR "late_reason" IN ('forgot', 'short_before_payday',
           'income_late', 'unexpected_expense', 'bank_or_payment_issue', 'other'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payables" DROP CONSTRAINT IF EXISTS "CHK_payables_late_reason"`,
    );
    await queryRunner.query(`ALTER TABLE "payables" DROP COLUMN IF EXISTS "late_reason_note"`);
    await queryRunner.query(`ALTER TABLE "payables" DROP COLUMN IF EXISTS "late_reason"`);
  }
}
