/**
 * Receipts of the public demo: real scans from Wikimedia Commons under a free
 * licence, picked by hand for showing no card number, bank account, loyalty
 * id or person's name. The fields are what each image prints, transcribed;
 * only the date is the demo's own (`daysBeforeAnchor`), so they sit inside its
 * twelve months. The original is fetched by `url` and checked against `sha1`.
 * Credits: website/docs/deployment/demo.md.
 */

export type DemoReceiptCategory = 'Meals and entertainment' | 'Office supplies' | 'Travel';

export interface DemoReceiptSource {
  key: string;
  url: string;
  page: string;
  sha1: string;
  licence: 'Public domain' | 'CC BY-SA 4.0';
  author: string;
  vendor: string;
  address: string | null;
  daysBeforeAnchor: number;
  category: DemoReceiptCategory;
  /** Cents; the lines add up to it. */
  totalCents: number;
  taxCents: number | null;
  lines: Array<{ description: string; cents: number }>;
  /** Left for the visitor to review instead of booked. */
  pending?: boolean;
}

const COMMONS = 'https://upload.wikimedia.org/wikipedia/commons';
const PAGE = 'https://commons.wikimedia.org/wiki/File:';

export const DEMO_RECEIPTS: DemoReceiptSource[] = [
  {
    key: 'lidl-aurich',
    url: `${COMMONS}/f/ff/Lidl_Emsstra%C3%9Fe_receipt%2C_Aurich_%282019%29_01.jpg`,
    page: `${PAGE}Lidl_Emsstra%C3%9Fe_receipt,_Aurich_(2019)_01.jpg`,
    sha1: '650ac7decd8f9abb3e93683bca9dbfd6577cd5cb',
    licence: 'CC BY-SA 4.0',
    author: 'Donald Trung Quoc Don',
    vendor: 'Lidl',
    address: 'Emsstraße 7, 26603 Aurich',
    daysBeforeAnchor: 2,
    category: 'Meals and entertainment',
    totalCents: 1802,
    taxCents: 212,
    lines: [
      { description: 'Dattelcherrytomaten', cents: 149 },
      { description: 'Grüne Oliven o. Kern', cents: 399 },
      { description: 'Erbsen extra fein', cents: 59 },
      { description: 'Gemüsemais 2 x 0,49', cents: 98 },
      { description: 'Milchbrötchen', cents: 99 },
      { description: 'Schlafover 0301558', cents: 499 },
      { description: 'Schlafover 0301438', cents: 499 },
    ],
    pending: true,
  },
  {
    key: 'aldi-hesel',
    url: `${COMMONS}/5/53/ALDI_Hesel_receipt%2C_Hesel_%282019%29_01.jpg`,
    page: `${PAGE}ALDI_Hesel_receipt,_Hesel_(2019)_01.jpg`,
    sha1: '5e287b85722fb14641bfe93b0c1f6e984309506b',
    licence: 'CC BY-SA 4.0',
    author: 'Donald Trung Quoc Don',
    vendor: 'ALDI',
    address: 'Im Brink 8, Hesel',
    daysBeforeAnchor: 5,
    category: 'Office supplies',
    totalCents: 2574,
    taxCents: 225,
    lines: [
      { description: 'Geschirrspültabs', cents: 285 },
      { description: 'Toilettenpapier 4-lagig', cents: 325 },
      { description: 'Blumenkohl', cents: 139 },
      { description: 'SB-Margarine', cents: 75 },
      { description: 'Picco Belli Mini Pizzen', cents: 199 },
      { description: 'Frucht auf Joghurt 4 x 0,29', cents: 116 },
      { description: 'TK Chicken Nuggets', cents: 199 },
      { description: 'Frischkäse Kräuter', cents: 99 },
      { description: 'Mozzarella Mini 2 x 0,89', cents: 178 },
      { description: 'Fruchtjoghurt 0,5%', cents: 99 },
      { description: 'Cherrytomaten', cents: 85 },
      { description: 'Creme Dessert mit Schoko 10 x 0,55', cents: 550 },
      { description: 'Sahnekefir a. Frucht 5 x 0,45', cents: 225 },
    ],
    pending: true,
  },
  {
    key: 'saurusselalm',
    url: `${COMMONS}/b/b7/GER_%E2%80%94_Bayern_%E2%80%94_Oberbayern_%E2%80%94_Landkreis_Miesbach_%E2%80%94_Gemeinde_Bad_Wiessee_%E2%80%94_Saur%C3%BCsselalm_1_%28vorl%C3%A4ufiger_Beleg%29_2024-04-07_Mattes.jpg`,
    page: `${PAGE}GER_%E2%80%94_Bayern_%E2%80%94_Oberbayern_%E2%80%94_Landkreis_Miesbach_%E2%80%94_Gemeinde_Bad_Wiessee_%E2%80%94_Saur%C3%BCsselalm_1_(vorl%C3%A4ufiger_Beleg)_2024-04-07_Mattes.jpg`,
    sha1: '0cee395badda4d11983ede1f40be59352265e059',
    licence: 'Public domain',
    author: 'User:Mattes',
    vendor: 'Saurüsselalm',
    address: 'Saurüsselalm 1, 83707 Bad Wiessee',
    daysBeforeAnchor: 19,
    category: 'Meals and entertainment',
    totalCents: 2340,
    taxCents: null,
    lines: [
      { description: 'Holunderschorle 0,5l', cents: 550 },
      { description: 'Kaiserschmarrn', cents: 1790 },
    ],
  },
  {
    key: 'mediamarkt',
    url: `${COMMONS}/0/0b/MediaMarkt-Quittung-2011.jpg`,
    page: `${PAGE}MediaMarkt-Quittung-2011.jpg`,
    sha1: '28d7c93bc765710267c83c495324a29bdd4302a3',
    licence: 'CC BY-SA 4.0',
    author: 'Riquix',
    vendor: 'MediaMarkt',
    address: 'Schönbachstraße 192, 86154 Augsburg',
    daysBeforeAnchor: 33,
    category: 'Office supplies',
    totalCents: 649,
    taxCents: 104,
    lines: [{ description: 'Hama Verlängerungskabel 3,5 mm', cents: 649 }],
  },
  {
    key: 'augustiner',
    url: `${COMMONS}/5/5e/Augustiner_Neuhausen_Rechnung_2020.JPG`,
    page: `${PAGE}Augustiner_Neuhausen_Rechnung_2020.JPG`,
    sha1: 'b4d6fbde7bd9e53e988efa49bc56bf80ff2cc4d6',
    licence: 'Public domain',
    author: 'User:Mateus2019',
    vendor: 'Neuhauser Augustiner',
    address: 'Hübnerstraße 23, 80637 München',
    daysBeforeAnchor: 58,
    category: 'Meals and entertainment',
    totalCents: 2350,
    taxCents: 145,
    lines: [
      { description: '0,4 Schorle', cents: 360 },
      { description: 'T-Rindersteak', cents: 1990 },
    ],
  },
  {
    key: 'ikea',
    url: `${COMMONS}/8/82/Ikea-Quittung-2009.jpg`,
    page: `${PAGE}Ikea-Quittung-2009.jpg`,
    sha1: '63bf5aaf41a9850812a89196b7cc8e2df3f0ee7a',
    licence: 'CC BY-SA 4.0',
    author: 'Riquix',
    vendor: 'IKEA Augsburg',
    address: 'Otto-Hahn-Str. 99, 86368 Gersthofen',
    daysBeforeAnchor: 94,
    category: 'Office supplies',
    totalCents: 1398,
    taxCents: 223,
    lines: [
      { description: 'BITS Magnettafel', cents: 999 },
      { description: 'BABBLA Whiteboardstift', cents: 399 },
    ],
  },
  {
    key: 'ferry-konstanz',
    url: `${COMMONS}/d/de/Autof%C3%A4hre_Konstanz%E2%80%93Meersburg_%E2%80%94_Fahrschein_2021.jpg`,
    page: `${PAGE}Autof%C3%A4hre_Konstanz%E2%80%93Meersburg_%E2%80%94_Fahrschein_2021.jpg`,
    sha1: 'c6d3435d9c3bc57d6ce7f6ec34dcc5a1e5cdd535',
    licence: 'Public domain',
    author: 'Stadtwerke Konstanz',
    vendor: 'Fähre Konstanz–Meersburg',
    address: null,
    daysBeforeAnchor: 143,
    category: 'Travel',
    totalCents: 740,
    taxCents: 48,
    lines: [{ description: 'Motorrad, einfach', cents: 740 }],
  },
  {
    key: 'timmelsjoch',
    url: `${COMMONS}/c/cd/Timmelsjoch-Hochalpenstrasse_%E2%80%94_Quittung_%C3%BCber_die_Zahlung_der_Maut_2021.jpg`,
    page: `${PAGE}Timmelsjoch-Hochalpenstrasse_%E2%80%94_Quittung_%C3%BCber_die_Zahlung_der_Maut_2021.jpg`,
    sha1: '161c6c69803d4070c361d08349d9d374c748d8c9',
    licence: 'CC BY-SA 4.0',
    author: 'User:Mateus2019',
    vendor: 'Timmelsjoch Hochalpenstraße',
    address: 'Museumstraße 5, 6020 Innsbruck',
    daysBeforeAnchor: 142,
    category: 'Travel',
    totalCents: 1500,
    taxCents: 250,
    lines: [{ description: 'Einzelkarte Motorrad', cents: 1500 }],
  },
  {
    key: 'grossglockner',
    url: `${COMMONS}/b/b9/Gro%C3%9Fglockner-Hochalpenstra%C3%9Fe_Mautquittung_2020.JPG`,
    page: `${PAGE}Gro%C3%9Fglockner-Hochalpenstra%C3%9Fe_Mautquittung_2020.JPG`,
    sha1: '56ad1d18df21a3caf9ec22be41125327cfd2eb1a',
    licence: 'Public domain',
    author: 'Großglockner-Hochalpenstraßen-Aktiengesellschaft',
    vendor: 'Großglockner Hochalpenstraße',
    address: 'Rainerstraße 2, 5020 Salzburg',
    daysBeforeAnchor: 141,
    category: 'Travel',
    totalCents: 2700,
    taxCents: 450,
    lines: [{ description: 'Tageskarte Motorrad', cents: 2700 }],
  },
  {
    key: 'gerlos',
    url: `${COMMONS}/5/55/AUT_%E2%80%94_Salzburger_Land_%E2%80%94_Bezirk_Zell_am_See_%E2%80%94_Gemeinde_Krimml_%28Gerlospass%2C_Quittung_f%C3%BCr_die_Zahlung_der_Maut%29_2021..jpg`,
    page: `${PAGE}AUT_%E2%80%94_Salzburger_Land_%E2%80%94_Bezirk_Zell_am_See_%E2%80%94_Gemeinde_Krimml_(Gerlospass,_Quittung_f%C3%BCr_die_Zahlung_der_Maut)_2021..jpg`,
    sha1: 'c84476164bc2dc619bf05cc6a9edb67b0529d583',
    licence: 'Public domain',
    author: 'Großglockner Hochalpenstraßen AG, repro by User:Mateus2019',
    vendor: 'Gerlos Alpenstraße',
    address: 'Rainerstraße 2, 5020 Salzburg',
    daysBeforeAnchor: 140,
    category: 'Travel',
    totalCents: 700,
    taxCents: 117,
    lines: [{ description: 'Tageskarte Motorrad', cents: 700 }],
  },
  {
    key: 'aldi-ebersberg',
    url: `${COMMONS}/2/26/Aldi-Quittung-2006.jpg`,
    page: `${PAGE}Aldi-Quittung-2006.jpg`,
    sha1: '8b36c7a240be370d4499dc084d41386bbba8b4db',
    licence: 'CC BY-SA 4.0',
    author: 'Riquix',
    vendor: 'ALDI',
    address: 'Münchener Str. 34, 85560 Ebersberg',
    daysBeforeAnchor: 178,
    category: 'Office supplies',
    totalCents: 5723,
    taxCents: 773,
    lines: [
      { description: 'Apfelschorle 2 x 1,39', cents: 278 },
      { description: 'Pfand 12 x 0,25', cents: 300 },
      { description: 'Elektr. Wörterbuch', cents: 3999 },
      { description: 'Traubendirektsaft 3 x 0,65', cents: 195 },
      { description: 'Apfeldirektsaft naturtrüb 3 x 0,69', cents: 207 },
      { description: 'Quark-Dessert mit Frucht', cents: 129 },
      { description: 'Müsli Riegel', cents: 99 },
      { description: 'Direktsaft Premium 4 x 1,29', cents: 516 },
    ],
  },
  {
    key: 'vogtlandbahn',
    url: `${COMMONS}/d/df/Vogtlandbahn_%E2%80%94_Speisewagen_%28Quittung%29_2015.jpg`,
    page: `${PAGE}Vogtlandbahn_%E2%80%94_Speisewagen_(Quittung)_2015.jpg`,
    sha1: 'e47a5159de909b91bc01caebbb7e079056303415',
    licence: 'Public domain',
    author: 'Vogtlandbahn, scan by User:Mattes',
    vendor: 'Vogtlandbahn',
    address: null,
    daysBeforeAnchor: 212,
    category: 'Travel',
    totalCents: 660,
    taxCents: 106,
    lines: [
      { description: 'Fanta 0,33l', cents: 160 },
      { description: 'Sandwich + Bier', cents: 500 },
    ],
  },
];
