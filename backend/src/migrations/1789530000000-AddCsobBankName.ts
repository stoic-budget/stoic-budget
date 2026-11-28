import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCsobBankName1789530000000 implements MigrationInterface {
  name = 'AddCsobBankName1789530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'csob\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'csob' value will remain but is harmless if unused.
  }
}
