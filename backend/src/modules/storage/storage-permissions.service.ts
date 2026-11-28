import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { toEnum } from '../../common/effect/to-enum';
import { appError } from '../../common/errors/app-error';
import type { GrantPermissionBody, UpdatePermissionBody } from '../../contracts';
import { FilePermission, FilePermissionType, Statement, WorkspaceMember } from '../../entities';
import { StorageAccessService } from './storage-access.service';

/** Grants on one file to a member of its workspace. */
@Injectable()
export class StoragePermissionsService {
  constructor(
    @InjectRepository(FilePermission)
    private readonly filePermissionRepository: Repository<FilePermission>,
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    private readonly storageAccess: StorageAccessService,
  ) {}

  /**
   * Grant permission to user
   */
  async grantPermission(
    statementId: string,
    grantedById: string,
    dto: GrantPermissionBody,
  ): Promise<FilePermission> {
    // Check if granter has permission to share
    await this.storageAccess.checkFileAccess(grantedById, statementId, 'share');

    // dto.userId is an arbitrary id from the request body: without this the
    // file could be shared with any account in the system, in any tenant.
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
      select: {
        id: true,
        workspaceId: true,
      },
    });
    if (!statement) {
      throw new NotFoundException(appError('STORAGE_FILE_NOT_FOUND'));
    }

    // The dialog takes a user id or the email a member signs in with.
    const granteeMembership = await this.workspaceMemberRepository.findOne({
      where: dto.userId.includes('@')
        ? { workspaceId: statement.workspaceId, user: { email: dto.userId.trim().toLowerCase() } }
        : { workspaceId: statement.workspaceId, userId: dto.userId },
    });
    if (!granteeMembership) {
      throw new NotFoundException(appError('STORAGE_USER_NOT_IN_WORKSPACE'));
    }
    const granteeId = granteeMembership.userId;

    // Check if permission already exists
    const existing = await this.filePermissionRepository.findOne({
      where: { statementId, userId: granteeId },
    });

    if (existing) {
      throw new BadRequestException(appError('STORAGE_PERMISSION_EXISTS'));
    }

    const permission = this.filePermissionRepository.create({
      statementId,
      userId: granteeId,
      grantedById,
      permissionType: toEnum(FilePermissionType, dto.permissionType),
      canReshare: dto.canReshare ?? false,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      isActive: true,
    });

    return await this.filePermissionRepository.save(permission);
  }

  /**
   * Get permissions for a statement
   */
  async getFilePermissions(statementId: string, userId: string) {
    // Check if user has access
    await this.storageAccess.checkFileAccess(userId, statementId, 'view');

    return await this.filePermissionRepository.find({
      where: { statementId },
      relations: {
        user: true,
        grantedBy: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Update permission
   */
  async updatePermission(
    permissionId: string,
    userId: string,
    dto: UpdatePermissionBody,
  ): Promise<FilePermission> {
    const permission = await this.filePermissionRepository.findOne({
      where: { id: permissionId },
    });

    if (!permission) {
      throw new NotFoundException(appError('STORAGE_PERMISSION_NOT_FOUND'));
    }

    // Check if user is owner or granted the permission
    await this.storageAccess.checkFileAccess(userId, permission.statementId, 'share');

    // Update fields
    if (dto.permissionType != null) {
      permission.permissionType = toEnum(FilePermissionType, dto.permissionType);
    }
    if (dto.canReshare != null) {
      permission.canReshare = dto.canReshare;
    }
    if (dto.expiresAt !== undefined) {
      permission.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }
    if (dto.isActive != null) {
      permission.isActive = dto.isActive;
    }

    return await this.filePermissionRepository.save(permission);
  }

  /**
   * Revoke permission
   */
  async revokePermission(permissionId: string, userId: string): Promise<void> {
    const permission = await this.filePermissionRepository.findOne({
      where: { id: permissionId },
    });

    if (!permission) {
      throw new NotFoundException(appError('STORAGE_PERMISSION_NOT_FOUND'));
    }

    // Check if user is owner or granted the permission
    await this.storageAccess.checkFileAccess(userId, permission.statementId, 'share');

    await this.filePermissionRepository.remove(permission);
  }
}
