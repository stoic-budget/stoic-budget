import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWebsterBankName1789020000000 implements MigrationInterface {
  name = 'AddWebsterBankName1789020000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'webster\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'webster' value will remain but is harmless if unused.
  }
}
