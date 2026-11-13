import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { Integration } from './integration.entity';

@Entity('open_protocol_settings')
@Check('CHK_open_protocol_settings_sync_interval', '"sync_interval_hours" BETWEEN 1 AND 24')
@Index('IDX_open_protocol_settings_next_pull_at', ['nextPullAt'])
export class OpenProtocolSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(
    () => Integration,
    integration => integration.openProtocolSettings,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'integration_id' })
  integration: Relation<Integration>;

  @Column({ name: 'integration_id', type: 'uuid' })
  integrationId: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  config: Record<string, unknown>;

  @Column({ name: 'encrypted_secrets', type: 'jsonb', default: () => "'{}'::jsonb" })
  encryptedSecrets: Record<string, string>;

  @Column({ name: 'last_sync_at', type: 'timestamp', nullable: true })
  lastSyncAt: Date | null;

  // Bank-sync schedule. Written only by the atomic UPDATEs in
  // BankSyncClaimsService, never by a whole-row save: a pull saves the settings
  // it loaded minutes earlier, and would put back a stale lease or interval.

  /** How often auto-sync pulls this connection, 1 to 24 hours. */
  @Column({
    name: 'sync_interval_hours',
    type: 'smallint',
    default: 6,
    insert: false,
    update: false,
  })
  syncIntervalHours: number;

  /** When the next automatic pull is due; null is due now. */
  @Column({
    name: 'next_pull_at',
    type: 'timestamptz',
    nullable: true,
    insert: false,
    update: false,
  })
  nextPullAt: Date | null;

  /** A running pull holds the connection until then; past it, another instance may take over. */
  @Column({
    name: 'pull_lease_until',
    type: 'timestamptz',
    nullable: true,
    insert: false,
    update: false,
  })
  pullLeaseUntil: Date | null;

  @Column({
    name: 'last_pull_attempt_at',
    type: 'timestamptz',
    nullable: true,
    insert: false,
    update: false,
  })
  lastPullAttemptAt: Date | null;

  @Column({ name: 'consecutive_failures', type: 'int', default: 0, insert: false, update: false })
  consecutiveFailures: number;

  /** No automatic pull before this, after failed pulls or a provider's Retry-After. */
  @Column({
    name: 'backoff_until',
    type: 'timestamptz',
    nullable: true,
    insert: false,
    update: false,
  })
  backoffUntil: Date | null;

  @Column({
    name: 'backoff_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
    insert: false,
    update: false,
  })
  backoffReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
