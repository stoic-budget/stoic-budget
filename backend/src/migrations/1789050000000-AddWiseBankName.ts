import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWiseBankName1789050000000 implements MigrationInterface {
  name = 'AddWiseBankName1789050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'wise\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'wise' value will remain but is harmless if unused.
  }
}
