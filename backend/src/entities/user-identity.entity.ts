import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { User } from './user.entity';

/**
 * An account at an OpenID Connect provider that signs a user in. Keyed by the
 * provider's issuer and subject, never by e-mail: an address can change hands
 * at the provider, a subject cannot. The e-mail is kept only to show the user
 * which account they linked.
 */
@Entity('user_identities')
@Index('UQ_user_identities_issuer_subject', ['issuer', 'subject'], { unique: true })
@Index('IDX_user_identities_user_id', ['userId'])
export class UserIdentity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 512 })
  issuer: string;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  /** The provider's e-mail when the identity was linked; shown, never used to sign in. */
  @Column({ type: 'varchar', length: 320, nullable: true })
  email: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;
}
