import type { GoalAccount, WalletItem } from '@/app/lib/contracts';

/** An account the goal form can offer. */
export interface FollowableAccount {
  id: string;
  name: string;
  currency: string;
}

/**
 * Whether the goal's progress is an account's balance right now. An archived
 * account hands the goal back to its contributions, so it no longer counts.
 */
export function followsAccount(goal: { account: GoalAccount | null }): boolean {
  return goal.account !== null && goal.account.status !== 'archived';
}

/**
 * The accounts a goal may follow, by the same rule the server applies: active,
 * and shared or the viewer's own. In a workspace of one there is nobody else's
 * account to leave out, so `selfMemberId` is not needed there. The account the
 * goal already follows stays in the list, so the form shows what is saved.
 */
export function followableAccounts(
  accounts: readonly WalletItem[],
  selfMemberId: string | null,
  household: boolean,
  current: GoalAccount | null,
): FollowableAccount[] {
  const allowed = accounts
    .filter(account => account.isActive)
    .filter(
      account =>
        !household || account.ownerMemberId === null || account.ownerMemberId === selfMemberId,
    )
    .map(({ id, name, currency }) => ({ id, name, currency }));
  if (current && !allowed.some(account => account.id === current.id)) {
    allowed.push({ id: current.id, name: current.name, currency: current.currency });
  }
  return allowed;
}

/** Fills `{{name}}` slots; a replacer, so `$&` in an account name stays literal. */
export function fillSlots(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (slot, key: string) => values[key] ?? slot);
}
