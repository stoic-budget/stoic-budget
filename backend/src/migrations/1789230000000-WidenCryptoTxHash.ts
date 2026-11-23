import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A Solana signature (base58 of 64 bytes) is 87–88 characters; the column held
 * 66, the length of an EVM hash, so a Solana transfer failed its insert and the
 * wallet never synced. Widening a varchar keeps its data and indexes as they
 * are in Postgres: no rewrite.
 */
export class WidenCryptoTxHash1789230000000 implements MigrationInterface {
  name = 'WidenCryptoTxHash1789230000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "crypto_tx_hash" TYPE character varying(120)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Back to 66 only if nothing longer was stored since.
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "crypto_tx_hash" TYPE character varying(66)`,
    );
  }
}
