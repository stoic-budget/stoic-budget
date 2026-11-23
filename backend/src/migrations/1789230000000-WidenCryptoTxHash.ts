import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A Solana signature (base58 of 64 bytes) is 87–88 characters; the column held
 * 66, the length of an EVM hash, so a Solana transfer failed its insert and the
 * wallet never synced. Widening a varchar does not rewrite the table in
 * Postgres; the partial unique index `IDX_transactions_crypto_tx`, whose WHERE
 * names the column, is rebuilt under the ALTER's lock (it holds crypto rows only).
 */
export class WidenCryptoTxHash1789230000000 implements MigrationInterface {
  name = 'WidenCryptoTxHash1789230000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "crypto_tx_hash" TYPE character varying(120)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Back to 66 rewrites the table, and fails once a longer hash was stored.
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "crypto_tx_hash" TYPE character varying(66)`,
    );
  }
}
