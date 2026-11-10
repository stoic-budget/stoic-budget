import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { type EntityManager, In, type Repository } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import { canReadPrivate } from '../../../common/utils/transaction-privacy.util';
import type {
  RulePack,
  RulePackImportResult,
  RulePackPreview,
} from '../../../contracts/classification/rule-packs';
import { ActorType, AuditAction, EntityType } from '../../../entities/audit-event.entity';
import { CategorizationRule } from '../../../entities/categorization-rule.entity';
import { RuleGroup } from '../../../entities/rule-group.entity';
import { AuditService } from '../../audit/audit.service';
import { rowsMatching } from '../engine/rule-apply-plan';
import { conditionsUse } from '../engine/rule-condition-tree';
import { rowTagIds } from '../engine/rule-tags';
import { toRuleAuditSnapshot } from '../helpers/rule-audit';
import { createMissing, foldersByName, idsByName, namesById } from '../helpers/rule-pack-book';
import {
  type NameBook,
  nameKey,
  type PackRule,
  type ResolvedPackRule,
  resolvePackRule,
  toPackRule,
} from '../helpers/rule-pack-names';
import { assertConditionsValid } from '../helpers/rule-validation';
import { RuleApplicationService } from './rule-application.service';

/** What importing one pack rule comes to. */
interface PlannedRule {
  rule: PackRule;
  resolved: ResolvedPackRule;
  invalid: boolean;
  exists: boolean;
  outcome: 'create' | 'skip';
}

/** Whether the conditions, in this workspace's ids, could ever hold. */
function conditionsHold(resolved: ResolvedPackRule): boolean {
  try {
    assertConditionsValid(resolved.conditions);
    return true;
  } catch {
    return false;
  }
}

/** The lower-cased names of the workspace's rules. */
async function ruleNames(manager: EntityManager, workspaceId: string): Promise<Set<string>> {
  const rules = await manager.find(CategorizationRule, {
    where: { workspaceId },
    select: { id: true, name: true },
  });
  return new Set(rules.map(rule => nameKey(rule.name)));
}

/**
 * A rule left out of an import: its conditions cannot hold, it names an
 * account or a member the workspace lacks, or a category, tag or payee that
 * is not to be made, or a rule of its name is already there (the same pack
 * imported again would otherwise double every rule, and every notification).
 */
function plan(
  pack: RulePack,
  ids: NameBook,
  makeMissing: boolean,
  existing: ReadonlySet<string>,
): PlannedRule[] {
  return pack.rules.map(rule => {
    const resolved = resolvePackRule(rule, ids);
    const invalid = !conditionsHold(resolved);
    const exists = existing.has(nameKey(rule.name));
    const blocked = resolved.missing.some(name => !(name.creatable && makeMissing));
    const outcome = invalid || exists || blocked ? 'skip' : 'create';
    return { rule, resolved, invalid, exists, outcome };
  });
}

/**
 * Rule packs: a workspace's rules as a versioned file that names categories,
 * tags, accounts, payees and members, and that file read back into another
 * workspace. An import is previewed first and writes nothing until confirmed.
 */
@Injectable()
export class RulePackService {
  constructor(
    @InjectRepository(CategorizationRule)
    private readonly ruleRepository: Repository<CategorizationRule>,
    private readonly ruleApplication: RuleApplicationService,
    private readonly auditService: AuditService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  private get manager() {
    return this.ruleRepository.manager;
  }

  /** The rules asked for, in their order (best first). Each must be this workspace's. */
  async export(workspaceId: string, ruleIds: readonly string[]): Promise<RulePack> {
    const [rules, groups, names] = await Promise.all([
      this.ruleRepository.find({
        where: { workspaceId, id: In([...ruleIds]) },
        order: { priority: 'DESC', createdAt: 'DESC' },
      }),
      this.manager.find(RuleGroup, { where: { workspaceId } }),
      namesById(this.manager, workspaceId),
    ]);
    if (rules.length !== new Set(ruleIds).size) {
      throw new NotFoundException(appError('CATEGORIZATION_RULE_NOT_FOUND'));
    }
    const folderOf = new Map(groups.map(group => [group.id, group.name]));
    return {
      kind: 'categorization-rules',
      version: 1,
      exportedAt: new Date().toISOString(),
      rules: rules.map(rule =>
        toPackRule(rule, names, rule.groupId ? (folderOf.get(rule.groupId) ?? null) : null),
      ),
    };
  }

  /**
   * What an import would do, rule by rule, and how many of the workspace's
   * rows each rule matches today among those the viewer may read. Writes nothing.
   */
  async preview(input: {
    workspaceId: string;
    viewerMemberId: string | null;
    pack: RulePack;
    createMissing: boolean;
  }): Promise<RulePackPreview> {
    const { workspaceId, viewerMemberId, pack } = input;
    const [ids, existing] = await Promise.all([
      idsByName(this.manager, workspaceId),
      ruleNames(this.manager, workspaceId),
    ]);
    const planned = plan(pack, ids, input.createMissing, existing);
    const { rows, truncated } = await this.ruleApplication.rowsForRule(workspaceId);
    const readable = rows.filter(row => canReadPrivate(row, viewerMemberId));
    const tagIds = conditionsUse(
      planned.map(item => item.resolved),
      'tags',
    )
      ? await rowTagIds(
          this.manager,
          workspaceId,
          readable.map(row => row.id),
        )
      : undefined;
    const groups = await this.manager.find(RuleGroup, { where: { workspaceId } });
    const known = new Set(groups.map(group => nameKey(group.name)));
    const newFolders = new Map<string, string>();
    for (const item of planned) {
      const folder = item.rule.folder?.trim();
      if (item.outcome === 'create' && folder && !known.has(nameKey(folder))) {
        newFolders.set(nameKey(folder), folder);
      }
    }
    return {
      rules: planned.map(item => ({
        name: item.rule.name,
        folder: item.rule.folder?.trim() || null,
        outcome: item.outcome,
        missing: item.resolved.missing,
        invalid: item.invalid,
        exists: item.exists,
        matches: item.invalid
          ? 0
          : rowsMatching(readable, item.resolved, { viewerMemberId, tagIds }).length,
      })),
      newFolders: [...newFolders.values()],
      truncated,
    };
  }

  /**
   * Makes the pack's rules that can be made, below the workspace's own (a rule
   * already there keeps winning its rows), in the pack's order, with the
   * missing categories, tags and payees when asked, and the folders they
   * name. Rows already booked are left as they are: applying is a separate step.
   */
  async import(input: {
    workspaceId: string;
    userId: string;
    pack: RulePack;
    createMissing: boolean;
  }): Promise<RulePackImportResult> {
    const { workspaceId, userId, pack } = input;
    const { created, madeCategory } = await this.manager.transaction(async manager => {
      const ids = await idsByName(manager, workspaceId);
      const existing = await ruleNames(manager, workspaceId);
      const wanted = plan(pack, ids, input.createMissing, existing)
        .filter(item => item.outcome === 'create')
        .map(({ rule, resolved }) => ({ rule, missing: resolved.missing }));
      const madeCategory = await createMissing(manager, { workspaceId, userId, ids, wanted });
      const folders = await foldersByName(
        manager,
        workspaceId,
        wanted.map(item => item.rule.folder),
      );
      const lowest = await manager.findOne(CategorizationRule, {
        select: { id: true, priority: true },
        where: { workspaceId },
        order: { priority: 'ASC' },
      });
      const below = lowest ? lowest.priority - 1 : 0;
      const rules = wanted.map(({ rule }, index) => {
        // Resolved again: the names just made have ids now.
        const resolved = resolvePackRule(rule, ids);
        const folder = rule.folder?.trim();
        return manager.create(CategorizationRule, {
          userId,
          workspaceId,
          name: rule.name,
          description: rule.description ?? null,
          conditions: resolved.conditions,
          matchMode: resolved.matchMode,
          result: resolved.result,
          priority: below - index,
          isActive: rule.isActive,
          groupId: folder ? (folders.get(nameKey(folder)) ?? null) : null,
          matchCount: 0,
          lastMatchedAt: null,
        });
      });
      return { created: await manager.save(rules), madeCategory };
    });
    if (madeCategory) {
      await this.cacheManager.del(`categories:${workspaceId}:all`);
      await this.cacheManager.del(`categories:${workspaceId}:income`);
      await this.cacheManager.del(`categories:${workspaceId}:expense`);
    }
    if (created.length > 0) {
      await this.auditService.createBatchEvents(
        created.map(rule => ({
          workspaceId,
          actorType: ActorType.USER,
          actorId: userId,
          entityType: EntityType.RULE,
          entityId: rule.id,
          action: AuditAction.CREATE,
          diff: { before: null, after: toRuleAuditSnapshot(rule) },
          meta: { source: 'rule-pack' },
        })),
      );
    }
    return { created: created.length, skipped: pack.rules.length - created.length };
  }
}
