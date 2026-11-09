import { AMOUNT, COMMENT, CURRENCY, DATE } from './amount-aliases';
import type { ImportTargetKind, TargetField } from './target-aliases';

/** Header words of the two investment targets: metal lots and broker trades. */
type InvestmentTarget = Extract<ImportTargetKind, 'metals' | 'trades'>;

export const INVESTMENT_FIELDS: Record<InvestmentTarget, TargetField[]> = {
  // A stacker's spreadsheet: one row per lot, weight and fineness apart.
  metals: [
    {
      key: 'metal',
      type: 'enum',
      required: true,
      options: ['XAU', 'XAG', 'XPT', 'XPD'],
      aliases: ['metal', 'металл', 'метал', 'type', 'тип', 'kind', 'metall', 'maden'],
    },
    {
      key: 'unitWeight',
      type: 'number',
      required: true,
      aliases: [
        'weight',
        'вес',
        'масса',
        'oz',
        'ozt',
        'unitweight',
        'weightperpiece',
        'gewicht',
        'peso',
        'grams',
        'граммы',
      ],
    },
    {
      key: 'quantity',
      type: 'number',
      required: false,
      aliases: ['quantity', 'qty', 'количество', 'кол', 'pieces', 'pcs', 'count', 'штук', 'шт'],
    },
    {
      key: 'weightUnit',
      type: 'enum',
      required: false,
      options: ['g', 'ozt', 'kg'],
      aliases: ['unit', 'единица', 'weightunit', 'measure', 'einheit'],
    },
    {
      key: 'purity',
      type: 'number',
      required: false,
      aliases: ['purity', 'проба', 'fineness', 'fine', 'чистота', 'feinheit', 'pureza', 'karat'],
    },
    {
      key: 'cost',
      type: 'number',
      required: false,
      aliases: ['paid', 'уплачено', 'оплачено', 'costbasis', ...AMOUNT],
    },
    { key: 'currency', type: 'text', required: false, aliases: CURRENCY },
    { key: 'acquiredOn', type: 'date', required: false, aliases: [...DATE, 'bought', 'куплено'] },
    {
      key: 'counterparty',
      type: 'text',
      required: false,
      aliases: ['dealer', 'дилер', 'продавец', 'seller', 'shop', 'магазин', 'vendor', 'händler'],
    },
    {
      key: 'name',
      type: 'text',
      required: false,
      aliases: ['name', 'название', 'description', 'описание', 'item', 'coin', 'монета', 'bar'],
    },
  ],

  // A broker's export: one row per trade. Quantity is required so a bank
  // statement (a date, a type, an amount) is never taken for one.
  trades: [
    { key: 'date', type: 'date', required: true, aliases: [...DATE, 'trade date', 'дата сделки'] },
    {
      key: 'kind',
      type: 'enum',
      required: true,
      options: ['buy', 'sell', 'dividend', 'split', 'transfer_in', 'transfer_out'],
      aliases: [
        'type',
        'action',
        'operation',
        'side',
        'kind',
        'тип',
        'операция',
        'действие',
        'typ',
      ],
    },
    {
      key: 'quantity',
      type: 'number',
      required: true,
      aliases: [
        'quantity',
        'qty',
        'shares',
        'units',
        'количество',
        'кол',
        'штук',
        'anzahl',
        'stück',
      ],
    },
    {
      key: 'symbol',
      type: 'text',
      required: false,
      aliases: ['symbol', 'ticker', 'тикер', 'isin', 'wkn', 'code'],
    },
    {
      key: 'name',
      type: 'text',
      required: false,
      aliases: ['name', 'security', 'instrument', 'название', 'инструмент', 'бумага', 'wertpapier'],
    },
    {
      key: 'price',
      type: 'number',
      required: false,
      aliases: ['price', 'unit price', 'share price', 'цена', 'kurs', 'preis', 'precio'],
    },
    {
      key: 'fee',
      type: 'number',
      required: false,
      aliases: ['fee', 'fees', 'commission', 'комиссия', 'gebühr', 'provision', 'comisión', 'tax'],
    },
    {
      key: 'amount',
      type: 'number',
      required: false,
      aliases: [
        ...AMOUNT.filter(alias => alias !== 'price' && alias !== 'цена'),
        'dividend',
        'дивиденд',
      ],
    },
    { key: 'currency', type: 'text', required: false, aliases: CURRENCY },
    {
      key: 'ratio',
      type: 'text',
      required: false,
      aliases: ['ratio', 'split ratio', 'коэффициент', 'соотношение', 'verhältnis'],
    },
    {
      key: 'acquiredOn',
      type: 'date',
      required: false,
      aliases: ['acquired', 'acquired on', 'purchase date', 'дата покупки', 'kaufdatum'],
    },
    { key: 'note', type: 'text', required: false, aliases: COMMENT },
  ],
};

export const INVESTMENT_HINTS: Record<InvestmentTarget, string[]> = {
  metals: [
    'gold',
    'золото',
    'silver',
    'серебро',
    'platinum',
    'платина',
    'palladium',
    'палладий',
    'ozt',
    'troy',
    'bullion',
    'слиток',
    'монета',
    'purity',
    'проба',
    'fineness',
    'spot',
    'stack',
  ],

  trades: [
    'ticker',
    'тикер',
    'symbol',
    'isin',
    'shares',
    'dividend',
    'дивиденд',
    'commission',
    'комиссия',
    'broker',
    'брокер',
    'split',
    'сплит',
    'trade',
    'сделка',
  ],
};

export const INVESTMENT_ENUM_ALIASES: Record<string, Record<string, string[]>> = {
  metal: {
    XAU: ['xau', 'gold', 'золото', 'au', 'gelbgold', 'oro', 'altın', 'złoto'],
    XAG: ['xag', 'silver', 'серебро', 'ag', 'silber', 'plata', 'gümüş', 'srebro'],
    XPT: ['xpt', 'platinum', 'платина', 'pt', 'platin', 'platino'],
    XPD: ['xpd', 'palladium', 'палладий', 'pd', 'pallad', 'paladio'],
  },
  weightUnit: {
    g: ['g', 'gr', 'gram', 'grams', 'г', 'гр', 'грамм', 'граммы', 'gramm'],
    ozt: ['ozt', 'oz', 'ounce', 'ounces', 'troy', 'troyounce', 'унция', 'унции', 'унц'],
    kg: ['kg', 'kilo', 'kilogram', 'кг', 'килограмм'],
  },

  tradeKind: {
    buy: ['buy', 'bought', 'purchase', 'покупка', 'купля', 'kauf', 'compra', 'achat'],
    sell: ['sell', 'sold', 'sale', 'продажа', 'verkauf', 'venta', 'vente'],
    dividend: ['dividend', 'dividends', 'div', 'дивиденд', 'дивиденды', 'dividende', 'dividendo'],
    split: ['split', 'stock split', 'reverse split', 'сплит', 'aktiensplit'],
    transfer_in: [
      'transfer in',
      'transfer_in',
      'deposit',
      'received',
      'зачисление',
      'ввод',
      'einbuchung',
    ],
    transfer_out: [
      'transfer out',
      'transfer_out',
      'withdrawal',
      'delivered',
      'списание',
      'вывод',
      'ausbuchung',
    ],
  },
};
