import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVirginMoneyBankName1789000000000 implements MigrationInterface {
  name = 'AddVirginMoneyBankName1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'virgin_money\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'virgin_money' value will remain but is harmless if unused.
  }
}
