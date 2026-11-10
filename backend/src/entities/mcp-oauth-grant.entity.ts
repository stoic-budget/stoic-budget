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
import { McpOAuthClient } from './mcp-oauth-client.entity';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';
import { WorkspaceMember, type WorkspaceRole } from './workspace-member.entity';

export type McpOAuthRevokeReason =
  | 'user'
  | 'client'
  | 'refresh_reuse'
  | 'code_reuse'
  | 'role_changed'
  /** The account's password was reset: every app it connected goes, in every workspace. */
  | 'password_reset'
  /** Someone who manages the workspace's MCP access disconnected another member's app. */
  | 'admin';

/**
 * What one person let one MCP client do in one workspace. It hangs off their
 * membership: removed from the workspace, or the workspace gone, it goes too.
 * Revoking it stops every token issued under it.
 */
@Entity('mcp_oauth_grants')
@Index('IDX_mcp_oauth_grants_workspace_user', ['workspaceId', 'userId'])
@Index('IDX_mcp_oauth_grants_client', ['clientId'])
@Index('IDX_mcp_oauth_grants_member', ['workspaceMemberId'])
export class McpOAuthGrant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => McpOAuthClient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Relation<McpOAuthClient>;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Relation<Workspace>;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => WorkspaceMember, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_member_id' })
  workspaceMember: Relation<WorkspaceMember>;

  @Column({ name: 'workspace_member_id', type: 'uuid' })
  workspaceMemberId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** The role the person had when they approved; any other role stops the grant. */
  @Column({ name: 'granted_role', type: 'varchar', length: 16 })
  grantedRole: WorkspaceRole;

  /** Permission strings, never more than `grantedRole` allowed at approval. */
  @Column({ type: 'jsonb' })
  scopes: string[];

  /** The MCP endpoint URL the tokens are bound to (RFC 8707). */
  @Column({ type: 'text' })
  resource: string;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ name: 'revoked_reason', type: 'varchar', length: 32, nullable: true })
  revokedReason: McpOAuthRevokeReason | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
