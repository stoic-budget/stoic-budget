import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { Workspace } from './workspace.entity';
import { WorkspaceMember } from './workspace-member.entity';

/**
 * A member's calendar feed in one workspace. The link carries a random token;
 * only its SHA-256 is stored, so a leaked database does not hand out feeds
 * and the link is shown once, when it is made.
 */
@Entity('calendar_feeds')
@Index('UQ_calendar_feeds_member', ['workspaceId', 'memberId'], { unique: true })
@Index('UQ_calendar_feeds_token_hash', ['tokenHash'], { unique: true })
export class CalendarFeed {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Relation<Workspace>;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => WorkspaceMember, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'member_id' })
  member: Relation<WorkspaceMember>;

  @Column({ name: 'member_id', type: 'uuid' })
  memberId: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ name: 'include_payables', type: 'boolean', default: true })
  includePayables: boolean;

  @Column({ name: 'include_subscriptions', type: 'boolean', default: true })
  includeSubscriptions: boolean;

  @Column({ name: 'include_tax_deadlines', type: 'boolean', default: true })
  includeTaxDeadlines: boolean;

  @Column({ name: 'include_invoices', type: 'boolean', default: true })
  includeInvoices: boolean;

  @Column({ name: 'last_fetched_at', type: 'timestamptz', nullable: true })
  lastFetchedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
