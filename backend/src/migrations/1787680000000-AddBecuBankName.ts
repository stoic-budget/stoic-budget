import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBecuBankName1787680000000 implements MigrationInterface {
  name = 'AddBecuBankName1787680000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'becu\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'becu' value will remain but is harmless if unused.
  }
}
