import { VatStatus } from '../../../../src/entities/workspace.entity';
import { restoredTaxFields } from '../../../../src/modules/backups/restored-tax-fields';

describe('restoredTaxFields', () => {
  it('takes the VAT status history with the status, so a copy keeps the past as it was', () => {
    const history = [{ until: '2026-07-01', status: VatStatus.REGISTERED }];

    expect(
      restoredTaxFields({ vatStatus: 'not_registered', vatStatusHistory: history, taxJurisdictionId: 'jur-1' }),
    ).toEqual({ vatStatus: 'not_registered', vatStatusHistory: history, taxJurisdictionId: 'jur-1' });
  });

  it('leaves the defaults to an older snapshot that has none of them', () => {
    expect(restoredTaxFields({ name: 'Household' })).toEqual({});
  });
});
