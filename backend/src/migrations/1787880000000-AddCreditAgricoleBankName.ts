import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreditAgricoleBankName1787880000000 implements MigrationInterface {
  name = 'AddCreditAgricoleBankName1787880000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'credit_agricole\'',
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'credit_agricole' value will remain but is harmless if unused.
  }
}
