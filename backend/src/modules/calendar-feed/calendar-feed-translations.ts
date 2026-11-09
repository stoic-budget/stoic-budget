/**
 * The words of a calendar feed, in the member's interface language. Event
 * titles are templates: `{{name}}` is the counterparty, subscription or tax
 * return, `{{amount}}` the formatted amount, `{{number}}` the invoice number.
 */
export type CalendarFeedLabelKey =
  | 'calendarName'
  | 'payableDue'
  | 'payablePaid'
  | 'receivableDue'
  | 'receivablePaid'
  | 'subscriptionCharge'
  | 'invoiceDue'
  | 'invoicePaid'
  | 'taxDue'
  | 'taxDone';

export type CalendarFeedLabels = Record<CalendarFeedLabelKey, string>;

const ru: CalendarFeedLabels = {
  calendarName: 'Денежные даты',
  payableDue: 'Оплатить: {{name}} · {{amount}}',
  payablePaid: 'Оплачено: {{name}} · {{amount}}',
  receivableDue: 'Ожидается от {{name}} · {{amount}}',
  receivablePaid: 'Получено от {{name}} · {{amount}}',
  subscriptionCharge: 'Списание подписки: {{name}} · {{amount}}',
  invoiceDue: 'Срок оплаты счёта {{number}}: {{name}} · {{amount}}',
  invoicePaid: 'Оплачено: счёт {{number}}, {{name}} · {{amount}}',
  taxDue: 'Срок подачи: {{name}}',
  taxDone: 'Подано: {{name}}',
};

const en: CalendarFeedLabels = {
  calendarName: 'Money dates',
  payableDue: 'Pay {{name}} · {{amount}}',
  payablePaid: 'Paid: {{name}} · {{amount}}',
  receivableDue: 'Expected from {{name}} · {{amount}}',
  receivablePaid: 'Received from {{name}} · {{amount}}',
  subscriptionCharge: 'Subscription charge: {{name}} · {{amount}}',
  invoiceDue: 'Invoice {{number}} due: {{name}} · {{amount}}',
  invoicePaid: 'Paid: invoice {{number}}, {{name}} · {{amount}}',
  taxDue: 'Due: {{name}}',
  taxDone: 'Filed: {{name}}',
};

const kk: CalendarFeedLabels = {
  calendarName: 'Ақша күндері',
  payableDue: 'Төлеу: {{name}} · {{amount}}',
  payablePaid: 'Төленді: {{name}} · {{amount}}',
  receivableDue: '{{name}} күтілуде · {{amount}}',
  receivablePaid: '{{name}} алынды · {{amount}}',
  subscriptionCharge: 'Жазылым төлемі: {{name}} · {{amount}}',
  invoiceDue: '{{number}} шотының мерзімі: {{name}} · {{amount}}',
  invoicePaid: 'Төленді: {{number}} шоты, {{name}} · {{amount}}',
  taxDue: 'Тапсыру мерзімі: {{name}}',
  taxDone: 'Тапсырылды: {{name}}',
};

const de: CalendarFeedLabels = {
  calendarName: 'Geldtermine',
  payableDue: '{{name}} bezahlen · {{amount}}',
  payablePaid: 'Bezahlt: {{name}} · {{amount}}',
  receivableDue: 'Erwartet von {{name}} · {{amount}}',
  receivablePaid: 'Erhalten von {{name}} · {{amount}}',
  subscriptionCharge: 'Abo-Abbuchung: {{name}} · {{amount}}',
  invoiceDue: 'Rechnung {{number}} fällig: {{name}} · {{amount}}',
  invoicePaid: 'Bezahlt: Rechnung {{number}}, {{name}} · {{amount}}',
  taxDue: 'Fällig: {{name}}',
  taxDone: 'Abgegeben: {{name}}',
};

const fr: CalendarFeedLabels = {
  calendarName: 'Échéances',
  payableDue: 'Payer {{name}} · {{amount}}',
  payablePaid: 'Payé : {{name}} · {{amount}}',
  receivableDue: 'Attendu de {{name}} · {{amount}}',
  receivablePaid: 'Reçu de {{name}} · {{amount}}',
  subscriptionCharge: 'Prélèvement d’abonnement : {{name}} · {{amount}}',
  invoiceDue: 'Échéance de la facture {{number}} : {{name}} · {{amount}}',
  invoicePaid: 'Payée : facture {{number}}, {{name}} · {{amount}}',
  taxDue: 'Échéance : {{name}}',
  taxDone: 'Déposée : {{name}}',
};

const es: CalendarFeedLabels = {
  calendarName: 'Fechas de dinero',
  payableDue: 'Pagar {{name}} · {{amount}}',
  payablePaid: 'Pagado: {{name}} · {{amount}}',
  receivableDue: 'Se espera de {{name}} · {{amount}}',
  receivablePaid: 'Recibido de {{name}} · {{amount}}',
  subscriptionCharge: 'Cargo de suscripción: {{name}} · {{amount}}',
  invoiceDue: 'Vence la factura {{number}}: {{name}} · {{amount}}',
  invoicePaid: 'Pagada: factura {{number}}, {{name}} · {{amount}}',
  taxDue: 'Vence: {{name}}',
  taxDone: 'Presentada: {{name}}',
};

const pt: CalendarFeedLabels = {
  calendarName: 'Datas financeiras',
  payableDue: 'Pagar {{name}} · {{amount}}',
  payablePaid: 'Pago: {{name}} · {{amount}}',
  receivableDue: 'Esperado de {{name}} · {{amount}}',
  receivablePaid: 'Recebido de {{name}} · {{amount}}',
  subscriptionCharge: 'Cobrança de assinatura: {{name}} · {{amount}}',
  invoiceDue: 'Vencimento da fatura {{number}}: {{name}} · {{amount}}',
  invoicePaid: 'Paga: fatura {{number}}, {{name}} · {{amount}}',
  taxDue: 'Prazo: {{name}}',
  taxDone: 'Entregue: {{name}}',
};

const tr: CalendarFeedLabels = {
  calendarName: 'Para tarihleri',
  payableDue: '{{name}} öde · {{amount}}',
  payablePaid: 'Ödendi: {{name}} · {{amount}}',
  receivableDue: '{{name}} tarafından bekleniyor · {{amount}}',
  receivablePaid: '{{name}} tarafından alındı · {{amount}}',
  subscriptionCharge: 'Abonelik ödemesi: {{name}} · {{amount}}',
  invoiceDue: '{{number}} numaralı fatura vadesi: {{name}} · {{amount}}',
  invoicePaid: 'Ödendi: {{number}} numaralı fatura, {{name}} · {{amount}}',
  taxDue: 'Son tarih: {{name}}',
  taxDone: 'Verildi: {{name}}',
};

const uk: CalendarFeedLabels = {
  calendarName: 'Грошові дати',
  payableDue: 'Оплатити: {{name}} · {{amount}}',
  payablePaid: 'Оплачено: {{name}} · {{amount}}',
  receivableDue: 'Очікується від {{name}} · {{amount}}',
  receivablePaid: 'Отримано від {{name}} · {{amount}}',
  subscriptionCharge: 'Списання підписки: {{name}} · {{amount}}',
  invoiceDue: 'Термін оплати рахунку {{number}}: {{name}} · {{amount}}',
  invoicePaid: 'Оплачено: рахунок {{number}}, {{name}} · {{amount}}',
  taxDue: 'Термін подання: {{name}}',
  taxDone: 'Подано: {{name}}',
};

const zh: CalendarFeedLabels = {
  calendarName: '资金日期',
  payableDue: '支付 {{name}} · {{amount}}',
  payablePaid: '已支付：{{name}} · {{amount}}',
  receivableDue: '预计收到 {{name}} · {{amount}}',
  receivablePaid: '已收到 {{name}} · {{amount}}',
  subscriptionCharge: '订阅扣款：{{name}} · {{amount}}',
  invoiceDue: '发票 {{number}} 到期：{{name}} · {{amount}}',
  invoicePaid: '已支付：发票 {{number}}，{{name}} · {{amount}}',
  taxDue: '截止：{{name}}',
  taxDone: '已申报：{{name}}',
};

const pl: CalendarFeedLabels = {
  calendarName: 'Terminy płatności',
  payableDue: 'Zapłać {{name}} · {{amount}}',
  payablePaid: 'Zapłacono: {{name}} · {{amount}}',
  receivableDue: 'Oczekiwane od {{name}} · {{amount}}',
  receivablePaid: 'Otrzymano od {{name}} · {{amount}}',
  subscriptionCharge: 'Opłata za subskrypcję: {{name}} · {{amount}}',
  invoiceDue: 'Termin faktury {{number}}: {{name}} · {{amount}}',
  invoicePaid: 'Zapłacono: faktura {{number}}, {{name}} · {{amount}}',
  taxDue: 'Termin: {{name}}',
  taxDone: 'Złożono: {{name}}',
};

const it: CalendarFeedLabels = {
  calendarName: 'Scadenze',
  payableDue: 'Paga {{name}} · {{amount}}',
  payablePaid: 'Pagato: {{name}} · {{amount}}',
  receivableDue: 'In arrivo da {{name}} · {{amount}}',
  receivablePaid: 'Ricevuto da {{name}} · {{amount}}',
  subscriptionCharge: 'Addebito abbonamento: {{name}} · {{amount}}',
  invoiceDue: 'Scadenza fattura {{number}}: {{name}} · {{amount}}',
  invoicePaid: 'Pagata: fattura {{number}}, {{name}} · {{amount}}',
  taxDue: 'Scadenza: {{name}}',
  taxDone: 'Presentata: {{name}}',
};

const sk: CalendarFeedLabels = {
  calendarName: 'Peňažné termíny',
  payableDue: 'Zaplatiť {{name}} · {{amount}}',
  payablePaid: 'Zaplatené: {{name}} · {{amount}}',
  receivableDue: 'Očakáva sa od {{name}} · {{amount}}',
  receivablePaid: 'Prijaté od {{name}} · {{amount}}',
  subscriptionCharge: 'Platba za predplatné: {{name}} · {{amount}}',
  invoiceDue: 'Splatnosť faktúry {{number}}: {{name}} · {{amount}}',
  invoicePaid: 'Zaplatené: faktúra {{number}}, {{name}} · {{amount}}',
  taxDue: 'Termín: {{name}}',
  taxDone: 'Podané: {{name}}',
};

const ja: CalendarFeedLabels = {
  calendarName: 'お金の予定',
  payableDue: '支払い：{{name}} · {{amount}}',
  payablePaid: '支払済み：{{name}} · {{amount}}',
  receivableDue: '{{name}} から入金予定 · {{amount}}',
  receivablePaid: '{{name}} から入金済み · {{amount}}',
  subscriptionCharge: 'サブスクリプションの請求：{{name}} · {{amount}}',
  invoiceDue: '請求書 {{number}} の期日：{{name}} · {{amount}}',
  invoicePaid: '支払済み：請求書 {{number}}、{{name}} · {{amount}}',
  taxDue: '期限：{{name}}',
  taxDone: '提出済み：{{name}}',
};

const ko: CalendarFeedLabels = {
  calendarName: '돈 관련 일정',
  payableDue: '{{name}} 결제 · {{amount}}',
  payablePaid: '결제됨: {{name}} · {{amount}}',
  receivableDue: '{{name}}에게서 받을 예정 · {{amount}}',
  receivablePaid: '{{name}}에게서 받음 · {{amount}}',
  subscriptionCharge: '구독 결제: {{name}} · {{amount}}',
  invoiceDue: '청구서 {{number}} 기한: {{name}} · {{amount}}',
  invoicePaid: '결제됨: 청구서 {{number}}, {{name}} · {{amount}}',
  taxDue: '기한: {{name}}',
  taxDone: '신고됨: {{name}}',
};

const hi: CalendarFeedLabels = {
  calendarName: 'पैसों की तारीखें',
  payableDue: '{{name}} को भुगतान करें · {{amount}}',
  payablePaid: 'भुगतान हुआ: {{name}} · {{amount}}',
  receivableDue: '{{name}} से अपेक्षित · {{amount}}',
  receivablePaid: '{{name}} से प्राप्त · {{amount}}',
  subscriptionCharge: 'सदस्यता शुल्क: {{name}} · {{amount}}',
  invoiceDue: 'इनवॉइस {{number}} की नियत तारीख: {{name}} · {{amount}}',
  invoicePaid: 'भुगतान हुआ: इनवॉइस {{number}}, {{name}} · {{amount}}',
  taxDue: 'अंतिम तिथि: {{name}}',
  taxDone: 'दाखिल: {{name}}',
};

const nl: CalendarFeedLabels = {
  calendarName: 'Geldmomenten',
  payableDue: '{{name}} betalen · {{amount}}',
  payablePaid: 'Betaald: {{name}} · {{amount}}',
  receivableDue: 'Verwacht van {{name}} · {{amount}}',
  receivablePaid: 'Ontvangen van {{name}} · {{amount}}',
  subscriptionCharge: 'Abonnementsafschrijving: {{name}} · {{amount}}',
  invoiceDue: 'Factuur {{number}} vervalt: {{name}} · {{amount}}',
  invoicePaid: 'Betaald: factuur {{number}}, {{name}} · {{amount}}',
  taxDue: 'Uiterlijk: {{name}}',
  taxDone: 'Ingediend: {{name}}',
};

const sv: CalendarFeedLabels = {
  calendarName: 'Pengadatum',
  payableDue: 'Betala {{name}} · {{amount}}',
  payablePaid: 'Betald: {{name}} · {{amount}}',
  receivableDue: 'Väntas från {{name}} · {{amount}}',
  receivablePaid: 'Mottaget från {{name}} · {{amount}}',
  subscriptionCharge: 'Prenumerationsdragning: {{name}} · {{amount}}',
  invoiceDue: 'Faktura {{number}} förfaller: {{name}} · {{amount}}',
  invoicePaid: 'Betald: faktura {{number}}, {{name}} · {{amount}}',
  taxDue: 'Senast: {{name}}',
  taxDone: 'Inlämnad: {{name}}',
};

const vi: CalendarFeedLabels = {
  calendarName: 'Ngày tiền bạc',
  payableDue: 'Thanh toán {{name}} · {{amount}}',
  payablePaid: 'Đã thanh toán: {{name}} · {{amount}}',
  receivableDue: 'Chờ nhận từ {{name}} · {{amount}}',
  receivablePaid: 'Đã nhận từ {{name}} · {{amount}}',
  subscriptionCharge: 'Phí gói đăng ký: {{name}} · {{amount}}',
  invoiceDue: 'Hạn hóa đơn {{number}}: {{name}} · {{amount}}',
  invoicePaid: 'Đã thanh toán: hóa đơn {{number}}, {{name}} · {{amount}}',
  taxDue: 'Hạn nộp: {{name}}',
  taxDone: 'Đã nộp: {{name}}',
};

const id: CalendarFeedLabels = {
  calendarName: 'Tanggal keuangan',
  payableDue: 'Bayar {{name}} · {{amount}}',
  payablePaid: 'Lunas: {{name}} · {{amount}}',
  receivableDue: 'Diharapkan dari {{name}} · {{amount}}',
  receivablePaid: 'Diterima dari {{name}} · {{amount}}',
  subscriptionCharge: 'Tagihan langganan: {{name}} · {{amount}}',
  invoiceDue: 'Jatuh tempo faktur {{number}}: {{name}} · {{amount}}',
  invoicePaid: 'Lunas: faktur {{number}}, {{name}} · {{amount}}',
  taxDue: 'Batas waktu: {{name}}',
  taxDone: 'Dilaporkan: {{name}}',
};

const da: CalendarFeedLabels = {
  calendarName: 'Pengedatoer',
  payableDue: 'Betal {{name}} · {{amount}}',
  payablePaid: 'Betalt: {{name}} · {{amount}}',
  receivableDue: 'Forventet fra {{name}} · {{amount}}',
  receivablePaid: 'Modtaget fra {{name}} · {{amount}}',
  subscriptionCharge: 'Abonnementstræk: {{name}} · {{amount}}',
  invoiceDue: 'Faktura {{number}} forfalder: {{name}} · {{amount}}',
  invoicePaid: 'Betalt: faktura {{number}}, {{name}} · {{amount}}',
  taxDue: 'Frist: {{name}}',
  taxDone: 'Indsendt: {{name}}',
};

const nb: CalendarFeedLabels = {
  calendarName: 'Pengedatoer',
  payableDue: 'Betal {{name}} · {{amount}}',
  payablePaid: 'Betalt: {{name}} · {{amount}}',
  receivableDue: 'Ventet fra {{name}} · {{amount}}',
  receivablePaid: 'Mottatt fra {{name}} · {{amount}}',
  subscriptionCharge: 'Abonnementstrekk: {{name}} · {{amount}}',
  invoiceDue: 'Faktura {{number}} forfaller: {{name}} · {{amount}}',
  invoicePaid: 'Betalt: faktura {{number}}, {{name}} · {{amount}}',
  taxDue: 'Frist: {{name}}',
  taxDone: 'Levert: {{name}}',
};

const nn: CalendarFeedLabels = {
  calendarName: 'Pengedatoar',
  payableDue: 'Betal {{name}} · {{amount}}',
  payablePaid: 'Betalt: {{name}} · {{amount}}',
  receivableDue: 'Venta frå {{name}} · {{amount}}',
  receivablePaid: 'Motteke frå {{name}} · {{amount}}',
  subscriptionCharge: 'Abonnementstrekk: {{name}} · {{amount}}',
  invoiceDue: 'Faktura {{number}} forfell: {{name}} · {{amount}}',
  invoicePaid: 'Betalt: faktura {{number}}, {{name}} · {{amount}}',
  taxDue: 'Frist: {{name}}',
  taxDone: 'Levert: {{name}}',
};

const fi: CalendarFeedLabels = {
  calendarName: 'Rahapäivät',
  payableDue: 'Maksa {{name}} · {{amount}}',
  payablePaid: 'Maksettu: {{name}} · {{amount}}',
  receivableDue: 'Odotetaan: {{name}} · {{amount}}',
  receivablePaid: 'Saatu: {{name}} · {{amount}}',
  subscriptionCharge: 'Tilausveloitus: {{name}} · {{amount}}',
  invoiceDue: 'Lasku {{number}} erääntyy: {{name}} · {{amount}}',
  invoicePaid: 'Maksettu: lasku {{number}}, {{name}} · {{amount}}',
  taxDue: 'Määräpäivä: {{name}}',
  taxDone: 'Jätetty: {{name}}',
};

const is: CalendarFeedLabels = {
  calendarName: 'Peningadagsetningar',
  payableDue: 'Greiða {{name}} · {{amount}}',
  payablePaid: 'Greitt: {{name}} · {{amount}}',
  receivableDue: 'Væntanlegt frá {{name}} · {{amount}}',
  receivablePaid: 'Móttekið frá {{name}} · {{amount}}',
  subscriptionCharge: 'Áskriftargjald: {{name}} · {{amount}}',
  invoiceDue: 'Gjalddagi reiknings {{number}}: {{name}} · {{amount}}',
  invoicePaid: 'Greitt: reikningur {{number}}, {{name}} · {{amount}}',
  taxDue: 'Frestur: {{name}}',
  taxDone: 'Skilað: {{name}}',
};

const fo: CalendarFeedLabels = {
  calendarName: 'Peningadagfestingar',
  payableDue: 'Gjalda {{name}} · {{amount}}',
  payablePaid: 'Goldið: {{name}} · {{amount}}',
  receivableDue: 'Væntað frá {{name}} · {{amount}}',
  receivablePaid: 'Móttikið frá {{name}} · {{amount}}',
  subscriptionCharge: 'Haldaragjald: {{name}} · {{amount}}',
  invoiceDue: 'Gjalddagur fyri rokning {{number}}: {{name}} · {{amount}}',
  invoicePaid: 'Goldið: rokning {{number}}, {{name}} · {{amount}}',
  taxDue: 'Freist: {{name}}',
  taxDone: 'Latið inn: {{name}}',
};

const cs: CalendarFeedLabels = {
  calendarName: 'Peněžní termíny',
  payableDue: 'Zaplatit {{name}} · {{amount}}',
  payablePaid: 'Zaplaceno: {{name}} · {{amount}}',
  receivableDue: 'Očekáváno od {{name}} · {{amount}}',
  receivablePaid: 'Přijato od {{name}} · {{amount}}',
  subscriptionCharge: 'Platba předplatného: {{name}} · {{amount}}',
  invoiceDue: 'Splatnost faktury {{number}}: {{name}} · {{amount}}',
  invoicePaid: 'Zaplaceno: faktura {{number}}, {{name}} · {{amount}}',
  taxDue: 'Termín: {{name}}',
  taxDone: 'Podáno: {{name}}',
};

const bg: CalendarFeedLabels = {
  calendarName: 'Парични дати',
  payableDue: 'Плащане: {{name}} · {{amount}}',
  payablePaid: 'Платено: {{name}} · {{amount}}',
  receivableDue: 'Очаква се от {{name}} · {{amount}}',
  receivablePaid: 'Получено от {{name}} · {{amount}}',
  subscriptionCharge: 'Такса за абонамент: {{name}} · {{amount}}',
  invoiceDue: 'Падеж на фактура {{number}}: {{name}} · {{amount}}',
  invoicePaid: 'Платено: фактура {{number}}, {{name}} · {{amount}}',
  taxDue: 'Срок: {{name}}',
  taxDone: 'Подадено: {{name}}',
};

const hr: CalendarFeedLabels = {
  calendarName: 'Novčani datumi',
  payableDue: 'Platiti {{name}} · {{amount}}',
  payablePaid: 'Plaćeno: {{name}} · {{amount}}',
  receivableDue: 'Očekuje se od {{name}} · {{amount}}',
  receivablePaid: 'Primljeno od {{name}} · {{amount}}',
  subscriptionCharge: 'Naplata pretplate: {{name}} · {{amount}}',
  invoiceDue: 'Dospijeće računa {{number}}: {{name}} · {{amount}}',
  invoicePaid: 'Plaćeno: račun {{number}}, {{name}} · {{amount}}',
  taxDue: 'Rok: {{name}}',
  taxDone: 'Predano: {{name}}',
};

const sr: CalendarFeedLabels = {
  calendarName: 'Новчани датуми',
  payableDue: 'Платити {{name}} · {{amount}}',
  payablePaid: 'Плаћено: {{name}} · {{amount}}',
  receivableDue: 'Очекује се од {{name}} · {{amount}}',
  receivablePaid: 'Примљено од {{name}} · {{amount}}',
  subscriptionCharge: 'Наплата претплате: {{name}} · {{amount}}',
  invoiceDue: 'Доспеће рачуна {{number}}: {{name}} · {{amount}}',
  invoicePaid: 'Плаћено: рачун {{number}}, {{name}} · {{amount}}',
  taxDue: 'Рок: {{name}}',
  taxDone: 'Предато: {{name}}',
};

const sl: CalendarFeedLabels = {
  calendarName: 'Denarni datumi',
  payableDue: 'Plačati {{name}} · {{amount}}',
  payablePaid: 'Plačano: {{name}} · {{amount}}',
  receivableDue: 'Pričakovano od {{name}} · {{amount}}',
  receivablePaid: 'Prejeto od {{name}} · {{amount}}',
  subscriptionCharge: 'Bremenitev naročnine: {{name}} · {{amount}}',
  invoiceDue: 'Zapadlost računa {{number}}: {{name}} · {{amount}}',
  invoicePaid: 'Plačano: račun {{number}}, {{name}} · {{amount}}',
  taxDue: 'Rok: {{name}}',
  taxDone: 'Oddano: {{name}}',
};

const mk: CalendarFeedLabels = {
  calendarName: 'Парични датуми',
  payableDue: 'Плати {{name}} · {{amount}}',
  payablePaid: 'Платено: {{name}} · {{amount}}',
  receivableDue: 'Се очекува од {{name}} · {{amount}}',
  receivablePaid: 'Примено од {{name}} · {{amount}}',
  subscriptionCharge: 'Наплата на претплата: {{name}} · {{amount}}',
  invoiceDue: 'Рок на фактура {{number}}: {{name}} · {{amount}}',
  invoicePaid: 'Платено: фактура {{number}}, {{name}} · {{amount}}',
  taxDue: 'Рок: {{name}}',
  taxDone: 'Поднесено: {{name}}',
};

const be: CalendarFeedLabels = {
  calendarName: 'Грашовыя даты',
  payableDue: 'Аплаціць: {{name}} · {{amount}}',
  payablePaid: 'Аплачана: {{name}} · {{amount}}',
  receivableDue: 'Чакаецца ад {{name}} · {{amount}}',
  receivablePaid: 'Атрымана ад {{name}} · {{amount}}',
  subscriptionCharge: 'Спісанне падпіскі: {{name}} · {{amount}}',
  invoiceDue: 'Тэрмін аплаты рахунку {{number}}: {{name}} · {{amount}}',
  invoicePaid: 'Аплачана: рахунак {{number}}, {{name}} · {{amount}}',
  taxDue: 'Тэрмін падачы: {{name}}',
  taxDone: 'Пададзена: {{name}}',
};

const bs: CalendarFeedLabels = {
  calendarName: 'Novčani datumi',
  payableDue: 'Platiti {{name}} · {{amount}}',
  payablePaid: 'Plaćeno: {{name}} · {{amount}}',
  receivableDue: 'Očekuje se od {{name}} · {{amount}}',
  receivablePaid: 'Primljeno od {{name}} · {{amount}}',
  subscriptionCharge: 'Naplata pretplate: {{name}} · {{amount}}',
  invoiceDue: 'Dospijeće fakture {{number}}: {{name}} · {{amount}}',
  invoicePaid: 'Plaćeno: faktura {{number}}, {{name}} · {{amount}}',
  taxDue: 'Rok: {{name}}',
  taxDone: 'Predano: {{name}}',
};

const hsb: CalendarFeedLabels = {
  calendarName: 'Pjenježne terminy',
  payableDue: '{{name}} zapłaćić · {{amount}}',
  payablePaid: 'Zapłaćene: {{name}} · {{amount}}',
  receivableDue: 'Wočakuje so wot {{name}} · {{amount}}',
  receivablePaid: 'Dóstate wot {{name}} · {{amount}}',
  subscriptionCharge: 'Wotknihowanje abonementa: {{name}} · {{amount}}',
  invoiceDue: 'Termin zličbowanki {{number}}: {{name}} · {{amount}}',
  invoicePaid: 'Zapłaćene: zličbowanka {{number}}, {{name}} · {{amount}}',
  taxDue: 'Termin: {{name}}',
  taxDone: 'Zapodate: {{name}}',
};

const CALENDAR_FEED_LABELS: Record<string, CalendarFeedLabels> = {
  ru,
  en,
  kk,
  de,
  fr,
  es,
  pt,
  tr,
  uk,
  zh,
  pl,
  it,
  sk,
  ja,
  ko,
  hi,
  nl,
  sv,
  vi,
  id,
  da,
  nb,
  nn,
  fi,
  is,
  fo,
  cs,
  bg,
  hr,
  sr,
  sl,
  mk,
  be,
  bs,
  hsb,
};

/** The labels in `locale`, English when the language is not one of ours. */
export function calendarFeedLabels(locale: string | null | undefined): CalendarFeedLabels {
  return CALENDAR_FEED_LABELS[locale ?? ''] ?? CALENDAR_FEED_LABELS.en;
}
