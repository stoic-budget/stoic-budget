import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A daily close from the price feed, shared by every workspace that holds the
 * symbol: market data, not workspace data, like `exchange_rates`. Only the feed
 * writes here; a close a workspace types in or imports goes to
 * `workspace_security_prices`, so no workspace can change another's figures.
 *
 * `symbol` is the holding's normalized symbol (`AAPL.US`, `VOD.UK`): ticker and
 * market, as the price service keys it. `close` is the price of one unit as it
 * was quoted that day, before any later split.
 */
@Entity('security_prices')
@Index('UQ_security_prices_symbol_date', ['symbol', 'priceDate'], { unique: true })
export class SecurityPrice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32 })
  symbol: string;

  @Column({ name: 'price_date', type: 'date' })
  priceDate: string;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  close: string;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
