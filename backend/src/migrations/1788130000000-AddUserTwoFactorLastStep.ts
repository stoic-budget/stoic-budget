import type { MigrationInterface, QueryRunner } from 'typeorm';

/** The last TOTP time step a login spent, so an overheard code cannot be replayed. */
export class AddUserTwoFactorLastStep1788130000000 implements MigrationInterface {
  name = 'AddUserTwoFactorLastStep1788130000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_last_step" integer',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN IF EXISTS "two_factor_last_step"');
  }
}
