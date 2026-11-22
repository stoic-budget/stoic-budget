import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRbcBankName1788710000000 implements MigrationInterface {
  name = 'AddRbcBankName1788710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'rbc\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'rbc' value will remain but is harmless if unused.
  }
}
