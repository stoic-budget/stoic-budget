import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHeritageBankName1788390000000 implements MigrationInterface {
  name = 'AddHeritageBankName1788390000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'heritage\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'heritage' value will remain but is harmless if unused.
  }
}
