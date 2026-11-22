import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPncBankName1788670000000 implements MigrationInterface {
  name = 'AddPncBankName1788670000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'pnc\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'pnc' value will remain but is harmless if unused.
  }
}
