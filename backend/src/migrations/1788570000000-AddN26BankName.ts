import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddN26BankName1788570000000 implements MigrationInterface {
  name = 'AddN26BankName1788570000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'n26\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'n26' value will remain but is harmless if unused.
  }
}
