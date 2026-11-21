import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSuncorpBankName1788850000000 implements MigrationInterface {
  name = 'AddSuncorpBankName1788850000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'suncorp\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'suncorp' value will remain but is harmless if unused.
  }
}
