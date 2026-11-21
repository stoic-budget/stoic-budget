import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSkrillBankName1788790000000 implements MigrationInterface {
  name = 'AddSkrillBankName1788790000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'skrill\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'skrill' value will remain but is harmless if unused.
  }
}
