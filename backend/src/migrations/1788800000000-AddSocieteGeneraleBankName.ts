import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSocieteGeneraleBankName1788800000000 implements MigrationInterface {
  name = 'AddSocieteGeneraleBankName1788800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'societe_generale\'',
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'societe_generale' value will remain but is harmless if unused.
  }
}
