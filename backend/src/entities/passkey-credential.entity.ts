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

/** Postgres `bigint` arrives as a string; a sign counter fits a JS number (it is 32 bits). */
const counterTransformer = {
  to: (value: number) => value,
  from: (value: string | number | null) => Number(value ?? 0),
};

/**
 * A WebAuthn credential (passkey) a person registered to sign in with.
 *
 * It belongs to the person, not to a workspace: there is no workspace column, so
 * workspace backups, versions and restores never carry it (they collect only
 * workspace-scoped tables), like the password and the 2FA secret on `users`.
 * Only the public key is stored; the private key never leaves the authenticator.
 */
@Entity('passkey_credentials')
@Index('IDX_passkey_credentials_user_id', ['userId'])
@Index('UQ_passkey_credentials_credential_id', ['credentialId'], { unique: true })
export class PasskeyCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** The authenticator's credential id, base64url. */
  @Column({ name: 'credential_id', type: 'text' })
  credentialId: string;

  /** COSE-encoded public key. */
  @Column({ name: 'public_key', type: 'bytea', select: false })
  publicKey: Buffer;

  /** The authenticator's signature counter; 0 for authenticators that do not keep one. */
  @Column({
    name: 'sign_count',
    type: 'bigint',
    default: 0,
    transformer: counterTransformer,
  })
  signCount: number;

  @Column({ name: 'transports', type: 'text', array: true, default: () => "'{}'" })
  transports: string[];

  @Column({ name: 'backed_up', type: 'boolean', default: false })
  backedUp: boolean;

  @Column({ name: 'device_type', type: 'varchar', length: 16 })
  deviceType: 'singleDevice' | 'multiDevice';

  @Column({ name: 'name', type: 'varchar', length: 60 })
  name: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;
}
