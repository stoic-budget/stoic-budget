import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import type { Repository } from 'typeorm';
import { toEnum } from '../../common/effect/to-enum';
import { appError } from '../../common/errors/app-error';
import { hashPassword } from '../../common/utils/password-hash.util';
import { redactPrivateRows } from '../../common/utils/transaction-privacy.util';
import type { CreateSharedLinkBody, UpdateSharedLinkBody } from '../../contracts';
import {
  SharedLink,
  ShareLinkStatus,
  SharePermissionLevel,
  Statement,
  Transaction,
} from '../../entities';
import { StorageAccessService } from './storage-access.service';

/** Links that share a file outside the app, and opening one. */
@Injectable()
export class StorageSharedLinksService {
  constructor(
    @InjectRepository(SharedLink)
    private readonly sharedLinkRepository: Repository<SharedLink>,
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly storageAccess: StorageAccessService,
  ) {}

  /**
   * Create shared link
   */
  async createSharedLink(
    statementId: string,
    userId: string,
    dto: CreateSharedLinkBody,
  ): Promise<SharedLink> {
    // Check if user has permission to share
    await this.storageAccess.checkFileAccess(userId, statementId, 'share');
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
      select: {
        id: true,
        deletedAt: true,
      },
    });
    if (!statement) {
      throw new NotFoundException(appError('STORAGE_FILE_NOT_FOUND'));
    }
    if (statement.deletedAt) {
      throw new BadRequestException(appError('STORAGE_FILE_IN_TRASH'));
    }

    // Generate unique token
    const token = this.generateShareToken();

    // Hash password if provided
    const hashedPassword = dto.password ? await hashPassword(dto.password) : null;

    const sharedLink = this.sharedLinkRepository.create({
      statementId,
      userId,
      token,
      permission: toEnum(SharePermissionLevel, dto.permission),
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      password: hashedPassword,
      allowAnonymous: dto.allowAnonymous ?? true,
      description: dto.description,
      status: ShareLinkStatus.ACTIVE,
    });

    return await this.sharedLinkRepository.save(sharedLink);
  }

  /**
   * Get shared links for a statement
   */
  async getSharedLinks(statementId: string, userId: string) {
    // Check if user has access to view shared links
    await this.storageAccess.checkFileAccess(userId, statementId, 'view');

    const links = await this.sharedLinkRepository.find({
      where: { statementId },
      order: { createdAt: 'DESC' },
    });

    return links.map(link => ({
      ...link,
      // Don't expose password hash
      password: link.password ? '******' : null,
    }));
  }

  /**
   * Update shared link
   */
  async updateSharedLink(
    linkId: string,
    userId: string,
    dto: UpdateSharedLinkBody,
  ): Promise<SharedLink> {
    const link = await this.sharedLinkRepository.findOne({
      where: { id: linkId },
    });

    if (!link) {
      throw new NotFoundException(appError('STORAGE_SHARED_LINK_NOT_FOUND'));
    }

    // Check if user is owner
    await this.storageAccess.checkFileAccess(userId, link.statementId, 'share');

    // Update fields
    if (dto.permission != null) {
      link.permission = toEnum(SharePermissionLevel, dto.permission);
    }
    if (dto.expiresAt !== undefined) {
      link.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }
    if (dto.password !== undefined) {
      link.password = dto.password ? await hashPassword(dto.password) : null;
    }
    if (dto.status != null) {
      link.status = toEnum(ShareLinkStatus, dto.status);
    }
    if (dto.allowAnonymous != null) {
      link.allowAnonymous = dto.allowAnonymous;
    }
    if (dto.description !== undefined) {
      link.description = dto.description;
    }

    return await this.sharedLinkRepository.save(link);
  }

  /**
   * Delete shared link
   */
  async deleteSharedLink(linkId: string, userId: string): Promise<void> {
    const link = await this.sharedLinkRepository.findOne({
      where: { id: linkId },
    });

    if (!link) {
      throw new NotFoundException(appError('STORAGE_SHARED_LINK_NOT_FOUND'));
    }

    // Check if user is owner
    await this.storageAccess.checkFileAccess(userId, link.statementId, 'share');

    await this.sharedLinkRepository.remove(link);
  }

  /**
   * Access shared link (public endpoint)
   */
  async accessSharedLink(token: string, password?: string) {
    const link = await this.sharedLinkRepository.findOne({
      where: { token },
      relations: {
        statement: {
          category: true,
        },
      },
    });

    if (!link) {
      throw new NotFoundException(appError('STORAGE_SHARED_LINK_NOT_FOUND'));
    }

    // Check if link is active
    if (link.status !== ShareLinkStatus.ACTIVE) {
      throw new ForbiddenException(appError('STORAGE_SHARED_LINK_INACTIVE'));
    }

    // Check if link is expired
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      // Auto-expire the link
      link.status = ShareLinkStatus.EXPIRED;
      await this.sharedLinkRepository.save(link);
      throw new ForbiddenException(appError('STORAGE_SHARED_LINK_EXPIRED'));
    }

    if (link.allowAnonymous === false) {
      throw new ForbiddenException(appError('STORAGE_SHARED_LINK_AUTH_REQUIRED'));
    }

    // Check password if required
    if (link.password) {
      if (!password) {
        throw new UnauthorizedException(appError('STORAGE_PASSWORD_REQUIRED'));
      }
      const isValid = await bcrypt.compare(password, link.password);
      if (!isValid) {
        throw new UnauthorizedException(appError('STORAGE_PASSWORD_INVALID'));
      }
    }

    // Update access count and last accessed
    link.accessCount += 1;
    link.lastAccessedAt = new Date();
    await this.sharedLinkRepository.save(link);

    // Get transactions if permission allows
    let transactions: Transaction[] = [];
    if (link.permission !== SharePermissionLevel.VIEW) {
      transactions = await this.transactionRepository.find({
        where: { statementId: link.statement.id },
        order: { transactionDate: 'DESC' },
        relations: {
          category: true,
          branch: true,
          wallet: true,
        },
      });
      // Whoever holds the link is nobody's member: every private row stays hidden.
      redactPrivateRows(transactions, null);
    }

    return {
      statement: link.statement,
      transactions,
      permission: link.permission,
      canDownload: [SharePermissionLevel.DOWNLOAD, SharePermissionLevel.EDIT].includes(
        link.permission,
      ),
    };
  }

  /**
   * Generate unique share token
   */
  private generateShareToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
