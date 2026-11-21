import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProsperityBankName1788680000000 implements MigrationInterface {
  name = 'AddProsperityBankName1788680000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'prosperity\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'prosperity' value will remain but is harmless if unused.
  }
}
