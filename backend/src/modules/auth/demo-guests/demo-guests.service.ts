import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomBytes, randomUUID } from 'crypto';
import { type DataSource, LessThan, Like, type Repository } from 'typeorm';
import { hashPassword } from '../../../common/utils/password-hash.util';
import { User, UserRole, Workspace } from '../../../entities';
import { DemoWorkspaceService } from '../../workspaces/demo-workspace/demo-workspace.service';
import { AuthService, type SessionContext } from '../auth.service';
import type { AuthResponseDto } from '../dto/auth-response.dto';
import {
  demoGuestsEnabled,
  demoGuestsMax,
  demoGuestTtlMs,
  GUEST_EMAIL_DOMAIN,
} from './demo-guests.config';

const GUEST_EMAILS = Like(`%@${GUEST_EMAIL_DOMAIN}`);

@Injectable()
export class DemoGuestsService {
  private readonly logger = new Logger(DemoGuestsService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly authService: AuthService,
    private readonly demoWorkspaceService: DemoWorkspaceService,
  ) {}

  /**
   * A throwaway account whose only workspace is a demo filled with sample
   * data, signed in at once. Its password is random and never shown, so the
   * session is the only way in; when it ends, the guest is gone for good.
   */
  async create(sessionContext: SessionContext): Promise<AuthResponseDto> {
    if (!demoGuestsEnabled()) {
      throw new NotFoundException();
    }
    const alive = await this.userRepository.count({ where: { email: GUEST_EMAILS } });
    if (alive >= demoGuestsMax()) {
      throw new ServiceUnavailableException();
    }

    const guest = await this.userRepository.save(
      this.userRepository.create({
        email: `guest-${randomUUID()}@${GUEST_EMAIL_DOMAIN}`,
        passwordHash: await hashPassword(randomBytes(32).toString('hex')),
        name: 'Guest',
        role: UserRole.USER,
        isActive: true,
        onboardingCompletedAt: new Date(),
      }),
    );

    try {
      const { workspace } = await this.demoWorkspaceService.getOrCreate(guest.id, 'Demo');
      await this.userRepository.update(guest.id, {
        workspaceId: workspace.id,
        lastWorkspaceId: workspace.id,
      });
      guest.workspaceId = workspace.id;
      guest.lastWorkspaceId = workspace.id;
    } catch (error) {
      await this.userRepository.delete(guest.id);
      throw error;
    }

    return this.authService.generateTokens(guest, sessionContext);
  }

  /**
   * Deletes guests older than the TTL with their workspaces; answers how many
   * went. Each guest goes in its own transaction, so one that cannot be
   * removed is logged and left for the next sweep instead of stopping the rest.
   */
  async removeExpired(now = new Date()): Promise<number> {
    const expired = await this.userRepository.find({
      where: {
        email: GUEST_EMAILS,
        createdAt: LessThan(new Date(now.getTime() - demoGuestTtlMs())),
      },
      select: { id: true },
      withDeleted: true,
    });
    let removed = 0;
    for (const { id } of expired) {
      try {
        await this.dataSource.transaction(async manager => {
          await manager.delete(Workspace, { ownerId: id });
          await manager.delete(User, { id });
        });
        removed += 1;
      } catch (error) {
        this.logger.error(
          `Removing demo guest ${id} failed`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
    if (removed > 0) {
      this.logger.log(`Removed ${removed} expired demo guest(s)`);
    }
    return removed;
  }
}
