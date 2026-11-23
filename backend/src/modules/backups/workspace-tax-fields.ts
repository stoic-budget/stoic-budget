import type { DataSource } from 'typeorm';
import type { Workspace } from '../../entities/workspace.entity';

/**
 * The ledger, VAT and tax settings of a restored workspace. Older snapshots
 * carry none of these, and the defaults then apply. A jurisdiction is
 * reference data of this server: one it does not know is left unset.
 */
export async function workspaceTaxFields(
  dataSource: DataSource,
  source: Record<string, unknown>,
): Promise<Partial<Pick<Workspace, 'ledgerBaseCurrency' | 'taxJurisdictionId' | 'vatStatus'>>> {
  const fields: Partial<Pick<Workspace, 'ledgerBaseCurrency' | 'taxJurisdictionId' | 'vatStatus'>> =
    {};
  if (typeof source.ledgerBaseCurrency === 'string') {
    fields.ledgerBaseCurrency = source.ledgerBaseCurrency;
  }
  if (typeof source.vatStatus === 'string') {
    fields.vatStatus = source.vatStatus as Workspace['vatStatus'];
  }
  if (typeof source.taxJurisdictionId === 'string') {
    const [known] = await dataSource.query('SELECT 1 FROM "tax_jurisdictions" WHERE "id" = $1', [
      source.taxJurisdictionId,
    ]);
    if (known) fields.taxJurisdictionId = source.taxJurisdictionId;
  }
  return fields;
}
