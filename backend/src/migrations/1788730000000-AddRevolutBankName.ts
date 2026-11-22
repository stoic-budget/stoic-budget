import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRevolutBankName1788730000000 implements MigrationInterface {
  name = 'AddRevolutBankName1788730000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'revolut\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'revolut' value will remain but is harmless if unused.
  }
}
