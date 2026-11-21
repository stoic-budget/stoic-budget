import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNetspendBankName1788630000000 implements MigrationInterface {
  name = 'AddNetspendBankName1788630000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'netspend\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'netspend' value will remain but is harmless if unused.
  }
}
