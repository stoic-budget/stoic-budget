import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCapitalOneBankName1787740000000 implements MigrationInterface {
  name = 'AddCapitalOneBankName1787740000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'capital_one\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'capital_one' value will remain but is harmless if unused.
  }
}
