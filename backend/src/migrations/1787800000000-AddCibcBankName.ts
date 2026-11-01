import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCibcBankName1787800000000 implements MigrationInterface {
  name = 'AddCibcBankName1787800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'cibc\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'cibc' value will remain but is harmless if unused.
  }
}
