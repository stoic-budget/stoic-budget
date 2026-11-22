import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHuntingtonBankName1788420000000 implements MigrationInterface {
  name = 'AddHuntingtonBankName1788420000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'huntington\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'huntington' value will remain but is harmless if unused.
  }
}
