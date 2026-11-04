import { type Dictionary, t } from 'intlayer';

/** How a transaction with no counterparty is named: the file printed none. */
const content = {
  key: 'payeeName',
  content: {
    unknownPayee: t({
      ru: 'Неизвестный получатель',
      en: 'Unknown payee',
      kk: 'Белгісіз алушы',
      de: 'Unbekannter Empfänger',
      fr: 'Bénéficiaire inconnu',
      es: 'Beneficiario desconocido',
      pt: 'Beneficiário desconhecido',
      tr: 'Bilinmeyen alıcı',
      uk: 'Невідомий отримувач',
      zh: '未知收款方',
      pl: 'Nieznany odbiorca',
      it: 'Beneficiario sconosciuto',
      sk: 'Neznámy príjemca',
      ja: '不明な支払先',
      ko: '알 수 없는 수취인',
      hi: 'अज्ञात प्राप्तकर्ता',
      nl: 'Onbekende begunstigde',
      sv: 'Okänd mottagare',
      vi: 'Người nhận không xác định',
      id: 'Penerima tidak dikenal',
      da: 'Ukendt modtager',
      nb: 'Ukjent mottaker',
      nn: 'Ukjend mottakar',
      fi: 'Tuntematon saaja',
      is: 'Óþekktur viðtakandi',
      fo: 'Ókendur móttakari',
      cs: 'Neznámý příjemce',
      bg: 'Неизвестен получател',
      hr: 'Nepoznati primatelj',
      sr: 'Непознати прималац',
      sl: 'Neznan prejemnik',
      mk: 'Непознат примач',
      be: 'Невядомы атрымальнік',
      bs: 'Nepoznati primalac',
      hsb: 'Njeznaty přijimar',
    }),
  },
} satisfies Dictionary;

export default content;
