import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * How the feed is doing for one symbol: whether its history was backfilled,
 * the newest close it brought, and how many fetches in a row brought none.
 * Shared like `security_prices`; a workspace's own closes are weighed on top
 * of it when the workspace reads its status.
 */
@Entity('security_price_symbols')
export class SecurityPriceSymbol {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  symbol: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  currency: string | null;

  @Column({ name: 'consecutive_failures', type: 'int', default: 0 })
  consecutiveFailures: number;

  @Column({ name: 'last_close_on', type: 'date', nullable: true })
  lastCloseOn: string | null;

  @Column({ name: 'last_attempt_at', type: 'timestamptz', nullable: true })
  lastAttemptAt: Date | null;

  @Column({ name: 'backfilled_at', type: 'timestamptz', nullable: true })
  backfilledAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
