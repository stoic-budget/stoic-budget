import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The daily job used to set "Missing charge" on every active subscription on
 * its payment day, without looking at the charges (#664). Those flags say
 * nothing; the job now sets the flag only for a payment that did not come, so
 * the old ones are cleared and the next runs set the true ones again.
 */
export class ClearBlanketMissingChargeFlags1789260000000 implements MigrationInterface {
  name = 'ClearBlanketMissingChargeFlags1789260000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "subscriptions" SET "risk_status" = 'none' WHERE "risk_status" = 'missing_charge'`,
    );
  }

  public async down(): Promise<void> {
    // The cleared flags were not true; nothing to put back.
  }
}
