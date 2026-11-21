import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFnbBankName1788290000000 implements MigrationInterface {
  name = 'AddFnbBankName1788290000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'fnb\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'fnb' value will remain but is harmless if unused.
  }
}
