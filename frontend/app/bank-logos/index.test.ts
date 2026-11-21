import { describe, expect, it } from 'vitest';
import { listSupportedBanks, resolveBankLogo } from './index';

describe('listSupportedBanks', () => {
  it('lists every bank with a parser of its own, Bereke once and no placeholder', () => {
    const banks = listSupportedBanks();

    expect(banks).toHaveLength(119);
    expect(banks.map(bank => bank.key)).not.toContain('other');
    expect(new Set(banks.map(bank => bank.key)).size).toBe(banks.length);
  });

  it('sorts the banks by name', () => {
    const names = listSupportedBanks().map(bank => bank.displayName);

    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('gives each bank the same logo and name as resolving it by key', () => {
    for (const bank of listSupportedBanks()) {
      expect(resolveBankLogo(bank.key)).toEqual(bank);
    }
  });
});

describe('resolveBankLogo', () => {
  it.each([
    ['kaspi', 'Kaspi'],
    ['bereke_new', 'Bereke'],
    ['hapoalim', 'Bank Hapoalim'],
    ['absa', 'Absa Bank'],
    ['ally', 'Ally Bank'],
    ['anz', 'ANZ'],
    ['associated', 'Associated Bank'],
    ['atb', 'ATB Financial'],
    ['axis', 'Axis Bank'],
    ['banco_do_brasil', 'Banco do Brasil'],
    ['bank_of_china', 'Bank of China (Hong Kong)'],
    ['bank_of_scotland', 'Bank of Scotland'],
    ['barclays', 'Barclays'],
    ['becu', 'BECU'],
    ['bendigo', 'Bendigo Bank'],
    ['bmo', 'BMO'],
    ['bnp_paribas', 'BNP Paribas'],
    ['boq', 'BOQ'],
    ['bpi', 'BPI'],
    ['capital_one', 'Capital One'],
    ['capitec', 'Capitec'],
    ['cash_app', 'Cash App'],
    ['schwab', 'Charles Schwab'],
    ['chase', 'Chase'],
    ['chime', 'Chime'],
    ['cibc', 'CIBC'],
    ['citi', 'Citi'],
    ['citizens', 'Citizens'],
    ['coast_capital', 'Coast Capital'],
    ['comerica', 'Comerica'],
    ['commbank', 'CommBank'],
    ['commerce_bank', 'Commerce Bank'],
    ['commercial_bank', 'Commercial Bank'],
    ['credit_agricole', 'Crédit Agricole'],
    ['credit_one', 'Credit One'],
    ['dcu', 'DCU'],
    ['bank_of_america', 'Bank of America'],
    ['desjardins', 'Desjardins'],
    ['deutsche_bank', 'Deutsche Bank'],
    ['discover', 'Discover'],
    ['eq_bank', 'EQ Bank'],
    ['fidelity_bank', 'Fidelity Bank'],
    ['fifth_third', 'Fifth Third'],
    ['first_citizens', 'First Citizens'],
    ['first_direct', 'first direct'],
    ['fnb', 'FNB'],
    ['found', 'Found'],
    ['frost', 'Frost Bank'],
    ['go2bank', 'GO2bank'],
    ['gotyme', 'GoTyme Bank'],
    ['great_southern', 'Great Southern Bank'],
    ['green_dot', 'Green Dot'],
    ['halifax', 'Halifax'],
    ['handelsbanken', 'Handelsbanken'],
    ['hdfc', 'HDFC Bank'],
    ['heritage', 'Heritage Bank'],
    ['hsa_bank', 'HSA Bank'],
    ['hsbc', 'HSBC'],
    ['huntington', 'Huntington'],
    ['ibc', 'IBC Bank'],
    ['icici', 'ICICI Bank'],
    ['ifast', 'iFAST Global Bank'],
    ['ing', 'ING'],
    ['kbc', 'KBC'],
    ['keybank', 'KeyBank'],
    ['kroo', 'Kroo'],
    ['laurentian', 'Laurentian Bank'],
    ['lloyds', 'Lloyds Bank'],
    ['m_and_t', 'M&T Bank'],
    ['marcus', 'Marcus by Goldman Sachs'],
    ['merrick', 'Merrick Bank'],
    ['metro_bank', 'Metro Bank'],
    ['monzo', 'Monzo'],
    ['n26', 'N26'],
    ['nab', 'NAB'],
    ['nationwide', 'Nationwide'],
    ['natwest', 'NatWest'],
    ['navy_federal', 'Navy Federal Credit Union'],
    ['ncba', 'NCBA Bank'],
    ['netspend', 'Netspend'],
    ['optum', 'Optum Bank'],
    ['payoneer', 'Payoneer'],
    ['paypal', 'PayPal'],
    ['pnc', 'PNC Bank'],
    ['prosperity', 'Prosperity Bank'],
    ['qnb', 'QNB'],
    ['raiffeisen', 'Raiffeisen Bank'],
    ['rbc', 'RBC Royal Bank'],
    ['regions', 'Regions Bank'],
    ['revolut', 'Revolut'],
    ['rbs', 'Royal Bank of Scotland'],
    ['santander', 'Santander UK'],
    ['sbi', 'State Bank of India'],
    ['scotiabank', 'Scotiabank'],
    ['simplii', 'Simplii Financial'],
    ['skrill', 'Skrill'],
    ['societe_generale', 'Société Générale'],
    ['sofi', 'SoFi'],
    ['sogexia', 'Sogexia'],
    ['standard_chartered', 'Standard Chartered'],
    ['starling', 'Starling Bank'],
    ['suncorp', 'Suncorp Bank'],
    ['synchrony', 'Synchrony Bank'],
    ['synovus', 'Synovus'],
    ['tangerine', 'Tangerine'],
    ['td', 'TD Bank'],
    ['co_operative_bank', 'The Co-operative Bank'],
    ['truist', 'Truist'],
    ['ubs', 'UBS'],
    ['uco', 'UCO Bank'],
    ['ulster', 'Ulster Bank'],
    ['unicredit', 'UniCredit'],
    ['union_bank_of_india', 'Union Bank of India'],
    ['usaa', 'USAA'],
    ['us_bank', 'U.S. Bank'],
    ['varo', 'Varo Bank'],
    ['virgin_money', 'Virgin Money'],
    ['walmart_moneycard', 'Walmart MoneyCard'],
    ['webster', 'Webster Bank'],
  ])('names the bank stored as %s by its real name', (bankName, displayName) => {
    expect(resolveBankLogo(bankName).displayName).toBe(displayName);
  });

  it('leaves an unknown bank as other', () => {
    expect(resolveBankLogo('allyship credit union').key).toBe('other');
    expect(resolveBankLogo('other').key).toBe('other');
  });
});
