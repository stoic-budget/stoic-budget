import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSynchronyBankName1788860000000 implements MigrationInterface {
  name = 'AddSynchronyBankName1788860000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'synchrony\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'synchrony' value will remain but is harmless if unused.
  }
}
