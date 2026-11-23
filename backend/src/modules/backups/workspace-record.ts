import type { DataSource } from 'typeorm';
import { VatStatus, type Workspace } from '../../entities/workspace.entity';

type RestoredField =
  | 'ledgerBaseCurrency'
  | 'taxJurisdictionId'
  | 'vatStatus'
  | 'backgroundAttribution'
  | 'backgroundSourceUrl';

/**
 * The ledger, VAT and tax settings and the background credit of a restored workspace. Older snapshots
 * carry none of these, and the defaults then apply. A jurisdiction is
 * reference data of this server: one it does not know is left unset.
 */
export async function workspaceTaxFields(
  dataSource: DataSource,
  source: Record<string, unknown>,
): Promise<Partial<Pick<Workspace, RestoredField>>> {
  const fields: Partial<Pick<Workspace, RestoredField>> = {};
  // A credited picture is not shown without its credit.
  for (const key of ['backgroundAttribution', 'backgroundSourceUrl'] as const) {
    const value = source[key];
    if (typeof value === 'string') fields[key] = value;
  }
  // A crafted archive's values are checked as the app would write them.
  const ledgerCurrency = String(source.ledgerBaseCurrency ?? '').toUpperCase();
  if (/^[A-Z]{3}$/.test(ledgerCurrency)) {
    fields.ledgerBaseCurrency = ledgerCurrency;
  }
  const vatStatus = Object.values(VatStatus).find(value => value === source.vatStatus);
  if (vatStatus) {
    fields.vatStatus = vatStatus;
  }
  if (typeof source.taxJurisdictionId === 'string') {
    const [known] = await dataSource.query('SELECT 1 FROM "tax_jurisdictions" WHERE "id" = $1', [
      source.taxJurisdictionId,
    ]);
    if (known) fields.taxJurisdictionId = source.taxJurisdictionId;
  }
  return fields;
}

/**
 * What a restore needs of the workspace row itself, beside its tables: the one
 * list a backup and a workspace version both write, so they cannot drift.
 */
export function workspaceRecord(workspace: Workspace): Record<string, unknown> {
  return {
    id: workspace.id,
    name: workspace.name,
    description: workspace.description,
    icon: workspace.icon,
    color: workspace.color,
    backgroundImage: workspace.backgroundImage,
    // A credited picture is not shown without its credit.
    backgroundAttribution: workspace.backgroundAttribution,
    backgroundSourceUrl: workspace.backgroundSourceUrl,
    currency: workspace.currency,
    settings: workspace.settings,
    ledgerBaseCurrency: workspace.ledgerBaseCurrency,
    taxJurisdictionId: workspace.taxJurisdictionId,
    vatStatus: workspace.vatStatus,
  };
}
