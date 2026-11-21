import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHandelsbankenBankName1788370000000 implements MigrationInterface {
  name = 'AddHandelsbankenBankName1788370000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'handelsbanken\'',
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'handelsbanken' value will remain but is harmless if unused.
  }
}
