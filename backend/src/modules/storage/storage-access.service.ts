import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { workspaceMemberCanEdit } from '../../common/authz/workspace-permissions';
import { appError } from '../../common/errors/app-error';
import {
  FilePermission,
  FilePermissionType,
  Statement,
  WorkspaceMember,
  WorkspaceRole,
} from '../../entities';

export type StorageAction = 'view' | 'download' | 'edit' | 'share';

/**
 * Who may view, download, edit or share a stored file: membership in the
 * file's own workspace first, then an explicit grant on the file.
 */
@Injectable()
export class StorageAccessService {
  constructor(
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(FilePermission)
    private readonly filePermissionRepository: Repository<FilePermission>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
  ) {}

  /** The caller's membership in a file's own workspace, the anchor for access to it. */
  findMembership(workspaceId: string, userId: string) {
    return this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId },
      select: {
        id: true,
        role: true,
        permissions: true,
      },
    });
  }

  /**
   * Check if user has specific access to a file
   */
  async checkFileAccess(
    userId: string,
    statementId: string,
    requiredAction: 'view' | 'download' | 'edit' | 'share',
  ): Promise<void> {
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
      relations: {
        user: true,
      },
    });

    if (!statement) {
      throw new NotFoundException(appError('STORAGE_FILE_NOT_FOUND'));
    }

    // Access follows membership in the file's own workspace, whichever
    // workspace the caller registered with.
    const membership = await this.findMembership(statement.workspaceId, userId);

    // Uploading the file does not outrank the role: a viewer who dropped a
    // statement in still only reads it. Nor does it outlast the membership: an
    // uploader who left the workspace is just anyone, down to an explicit grant.
    if (statement.userId === userId && membership) {
      if (
        requiredAction === 'edit' &&
        !workspaceMemberCanEdit(membership.role, 'canEditStatements', membership.permissions)
      ) {
        throw new ForbiddenException(appError('STATEMENTS_EDIT_FORBIDDEN'));
      }
      if (
        requiredAction === 'share' &&
        !workspaceMemberCanEdit(membership.role, 'canShareFiles', membership.permissions)
      ) {
        throw new ForbiddenException(appError('SHARING_FORBIDDEN'));
      }
      return;
    }

    // Workspace members: allow view/download; admins/owners can edit/share
    if (membership) {
      if (requiredAction === 'view' || requiredAction === 'download') {
        return;
      }

      const canManage =
        membership && [WorkspaceRole.ADMIN, WorkspaceRole.OWNER].includes(membership.role);

      if (requiredAction === 'edit' && canManage) {
        return;
      }

      if (requiredAction === 'share' && canManage) {
        return;
      }
    }

    // Check file permissions
    const permission = await this.getUserPermissionForStatement(userId, statementId);

    if (!permission?.isActive) {
      throw new ForbiddenException(appError('STORAGE_ACCESS_DENIED'));
    }

    // Check if permission is expired
    if (permission.expiresAt && new Date(permission.expiresAt) < new Date()) {
      throw new ForbiddenException(appError('STORAGE_PERMISSION_EXPIRED'));
    }

    // Check action permission
    const hasPermission = this.checkActionPermission(
      permission.permissionType,
      requiredAction,
      permission.canReshare,
    );

    if (!hasPermission) {
      throw new ForbiddenException(appError('STORAGE_ACTION_DENIED', { action: requiredAction }));
    }
  }

  /**
   * Get user permission for a statement
   */
  async getUserPermissionForStatement(
    userId: string,
    statementId: string,
  ): Promise<FilePermission | null> {
    return await this.filePermissionRepository.findOne({
      where: {
        userId,
        statementId,
        isActive: true,
      },
    });
  }

  /**
   * Check if permission type allows specific action
   */
  private checkActionPermission(
    permissionType: FilePermissionType,
    action: 'view' | 'download' | 'edit' | 'share',
    canReshare: boolean,
  ): boolean {
    switch (action) {
      case 'view':
        return [
          FilePermissionType.OWNER,
          FilePermissionType.EDITOR,
          FilePermissionType.VIEWER,
          FilePermissionType.DOWNLOADER,
        ].includes(permissionType);
      case 'download':
        return [
          FilePermissionType.OWNER,
          FilePermissionType.EDITOR,
          FilePermissionType.DOWNLOADER,
        ].includes(permissionType);
      case 'edit':
        return [FilePermissionType.OWNER, FilePermissionType.EDITOR].includes(permissionType);
      case 'share':
        return permissionType === FilePermissionType.OWNER || canReshare;
      default:
        return false;
    }
  }
}
