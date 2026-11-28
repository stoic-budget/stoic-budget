import type { Workspace } from '../../entities/workspace.entity';

/**
 * The tax settings a restored workspace takes from its snapshot. Older
 * snapshots carry none of them; the column defaults then apply. The VAT status
 * history goes with the status: without it a reassessment in the copy would
 * tax the whole past under today's status.
 */
export function restoredTaxFields(
  source: Record<string, unknown>,
): Partial<Pick<Workspace, 'taxJurisdictionId' | 'vatStatus' | 'vatStatusHistory'>> {
  return {
    ...(typeof source.taxJurisdictionId === 'string'
      ? { taxJurisdictionId: source.taxJurisdictionId }
      : {}),
    ...(typeof source.vatStatus === 'string'
      ? { vatStatus: source.vatStatus as Workspace['vatStatus'] }
      : {}),
    ...(Array.isArray(source.vatStatusHistory)
      ? { vatStatusHistory: source.vatStatusHistory as Workspace['vatStatusHistory'] }
      : {}),
  };
}
