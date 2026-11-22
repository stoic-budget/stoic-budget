import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWestpacBankName1789040000000 implements MigrationInterface {
  name = 'AddWestpacBankName1789040000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'westpac\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'westpac' value will remain but is harmless if unused.
  }
}
