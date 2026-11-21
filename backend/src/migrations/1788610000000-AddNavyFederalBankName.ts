import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNavyFederalBankName1788610000000 implements MigrationInterface {
  name = 'AddNavyFederalBankName1788610000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'navy_federal\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'navy_federal' value will remain but is harmless if unused.
  }
}
