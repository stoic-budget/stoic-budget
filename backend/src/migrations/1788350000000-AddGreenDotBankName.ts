import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGreenDotBankName1788350000000 implements MigrationInterface {
  name = 'AddGreenDotBankName1788350000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'green_dot\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'green_dot' value will remain but is harmless if unused.
  }
}
