import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFioBankName1789520000000 implements MigrationInterface {
  name = 'AddFioBankName1789520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'fio\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'fio' value will remain but is harmless if unused.
  }
}
