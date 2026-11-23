import { type VatStatusSpan, vatStatusOn, type Workspace } from '../../entities/workspace.entity';

/**
 * The history after a switch to a new status from `from` ('YYYY-MM-DD'): the
 * spans that ended before it stay, and whatever applied the day before closes
 * on it. Without a date the new status covers the whole past, as it always
 * did: no history.
 */
export function historyAfterSwitch(
  workspace: Pick<Workspace, 'vatStatus' | 'vatStatusHistory'>,
  from: string | null | undefined,
): VatStatusSpan[] {
  if (!from) return [];
  const dayBefore = new Date(`${from}T00:00:00.000Z`);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  const earlier = (workspace.vatStatusHistory ?? []).filter(span => span.until < from);
  return [...earlier, { until: from, status: vatStatusOn(workspace, dayBefore) }];
}
