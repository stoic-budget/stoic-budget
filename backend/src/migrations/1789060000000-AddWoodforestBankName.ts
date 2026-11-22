import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWoodforestBankName1789060000000 implements MigrationInterface {
  name = 'AddWoodforestBankName1789060000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'woodforest\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'woodforest' value will remain but is harmless if unused.
  }
}
