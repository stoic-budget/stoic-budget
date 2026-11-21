import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRaiffeisenBankName1788700000000 implements MigrationInterface {
  name = 'AddRaiffeisenBankName1788700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'raiffeisen\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'raiffeisen' value will remain but is harmless if unused.
  }
}
