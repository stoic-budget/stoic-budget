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
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

export enum InsightType {
  CATEGORY_DOMINANCE = 'category.dominance',
  UNAPPROVED_COUNT = 'operational.unapproved_count',
  UNCATEGORIZED_COUNT = 'operational.uncategorized_count',
  DUPLICATE_DETECTED = 'operational.duplicate_detected',
  SPENDING_TREND_UP = 'trend.spending_up',
  SAVINGS_RATE_TREND = 'trend.savings_rate',
  RISKY_ALLOCATION = 'pattern.risky_allocation',
  /** Everyday accounts holding far more than a reserve of spending. */
  IDLE_CASH = 'pattern.idle_cash',
  /** Net worth passed a round number for the first time. */
  NET_WORTH_MILESTONE = 'pattern.net_worth_milestone',
  /** A category far above its own median month. */
  CATEGORY_ANOMALY = 'trend.category_anomaly',
  /** Stoic advice: plan (budget limits) against reality, per Stoic class. */
  STOIC_INTENT_GAP = 'stoic.intent_gap',
  STOIC_VIRTUE_NEGLECTED = 'stoic.virtue_neglected',
  STOIC_REPEATED = 'stoic.repeated',
  STOIC_UNCLASSIFIED = 'stoic.unclassified',
  /** Shown only when no other Stoic signal fired — the user is doing well. */
  STOIC_PRAISE = 'stoic.praise',
  /** The plan itself: overall overrun, pace, unused or missing budgets. */
  STOIC_PLAN = 'stoic.plan',
  /** Spending habits: small purchases, weekends, one dominant merchant. */
  STOIC_HABIT = 'stoic.habit',
  /** Income changed; did spending follow? */
  STOIC_FORTUNE = 'stoic.fortune',
  STOIC_GOAL = 'stoic.goal',
  /** Upcoming payments against the projected balance. */
  STOIC_COMMITMENTS = 'stoic.commitments',
  STOIC_SUBSCRIPTIONS = 'stoic.subscriptions',
  /** Earning well, giving little to others. */
  STOIC_GENEROSITY = 'stoic.generosity',
  /** A rule that no longer holds, or a decision worth making into one. */
  STOIC_RULE = 'stoic.rule',
  /** Stoic teaching applied to the user's own numbers, with its source. */
  STOIC_REFLECTION = 'stoic.reflection',
}

export enum InsightCategory {
  PATTERN = 'pattern',
  OPERATIONAL = 'operational',
  TREND = 'trend',
  STOIC = 'stoic',
}

export enum InsightSeverity {
  INFO = 'info',
  WARN = 'warn',
  CRITICAL = 'critical',
}

@Entity('insights')
@Index('IDX_insights_user_active_created', ['userId', 'isDismissed', 'createdAt'])
@Index('IDX_insights_workspace_created', ['workspaceId', 'createdAt'])
export class Insight {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Relation<Workspace>;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'varchar', length: 64 })
  type: InsightType;

  @Column({ type: 'varchar', length: 32 })
  category: InsightCategory;

  @Column({ type: 'varchar', length: 16, default: InsightSeverity.INFO })
  severity: InsightSeverity;

  /** Rendered in the recipient's locale when the insight is written, so
   * existing consumers keep reading plain text. */
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  /** Source of `title`/`message` — kept so the client can re-render the text
   * when the user switches language. Null for insights written before this
   * column existed, and for AI summaries, which are free-form. */
  @Column({ name: 'message_key', type: 'varchar', length: 64, nullable: true })
  messageKey: string | null;

  @Column({ name: 'message_params', type: 'jsonb', nullable: true })
  messageParams: Record<string, string | number> | null;

  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  actions: Array<Record<string, unknown>> | null;

  @Column({ name: 'is_dismissed', type: 'boolean', default: false })
  isDismissed: boolean;

  /** When the person closed it; a refresh brings it back after a week or when its count grows. */
  @Column({ name: 'dismissed_at', type: 'timestamptz', nullable: true })
  dismissedAt: Date | null;

  @Column({ name: 'is_actioned', type: 'boolean', default: false })
  isActioned: boolean;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({
    name: 'deduplication_key',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  deduplicationKey: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
