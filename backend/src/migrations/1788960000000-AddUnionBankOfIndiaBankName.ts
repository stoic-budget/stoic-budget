import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUnionBankOfIndiaBankName1788960000000 implements MigrationInterface {
  name = 'AddUnionBankOfIndiaBankName1788960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'union_bank_of_india\'',
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'union_bank_of_india' value will remain but is harmless if unused.
  }
}
