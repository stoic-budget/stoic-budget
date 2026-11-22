import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIngBankName1788460000000 implements MigrationInterface {
  name = 'AddIngBankName1788460000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'ing\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'ing' value will remain but is harmless if unused.
  }
}
