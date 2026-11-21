import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScotiabankBankName1788770000000 implements MigrationInterface {
  name = 'AddScotiabankBankName1788770000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'scotiabank\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'scotiabank' value will remain but is harmless if unused.
  }
}
