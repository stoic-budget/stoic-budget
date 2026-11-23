import { VatStatus, vatStatusOn } from '../../../../src/entities/workspace.entity';
import { historyAfterSwitch } from '../../../../src/modules/tax/vat-status-history';

describe('VAT status over time', () => {
  const registeredFromJuly = {
    vatStatus: VatStatus.REGISTERED,
    vatStatusHistory: [{ until: '2026-07-01', status: VatStatus.NOT_REGISTERED }],
  };

  it('assesses a row under the status of its own day', () => {
    expect(vatStatusOn(registeredFromJuly, '2026-06-30')).toBe(VatStatus.NOT_REGISTERED);
    expect(vatStatusOn(registeredFromJuly, '2026-07-01')).toBe(VatStatus.REGISTERED);
    expect(vatStatusOn(registeredFromJuly, new Date('2026-08-15T00:00:00.000Z'))).toBe(VatStatus.REGISTERED);
  });

  it('applies the current status to every day without history', () => {
    expect(vatStatusOn({ vatStatus: VatStatus.REGISTERED, vatStatusHistory: [] }, '2019-01-01')).toBe(
      VatStatus.REGISTERED,
    );
  });

  it('closes what applied the day before on the date of a switch', () => {
    const notRegistered = { vatStatus: VatStatus.NOT_REGISTERED, vatStatusHistory: [] };

    expect(historyAfterSwitch(notRegistered, '2026-07-01')).toEqual([
      { until: '2026-07-01', status: VatStatus.NOT_REGISTERED },
    ]);
  });

  it('keeps earlier spans when the status switches back later', () => {
    expect(historyAfterSwitch(registeredFromJuly, '2027-01-01')).toEqual([
      { until: '2026-07-01', status: VatStatus.NOT_REGISTERED },
      { until: '2027-01-01', status: VatStatus.REGISTERED },
    ]);
  });

  it('drops a span a backdated switch reaches over', () => {
    expect(historyAfterSwitch(registeredFromJuly, '2026-03-01')).toEqual([
      { until: '2026-03-01', status: VatStatus.NOT_REGISTERED },
    ]);
  });

  it('lets a switch without a date cover the whole past', () => {
    expect(historyAfterSwitch(registeredFromJuly, null)).toEqual([]);
  });
});
