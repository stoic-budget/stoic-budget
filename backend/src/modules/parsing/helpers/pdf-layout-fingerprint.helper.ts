import { createHash } from 'crypto';
import { BankName } from '../../../entities/statement.entity';
import type { LayoutColumn } from './pdf-layout-columns.helper';
import type { SectionSign } from './pdf-layout-sections.helper';
import { foldText } from './statement-date.helper';

/**
 * A statement's layout, as words only: what its table headers and section
 * headings say, in order. A bank that renames, adds or reorders a column
 * prints a new fingerprint on the first file of the new layout, before any
 * reading goes wrong. Never a figure, a name or a description.
 */
export interface StatementLayout {
  /** Short hash of `headings`: one value per layout. */
  fingerprint: string;
  /** Each distinct header, "role:heading" left to right; then "section:credit" and the like. */
  headings: string[];
  /** Header words no heading knows, and the headings of columns read as `other`. */
  unknownWords: string[];
  /** A bank with a parser of its own that the text names, kept to tell a declined file. */
  mentionedBank?: BankName;
  /** The workspace's taught layout (parsing_layout_templates) the statement was read with. */
  taughtTemplate?: string;
}

const FINGERPRINT_LENGTH = 12;

/**
 * Banks with a parser of their own, by any mention of their name. Looser than
 * each parser's own test on purpose: a file that names the bank but went to
 * the generic parser is one its parser declined, maybe a new layout.
 */
const BANK_MENTIONS: [BankName, RegExp][] = [
  // First: a Citibank statement names other banks in its IMPS and NEFT lines ("MOBIKWIK AXIS BANK").
  [BankName.CITI, /\bcitibank n\.?a\b|\bcitibank account statement\b/],
  // Before Bank of Scotland: "Halifax is a division of Bank of Scotland plc".
  // Lloyds statements may print the group's Halifax footer.
  [
    BankName.LLOYDS,
    /\blloyds (?:basic|classic|current|platinum|silver|gold|club)\b|\blloydsbank\.com\b/,
  ],
  [BankName.HALIFAX, /\bhalifax is a division of bank of scotland\b|\blogo, halifax\b/],
  [BankName.ABSA, /\babsa\b/],
  [BankName.ALLY, /\bally bank\b/],
  [BankName.ANZ, /\banz\b|australia and new zealand banking/],
  [BankName.ASSOCIATED, /\bassociated bank\b/],
  [BankName.ATB, /\batb financial\b/],
  [BankName.AXIS, /\baxis bank\b/],
  [BankName.BANCO_DO_BRASIL, /\bbanco do brasil\b/],
  [BankName.BANK_OF_CHINA, /\bbochk\b|\bbank of china\b/],
  // Before Bank of Scotland: "Royal Bank of Scotland" holds its name.
  [BankName.RBS, /\brbosgb2l\b|\broyal bank of scotland\b/],
  [BankName.BANK_OF_SCOTLAND, /\bbank\s*of\s*scotland/],
  [BankName.BARCLAYS, /\bbarclays bank\b/],
  [BankName.BENDIGO, /\bbendigo (?:and adelaide )?bank\b/],
  [BankName.BNP_PARIBAS, /\bbnp paribas\b/],
  [BankName.CITIZENS, /\bcitizensbank\.com\b/],
  [BankName.COAST_CAPITAL, /\bcoast capital savings\b/],
  [BankName.COMERICA, /\bcomerica\.com\b/],
  [BankName.COMMBANK, /\bcommonwealth bank of australia\b/],
  [BankName.COMMERCE_BANK, /\bcommercebank\.com\b/],
  [BankName.COMMERCIAL_BANK, /\bcommercial bank of c(?:eylon|yelon)\b/],
  [BankName.CREDIT_AGRICOLE, /\bcredit agricole\b/],
  [BankName.CREDIT_ONE, /\bcredit one bank\b/],
  [BankName.DCU, /\bdigital federal credit union\b/],
  [BankName.BANK_OF_AMERICA, /\bbank of america, n\.a\.|\bbankofamerica\.com\b/],
  [BankName.DESJARDINS, /\bcaisse desjardins\b|\bdesjardins\.com\b/],
  [BankName.DEUTSCHE_BANK, /\bdeutsche bank (?:ag|privat)/],
  [BankName.DISCOVER, /\bissued by discover bank\b/],
  [BankName.EQ_BANK, /\beq bank\b.*\bequitable bank\b|\bequitable bank tower\b/],
  [BankName.FIDELITY_BANK, /\bfidelitybank\.ng\b/],
  [BankName.FIFTH_THIRD, /\bfifth third (?:bank|business|preferred|momentum)/],
  [BankName.FIRST_CITIZENS, /\bfirst citizens bank\b|\bfirstcitizens\.com\b/],
  [BankName.FIRST_DIRECT, /\bfirstdirect\.com\b|\bfirst direct is a division of hsbc\b/],
  [BankName.FNB, /\bfnb\.co\.za\b|\bfirst national bank\b/],
  [BankName.FOUND, /\bfound is a financial technology company\b/],
  [BankName.FROST, /\bfrost (?:bank|business checking)\b|\bfort worth, texas 76162 member fdic\b/],
  [BankName.GO2BANK, /\bgo2bank\b/],
  [BankName.GOTYME, /\bgotyme bank\b/],
  [
    BankName.GREAT_SOUTHERN,
    /\bgreat southern bank\b.*\bcredit union australia\b|\bgreatsouthernbank\.com\.au\b/,
  ],
  [BankName.GREEN_DOT, /\bgreen dot corporation\b|\bgreendot\.com\b/],
  [BankName.HANDELSBANKEN, /\bhandelsbanken plc\b|\bhandelsbanken\.co\.uk\b/],
  [BankName.HDFC, /\bhdfc bank\b|\bifsc\s*:?\s*hdfc0/],
  [BankName.HERITAGE, /\bheritage bank limited\b/],
  [BankName.HSA_BANK, /\bhsa bank\b.{0,5} is a division of webster bank\b/],
  [BankName.HSBC, /\bwww\.hsbc\.co\.uk\b|\bhsbc uk bank plc\b/],
  [BankName.HUNTINGTON, /\bthe huntington national bank\b/],
  [BankName.IBC, /\bwww\.(?:my)?ibc\.com\b|\binternational bank of commerce\b/],
  [BankName.ICICI, /\bwww\.icicibank\.com\b|\bicici bank limited\b/],
  [BankName.IFAST, /\bifast global bank limited\b/],
  [BankName.ING, /\bing bank \(australia\)|\babn 24 000 893 292\b/],
  [BankName.KBC, /\bwww\.kbc\.be\b|\bkbc bank nv\b/],
  [BankName.KEYBANK, /\bkeybank national association\b/],
  [BankName.KROO, /\bkroo bank ltd\b/],
  [BankName.LAURENTIAN, /\blaurentian bank\b|\b1360,? boul\.? rene-levesque o\./],
  [BankName.M_AND_T, /\bmanufacturers and traders trust company\b|\bmtb\.com\b/],
  [BankName.MARCUS, /\bmarcus\.com\b/],
  [BankName.MERRICK, /\bmerrick account summary\b/],
  [BankName.METRO_BANK, /\bmetro bank plc\b/],
  [BankName.MONZO, /\bmonzo bank limited\b/],
  [BankName.N26, /\byour n26 team\b|\bn26 bank (?:ag|gmbh|se)\b|\bntsbdeb1\b/],
  [BankName.NAB, /\bnational australia bank\b|\bnab isaver\b|\bnab classic banking\b/],
  [BankName.NATIONWIDE, /\bnationwide\.co\.uk\b|\bnationwide building society\b/],
  [BankName.NATWEST, /\bnwbkgb2l\b|\bnatwest\.com\b/],
  [BankName.NAVY_FEDERAL, /\bnavyfederal\.org\b|\bnavy federal credit union\b/],
  [BankName.NCBA, /\bncba\b/],
  [BankName.NETSPEND, /\bnetspend\.com\b/],
  [BankName.OPTUM, /\boptumbank\.com\b/],
  [BankName.PAYONEER, /\bpayoneer, all rights reserved\b/],
  [BankName.PAYPAL, /\bpaypal (?:savings |balance |business )?(?:account )?statement\b/],
  [BankName.PNC, /\b1-888-pnc-bank\b/],
  [BankName.PROSPERITY, /\bprosperity bank\b|\bnyse symbol "pb"/],
  [BankName.QNB, /\bqatar national bank\b/],
  [BankName.RAIFFEISEN, /\brzbrrobu\b/],
  [BankName.RBC, /\byour rbc (?:personal|business) banking\b/],
  [BankName.REGIONS, /\b1-800-regions\b/],
  [BankName.REVOLUT, /\brevolut (?:ltd|bank uab)\b/],
  [BankName.SANTANDER, /\bsantander uk plc\b/],
  [BankName.SBI, /\bstate bank of india\b/],
  [BankName.SCOTIABANK, /\bwww\.scotiabank\.com\b|\b1 800 4-scotia\b/],
  [BankName.SIMPLII, /\bsimplii financial\b/],
  [BankName.SKRILL, /\bwww\.skrill\.com\b/],
  [BankName.SOCIETE_GENERALE, /\bparticuliers\.societegenerale\.fr\b/],
  [BankName.SOFI, /\bsofi bank, n\.a\./],
  [BankName.SOGEXIA, /\bsogexia\.com\b/],
  [BankName.STANDARD_CHARTERED, /\bstandard chartered\b/],
  [BankName.STARLING, /\bwww\.starlingbank\.com\b|\bsrlggb2l\b/],
  [BankName.SUNCORP, /\bsuncorp-metway ltd\b/],
  [BankName.SYNCHRONY, /\bsynchronybank\.com\b/],
  [BankName.SYNOVUS, /\bp\.o\. box 2646-r, columbus, ga 31902\b|\bsynovus\.com\b/],
  [BankName.TANGERINE, /\bwww\.tangerine\.ca\b/],
  [BankName.TD, /\bthe toronto-dominion bank\b|\btd canada trust\b/],
  [BankName.CO_OPERATIVE_BANK, /\bthe co-operative bank\b/],
  [BankName.TRUIST, /\b4truist\b/],
  [BankName.UBS, /\bwww\.ubs\.com\b/],
  [BankName.UCO, /\bucba0\d{6}\b/],
  [BankName.ULSTER, /\bulsbgb2b\b|\bulsterbank\.co\.uk\b/],
  [BankName.UNICREDIT, /\buncritm1\w*\b|\bunicredit\.eu\b/],
  [BankName.UNION_BANK_OF_INDIA, /\bubin0\d{6}\b/],
  [BankName.USAA, /\busaa federal savings bank\b/],
  [BankName.US_BANK, /\bu\.s\. bank national association\b|\b1-800-us banks\b/],
  [BankName.CIBC, /\bcibc account statement\b|\bwww\.cibc\.com\b/],
  [BankName.CHIME, /\bchime member services\b/],
  [BankName.CHASE, /\bjpmorgan chase bank\b/],
  [BankName.CASH_APP, /\bcash app investing\b|\bcash disputes\b/],
  [BankName.SCHWAB, /\bcharles schwab bank\b/],
  [BankName.CAPITEC, /\bcapitec bank\b|\bcapitecbank\.co\.za\b/],
  [BankName.CAPITAL_ONE, /\bcapital one\b|\bcapitalone\.com\b/],
  [BankName.BPI, /\bbpi express\b|\bbank of the philippine islands\b/],
  [BankName.BOQ, /\bbank of queensland\b|\bboq\.com\.au\b/],
  [BankName.BMO, /\bbmo bank\b|\bbmo harris\b/],
  [BankName.BECU, /\bbecu\b|\bboeing employees' credit union\b/],
  [BankName.KASPI, /\bkaspi\b|\bкаспи\b/],
  [BankName.BEREKE_NEW, /\bbereke\b|\bбереке\b/],
  [BankName.HAPOALIM, /\bhapoalim\b|הפועלים/],
];

export function mentionedBank(text: string): BankName | undefined {
  const folded = foldText(text);
  return BANK_MENTIONS.find(([, pattern]) => pattern.test(folded))?.[0];
}

/** A word with a digit is a figure or a date read along with the header, not a heading. */
const isWord = (word: string) => !/\d/.test(word);

/** The words of a column no heading knows: its own if it is `other`, and those beside it. */
const unknownOf = (column: LayoutColumn) =>
  [
    ...(column.role === 'other' && column.heading ? [column.heading] : []),
    ...(column.extra ?? []),
  ].filter(isWord);

/** "role:heading", with the column's unknown words: "balance:balance in original currency". */
const headerLine = (header: LayoutColumn[]) =>
  header
    .filter(column => column.role !== 'other' || unknownOf(column).length > 0)
    .map(column =>
      [
        `${column.role}:${column.role === 'other' ? '' : (column.heading ?? '')}`,
        ...unknownOf(column),
      ]
        .join(' ')
        .replace(/: /, ':'),
    )
    .join(' | ');

/** The layout of what was read; none when no header or section heading was found. */
export function statementLayout(
  layout: { headers: LayoutColumn[][]; sections: SectionSign[] },
  text: string,
): StatementLayout | undefined {
  const headings = [
    ...new Set([
      ...layout.headers.map(headerLine),
      ...layout.sections.map(sign => `section:${sign}`),
    ]),
  ];
  if (headings.length === 0) {
    return undefined;
  }
  const unknownWords = [...new Set(layout.headers.flatMap(header => header.flatMap(unknownOf)))];
  const bank = mentionedBank(text);
  return {
    fingerprint: createHash('sha256')
      .update(headings.join('\n'))
      .digest('hex')
      .slice(0, FINGERPRINT_LENGTH),
    headings,
    unknownWords,
    ...(bank ? { mentionedBank: bank } : {}),
  };
}
