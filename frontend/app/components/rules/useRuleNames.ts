'use client';

import { usePayeeNames } from '@/app/components/payees/usePayees';
import { useWorkspaceMembers } from '@/app/components/transactions/hooks/useWorkspaceMembers';
import { OWNER_SHARED } from '@/app/components/transactions/OwnerFilterDropdown';
import { useTags } from '@/app/hooks/useTags';
import { useCategoryName } from '@/app/lib/use-category-name';
import type { RuleNames } from './rule-text';
import { useRuleTargets } from './useRules';
import { useRuleWords } from './useRuleWords';

/**
 * What a rule can name, loaded once for the list and the editor: categories,
 * accounts, members and tags, plus the lookups that show an id by its name.
 * `payeeIds` are the payees the rules on screen give their rows.
 */
export function useRuleNames(payeeIds: readonly string[] = []) {
  const words = useRuleWords();
  const payeeName = usePayeeNames(payeeIds);
  const categoryName = useCategoryName();
  const members = useWorkspaceMembers();
  const { categories, wallets } = useRuleTargets();
  const tags = useTags().data ?? [];

  const names: RuleNames = {
    category: id => {
      const category = categories.find(candidate => candidate.id === id);
      return category ? categoryName(category.name) : null;
    },
    wallet: id => wallets.find(wallet => wallet.id === id)?.name ?? null,
    owner: memberId =>
      memberId === OWNER_SHARED
        ? words.shared
        : (members.find(member => member.memberId === memberId)?.label ?? null),
    tag: id => tags.find(tag => tag.id === id)?.name ?? null,
    payee: payeeName,
  };
  return { words, names, categories, wallets, members, tags };
}
