import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import { RuleGroup } from '../../../entities/rule-group.entity';

/**
 * The folders of the rules page. They group rules for reading only: a rule
 * keeps its place in the one global order whatever folder it is in, and
 * deleting a folder leaves its rules where they were, outside any folder.
 */
@Injectable()
export class RuleGroupsService {
  constructor(
    @InjectRepository(RuleGroup)
    private readonly groupRepository: Repository<RuleGroup>,
  ) {}

  list(workspaceId: string): Promise<RuleGroup[]> {
    return this.groupRepository.find({
      where: { workspaceId },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
  }

  /** A new folder goes after the others. */
  async create(workspaceId: string, name: string): Promise<RuleGroup> {
    const last = await this.groupRepository.findOne({
      select: { id: true, position: true },
      where: { workspaceId },
      order: { position: 'DESC' },
    });
    return this.groupRepository.save(
      this.groupRepository.create({
        workspaceId,
        name: name.trim(),
        position: last ? last.position + 1 : 0,
      }),
    );
  }

  async rename(workspaceId: string, id: string, name: string): Promise<RuleGroup> {
    const group = await this.find(workspaceId, id);
    group.name = name.trim();
    return this.groupRepository.save(group);
  }

  /** The rules inside move out of every folder (the key is ON DELETE SET NULL). */
  async remove(workspaceId: string, id: string): Promise<void> {
    const group = await this.find(workspaceId, id);
    await this.groupRepository.delete({ id: group.id, workspaceId });
  }

  private async find(workspaceId: string, id: string): Promise<RuleGroup> {
    const group = await this.groupRepository.findOne({ where: { id, workspaceId } });
    if (!group) {
      throw new NotFoundException(appError('CATEGORIZATION_RULE_GROUP_NOT_FOUND'));
    }
    return group;
  }
}
