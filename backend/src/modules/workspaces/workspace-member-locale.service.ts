import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { WorkspaceMember } from '../../entities';

/** The caller's interface language, kept per workspace so one workspace's choice never leaks into another. */
@Injectable()
export class WorkspaceMemberLocaleService {
  constructor(
    @InjectRepository(WorkspaceMember)
    private readonly memberRepository: Repository<WorkspaceMember>,
  ) {}

  async setLocale(
    workspaceId: string,
    userId: string,
    locale: string,
  ): Promise<{ locale: string }> {
    const result = await this.memberRepository.update({ workspaceId, userId }, { locale });
    if (!result.affected) {
      throw new ForbiddenException(appError('WORKSPACE_NOT_A_MEMBER'));
    }
    return { locale };
  }
}
