import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGo2bankBankName1788320000000 implements MigrationInterface {
  name = 'AddGo2bankBankName1788320000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'go2bank\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'go2bank' value will remain but is harmless if unused.
  }
}
