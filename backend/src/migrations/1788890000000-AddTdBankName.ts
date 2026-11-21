import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTdBankName1788890000000 implements MigrationInterface {
  name = 'AddTdBankName1788890000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'td\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'td' value will remain but is harmless if unused.
  }
}
