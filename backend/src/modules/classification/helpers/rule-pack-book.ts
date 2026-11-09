import type { EntityManager } from 'typeorm';
import { Category, CategorySource, CategoryType } from '../../../entities/category.entity';
import { Payee } from '../../../entities/payee.entity';
import { RuleGroup } from '../../../entities/rule-group.entity';
import { Tag } from '../../../entities/tag.entity';
import { Wallet } from '../../../entities/wallet.entity';
import { WorkspaceMember } from '../../../entities/workspace-member.entity';
import { findOrCreatePayeeByName } from '../../payees/payee-resolution';
import {
  categoryTypeOf,
  type MissingName,
  type NameBook,
  nameKey,
  type PackRule,
  type RefKind,
} from './rule-pack-names';

type Named = { id: string; name: string };

/** Everything of the workspace a rule can point at, with its name, oldest first. */
async function namedRecords(
  manager: EntityManager,
  workspaceId: string,
): Promise<Record<RefKind | 'email', Named[]>> {
  const named = { id: true, name: true } as const;
  const oldestFirst = { createdAt: 'ASC' } as const;
  const [category, tag, payee, account, members] = await Promise.all([
    manager.find(Category, { where: { workspaceId }, select: named, order: oldestFirst }),
    manager.find(Tag, { where: { workspaceId }, select: named, order: oldestFirst }),
    manager.find(Payee, { where: { workspaceId }, select: named, order: oldestFirst }),
    manager.find(Wallet, { where: { workspaceId }, select: named, order: oldestFirst }),
    manager.find(WorkspaceMember, { where: { workspaceId }, relations: { user: true } }),
  ]);
  // A member is named by their name, else by their e-mail address.
  const member = members.map(one => ({
    id: one.id,
    name: one.user?.name?.trim() || one.user?.email || '',
  }));
  const email = members.map(one => ({ id: one.id, name: one.user?.email ?? '' }));
  return { category, tag, payee, account, member, email };
}

/** The workspace's names by id, for an export. */
export async function namesById(manager: EntityManager, workspaceId: string): Promise<NameBook> {
  const records = await namedRecords(manager, workspaceId);
  const book = (rows: Named[]) => new Map(rows.map(row => [row.id, row.name]));
  return {
    category: book(records.category),
    tag: book(records.tag),
    payee: book(records.payee),
    account: book(records.account),
    member: book(records.member),
  };
}

/**
 * The workspace's ids by lower-cased name, for an import. Of two records with
 * one name the older wins. A member is found by their name or their e-mail.
 */
export async function idsByName(
  manager: EntityManager,
  workspaceId: string,
): Promise<Record<RefKind, Map<string, string>>> {
  const records = await namedRecords(manager, workspaceId);
  const book = (rows: Named[]) => {
    const ids = new Map<string, string>();
    for (const row of rows) {
      if (!ids.has(nameKey(row.name))) ids.set(nameKey(row.name), row.id);
    }
    return ids;
  };
  const member = book(records.member);
  for (const [email, id] of book(records.email.filter(one => one.name))) {
    if (!member.has(email)) member.set(email, id);
  }
  return {
    category: book(records.category),
    tag: book(records.tag),
    payee: book(records.payee),
    account: book(records.account),
    member,
  };
}

/**
 * Makes the categories, tags and payees the rules name and the workspace
 * lacks, and adds them to `ids`. Accounts and members are never made.
 * @returns whether a category was made (the category lists are cached).
 */
export async function createMissing(
  manager: EntityManager,
  input: {
    workspaceId: string;
    userId: string;
    ids: Record<RefKind, Map<string, string>>;
    wanted: Array<{ rule: PackRule; missing: MissingName[] }>;
  },
): Promise<boolean> {
  const { workspaceId, userId, ids } = input;
  let madeCategory = false;
  for (const { rule, missing } of input.wanted) {
    for (const { kind, name } of missing) {
      const key = nameKey(name);
      if (ids[kind].has(key) || !name.trim()) {
        continue;
      }
      if (kind === 'category') {
        const type = categoryTypeOf(rule) === 'income' ? CategoryType.INCOME : CategoryType.EXPENSE;
        const category = await manager.save(
          manager.create(Category, {
            userId,
            workspaceId,
            name: name.trim(),
            type,
            isSystem: false,
            source: CategorySource.USER,
          }),
        );
        ids.category.set(key, category.id);
        madeCategory = true;
      } else if (kind === 'tag') {
        const tag = await manager.save(
          manager.create(Tag, { workspaceId, userId, name: name.trim() }),
        );
        ids.tag.set(key, tag.id);
      } else if (kind === 'payee') {
        ids.payee.set(key, (await findOrCreatePayeeByName(manager, workspaceId, name)).id);
      }
    }
  }
  return madeCategory;
}

/** The folders the rules go in by name: the workspace's own of that name, else a new one. */
export async function foldersByName(
  manager: EntityManager,
  workspaceId: string,
  names: ReadonlyArray<string | null | undefined>,
): Promise<Map<string, string>> {
  const groups = await manager.find(RuleGroup, {
    where: { workspaceId },
    order: { position: 'ASC', createdAt: 'ASC' },
  });
  const byName = new Map<string, string>();
  for (const group of groups) {
    if (!byName.has(nameKey(group.name))) byName.set(nameKey(group.name), group.id);
  }
  let position = groups.reduce((last, group) => Math.max(last, group.position), -1);
  for (const raw of names) {
    const name = raw?.trim();
    if (!name || byName.has(nameKey(name))) {
      continue;
    }
    position += 1;
    const group = await manager.save(manager.create(RuleGroup, { workspaceId, name, position }));
    byName.set(nameKey(name), group.id);
  }
  return byName;
}
