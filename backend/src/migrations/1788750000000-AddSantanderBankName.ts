import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSantanderBankName1788750000000 implements MigrationInterface {
  name = 'AddSantanderBankName1788750000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'santander\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'santander' value will remain but is harmless if unused.
  }
}
