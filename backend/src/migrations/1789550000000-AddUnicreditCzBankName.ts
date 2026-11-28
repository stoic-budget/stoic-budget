import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUnicreditCzBankName1789550000000 implements MigrationInterface {
  name = 'AddUnicreditCzBankName1789550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'unicredit_cz\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'unicredit_cz' value will remain but is harmless if unused.
  }
}
