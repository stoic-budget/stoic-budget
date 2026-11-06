import type { StoicTextMap } from './types';

export const sk: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'Mesiac prerástol svoj plán',
      message:
        'Plánovali ste {{plannedAmount}} a minuli ste {{spentAmount}} — o {{percent}}% viac. Plán vznikol s chladnou hlavou; nech hovorí hlasnejšie než okamih.',
    },
    {
      title: 'O {{percent}}% nad tým, čo ste chceli minúť',
      message:
        'Výdavky sú na úrovni {{spentAmount}} oproti plánu {{plannedAmount}}. Pozrite sa, ktorý limit povolil ako prvý — tam je ponaučenie.',
    },
    {
      title: 'Váš plán a váš mesiac sa nezhodujú',
      message:
        'Minuté: {{spentAmount}}, zamýšľané: {{plannedAmount}}. Buď plán žiadal od reality príliš málo, alebo realita od vás príliš veľa — pokojne rozhodnite, čo z toho.',
    },
    {
      title: 'Odišlo viac, než ste dovolili',
      message:
        'Mesiac je o {{percent}}% nad sumou {{plannedAmount}}, ktorú ste stanovili. Zastavením teraz nič nestratíte; predstieraním, že sa nič nestalo, veľa.',
    },
    {
      title: 'Hranicu ste stanovili aj prekročili',
      message:
        'Chceli ste minúť {{plannedAmount}}; je to {{spentAmount}}. Vláda nad sebou neznamená nikdy nezakopnúť — ale všimnúť si to včas a vrátiť sa na cestu.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Zábava berie viac, než ste plánovali',
      message:
        'Chceli ste, aby zábava tvorila {{planned}}% výdavkov; vyšla na {{actual}}%. Pôžitok je vítaný ako hosť, nie ako pán domu.',
    },
    {
      title: 'Zábava {{actual}}%, plán {{planned}}%',
      message:
        'Odpočinok si zaslúži svoje miesto, keď vás obnovuje. Spýtajte sa, ktoré z radostí mesiaca to dokázali, a zvyšok bez ľútosti nechajte ísť.',
    },
    {
      title: 'Pohodlie míňa viac než úmysel',
      message:
        'Zábava tvorí {{actual}}% výdavkov oproti {{planned}}%, ktoré ste zvolili. Striedmosť nie je odmietanie pôžitku — je to jeho udržanie v miere, akú ste si určili.',
    },
    {
      title: 'Príjemné vytláča plánované',
      message:
        'Zábave ste v pláne dali {{planned}}% a vzala si {{actual}}%. To, čo si užívate ľahko, si zaslúži druhý pohľad skôr, než sa z toho stane potreba.',
    },
    {
      title: 'Zábava prekročila svoju čiaru',
      message:
        'Na zábavu išlo {{actual}}% mesiaca, zámer bol {{planned}}%. Čiaru ste si nakreslili sami a je na vás ju udržať.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Zábava opäť nad plánom',
      message:
        'Zábava prekročila plán v {{months}} z posledných {{window}} mes. Opakovanie už nie je náhoda, ale zvyk, ktorý stojí za preskúmanie.',
    },
    {
      title: 'Nad plánom zábavy: {{months}} z {{window}} mes.',
      message:
        'Čo sa stane raz, je okolnosť; čo sa opakuje (počet mesiacov: {{months}}), je vznikajúci charakter. Voľte ten charakter zámerne.',
    },
    {
      title: 'To isté zakopnutie, mesiac čo mesiac',
      message:
        'Zábava prekročila plán v {{months}} z {{window}} mes. Buď plán úprimne zvýšte, alebo zmeňte zvyk — žiť medzi tým stojí najviac.',
    },
    {
      title: 'Vzorec, nie pošmyknutie',
      message:
        'V {{months}} z posledných {{window}} mes. si zábava vzala viac, než ste jej dali. Všímajte si chvíľu, keď sa rozhoduje, nielen účet potom.',
    },
    {
      title: 'Zvyk hlasuje proti vášmu plánu',
      message:
        'Zábava prekonala plán v {{months}} z {{window}} mes. Zvyky sa budujú jednou voľbou za druhou; rovnako sa aj rúcajú.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'Cnosť dostáva menej, než ste zamýšľali',
      message:
        'Z rozpočtu ste vyhradili {{planned}}% na zdravie, učenie a podobné; vyšlo to na {{actual}}%. Zámer sa počíta, až keď je vykonaný.',
    },
    {
      title: 'Cnosť: {{actual}}% z plánovaných {{planned}}%',
      message:
        'Peniaze, ktoré ste určili tomu, čo vás robí lepšími, stále čakajú. Nie je lepšia chvíľa, kedy ich dobre minúť, než práve teraz.',
    },
    {
      title: 'Plánované dobro zostáva nevyužité',
      message:
        'Zdravie, vzdelávanie a štedrosť mali dostať {{planned}}% výdavkov; dostali {{actual}}%. Urobte tento týždeň zámerne jedno z nich.',
    },
    {
      title: 'Úmysel bez skutku',
      message:
        'Cnosť tvorí {{actual}}% výdavkov oproti {{planned}}%, ktoré ste zvolili. Čo si ceníme, sa ukazuje v tom, za čo skutočne platíme.',
    },
    {
      title: 'Miesto pre to, na čom záleží',
      message:
        'Na cnosť išlo len {{actual}}%, hoci ste plánovali {{planned}}%. Kniha, prehliadka u lekára, dar niekomu v núdzi — plán už povedal áno.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'Cnosť sa stále odkladá',
      message:
        'Výdavky na zdravie, vzdelávanie a iných sú pod plánom už {{months}} mes. po sebe. Čo stále odkladáte, ste v skutočnosti už odmietli.',
    },
    {
      title: 'Odkladaná cnosť: {{months}} mes.',
      message:
        'Každý mesiac plán urobil miesto pre to, čo vás robí lepšími, a každý mesiac zostalo nevyužité. Čas je jediné, čo nemôžete rozpočtovať dvakrát.',
    },
    {
      title: 'Lepšie ja stále čaká',
      message:
        'Cnosť je pod plánom už {{months}} mes. po sebe. Začnite v malom a naisto, nie vo veľkom a neskôr.',
    },
    {
      title: 'Dobré úmysly starnú',
      message:
        'Už {{months}} mes. dostávajú zdravie, vzdelávanie a štedrosť menej, než ste plánovali. Vyberte jedno a budúci mesiac ho financujte ako prvé, pred všetkým ostatným.',
    },
    {
      title: 'Cnosť stále prehráva s „neskôr“',
      message:
        'Pod plánom už {{months}} mes. po sebe. „Neskôr“ je miesto, kam dobré úmysly odchádzajú, aby sa na ne zabudlo — dajte tomuto dátum.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'Váš plán nemá miesto pre cnosť',
      message:
        'Žiadny z vašich rozpočtov neslúži zdraviu, vzdelávaniu ani iným. Plán ukazuje, čo si ceníme — zvážte, či cnosti nedať vlastný riadok.',
    },
    {
      title: 'Rozpočet na všetko, len nie na dobro',
      message:
        'Nevyhnutnosť, práca aj zábava majú limity; cnosť žiadny. Čo sa nikdy neplánuje, sa zvyčajne nikdy nestane.',
    },
    {
      title: 'Plánujte to, čo vás robí lepšími',
      message:
        'V triede cnosť zatiaľ nie je žiadny rozpočet. Aj malý — knihy, šport, dar — mení želanie na záväzok.',
    },
    {
      title: 'Plán o cnosti mlčí',
      message:
        'Rozpočtujete to, čo musíte, a to, čo vás teší, no ešte nie to, kým sa chcete stať. Jeden skromný rozpočet na cnosť by to zmenil.',
    },
    {
      title: 'Cnosť nemá rozpočet',
      message:
        'Výdavky na zdravie, vzdelávanie či iných nie sú nikde naplánované. Vyberte si jedno a dajte mu limit, ktorý by ste radi dosiahli.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'Nevyhnutnosti stoja viac, než ste plánovali',
      message:
        'Na nevyhnutnosti ste plánovali {{planned}}% výdavkov; berú {{actual}}%. Overte, či je každá z nich stále potrebou, alebo sa potichu zmenila na pohodlie.',
    },
    {
      title: 'Nevyhnutnosť {{actual}}%, plán {{planned}}%',
      message:
        'To, čo život vyžaduje, je zvyčajne menej, než na čo si zvykneme. Pozrite sa na najväčšiu nevyhnutnosť novými očami.',
    },
    {
      title: 'Základné výdavky sa nafukujú',
      message:
        'Nevyhnutnosti tvoria {{actual}}% mesiaca oproti očakávaným {{planned}}%. Potreba, ktorá stále rastie, si zaslúži otázku.',
    },
    {
      title: 'Potreby prerastajú plán',
      message:
        'Plán {{planned}}%, skutočnosť {{actual}}%. Buď plán podcenil skutočné náklady, alebo niektoré túžby cestujú pod menom potrieb.',
    },
    {
      title: 'Viac na „musím“, než ste chceli',
      message:
        'Nevyhnutnosti zabrali {{actual}}% výdavkov namiesto {{planned}}%. Oddeľte, čo naozaj musí byť, od toho, čo len vždy bolo.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'Nevyhnutnosti sa plazia nahor',
      message:
        'Výdavky na nevyhnutnosti rastú už {{months}} mes. po sebe, spolu o {{percent}}%. Potreby rastú potichu, keď od nich nikto nežiada zdôvodnenie.',
    },
    {
      title: '+{{percent}}% na nevyhnutnosti za {{months}} mes.',
      message:
        'Každý krok vyzeral malý; spolu malé nie sú. Vezmite najväčšiu opakovanú nevyhnutnosť a opýtajte sa, či musí stále stáť toľko.',
    },
    {
      title: 'Dno vašich výdavkov stúpa',
      message:
        'Nevyhnutnosti rástli {{months}} mes. po sebe (+{{percent}}%). Stúpajúce dno necháva menej miesta pre všetko, čo si volíte slobodne.',
    },
    {
      title: 'Potreby sa rozťahujú',
      message:
        'Rast počas {{months}} mes., spolu {{percent}}%. Stoická skúška je jednoduchá: vybrali by ste si to dnes znova, keď poznáte cenu?',
    },
    {
      title: 'Malé nárasty, stály smer',
      message:
        'Nevyhnutnosti stúpli o {{percent}}% za {{months}} mes. Smer je dôležitejší než ktorýkoľvek mesiac — tento sa oplatí opraviť včas.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'Práca stojí viac, než ste plánovali',
      message:
        'Na prácu ste plánovali {{planned}}% výdavkov; berie {{actual}}%. Nástroje a služby by si mali na seba zarobiť — overte, ktoré to robia.',
    },
    {
      title: 'Výdavky na prácu {{actual}}%, plán {{planned}}%',
      message:
        'Investícia do práce je dobrá, keď niečo vracia. Prejdite si, za čo platíte, no už nepoužívate.',
    },
    {
      title: 'Rozpočet na prácu je napnutý',
      message:
        'Práca zabrala {{actual}}% namiesto {{planned}}%. Usilovnosť znamená robiť prácu dobre, nie kupovať na ňu každý nástroj.',
    },
    {
      title: 'Nástroje míňajú nad plán',
      message:
        'Plán {{planned}}%, na prácu minuté {{actual}}%. Pri každom výdavku sa pýtajte: pomáha mi pracovať, alebo len pôsobí ako pokrok?',
    },
    {
      title: 'Náklady na prácu sa posunuli',
      message:
        'Práca tvorí {{actual}}% výdavkov oproti zamýšľaným {{planned}}%. Rýchla kontrola teraz ušetrí väčšiu neskôr.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '„{{category}}“ opäť prekračuje limit',
      message:
        '„{{category}}“ prekročila rozpočet v {{months}} z posledných {{window}} mes. Chybný je buď limit, alebo túžba — rozhodnite, ktoré.',
    },
    {
      title: '„{{category}}“: nad rozpočtom {{months}} z {{window}} mes.',
      message:
        'Limit, ktorý sa vždy prekročí, nie je limit, len želanie. Urobte ho úprimným — zvýšte ho zámerne, alebo ho zámerne držte.',
    },
    {
      title: 'Ten istý rozpočet opäť povolil',
      message:
        '„{{category}}“ prekročila limit v {{months}} z {{window}} mes. Opakovanie je informácia; využite ju.',
    },
    {
      title: '„{{category}}“ žiada vašu pozornosť',
      message:
        'Nad rozpočtom v {{months}} z {{window}} mes. Sledujte chvíľu pred nákupom — iba tam sa dá zvyk zmeniť.',
    },
    {
      title: 'Vzorec v kategórii „{{category}}“',
      message:
        'Prekročenia: {{months}} za {{window}} mes. Čo opakujeme, tým sa stávame; rozhodnite, čo má táto kategória o vás hovoriť.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '„{{category}}“ sa minie do {{day}}. dňa',
      message:
        'Minuli ste {{spentAmount}} z {{limitAmount}} a týmto tempom sa limit skončí okolo {{day}}. dňa. Spomaliť teraz je ľahšie než zastaviť neskôr.',
    },
    {
      title: '„{{category}}“ predbieha mesiac',
      message:
        'Z limitu {{limitAmount}} je už preč {{spentAmount}}. Týmto tempom sa vyčerpá do {{day}}. dňa — zvyšok mesiaca je stále vo vašich rukách.',
    },
    {
      title: 'Kontrola tempa: „{{category}}“',
      message:
        'Rozpočet {{limitAmount}} vydrží pri súčasnom tempe približne do {{day}}. dňa. Predvídavosť je najlacnejší druh disciplíny.',
    },
    {
      title: '„{{category}}“ míňa budúcnosť',
      message:
        'Minuté {{spentAmount}} z {{limitAmount}}; limit sa skončí okolo {{day}}. dňa. To, čo urobíte tento týždeň, rozhodne, či sa to stane.',
    },
    {
      title: 'Včasné varovanie pre „{{category}}“',
      message:
        'Pri súčasnom tempe limit {{limitAmount}} nevydrží do konca mesiaca — minie sa okolo {{day}}. dňa. Upravte to, kým to stojí málo.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '„{{category}}“ zostáva nevyužitá',
      message:
        'Rozpočet „{{category}}“ nemá žiadne výdavky už {{months}} mes. Buď ste z neho vyrástli, alebo je to úmysel, ktorý stále čaká — rozhodnite, čo z toho.',
    },
    {
      title: 'Prázdny rozpočet: „{{category}}“',
      message:
        'Bez jediného výdavku: {{months}} mes. Plán by mal opisovať život, ktorý žijete, alebo ten, ktorý budujete — ktorý je toto?',
    },
    {
      title: '„{{category}}“ stojí nečinne',
      message:
        'Nič tu nebolo minuté už {{months}} mes. Ak to bola zdržanlivosť, výborne; ak zanedbanie, konajte.',
    },
    {
      title: 'Naplánované, no nežité',
      message:
        '„{{category}}“ má limit a žiadne výdavky už {{months}} mes. Udržte plán pravdivý: odstráňte ho, alebo ho využite.',
    },
    {
      title: '„{{category}}“: tiché mesiace ({{months}})',
      message:
        'Rozpočet, ktorý sa nikdy nepoužije, aj tak zaberá miesto vo vašom pláne. Uvoľnite miesto, alebo naplňte úmysel.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}}% výdavkov nemá limit',
      message:
        '{{unbudgetedAmount}} z mesiaca išlo do kategórií, ktoré žiadny rozpočet nestráži. Na čo ste sa nepozreli, to nemôžete posúdiť.',
    },
    {
      title: 'Veľká časť mesiaca je neplánovaná',
      message:
        '{{percent}}% výdavkov — {{unbudgetedAmount}} — je mimo všetkých rozpočtov. Dajte najväčšej časti limit a plán uvidí viac z vášho života.',
    },
    {
      title: 'Výdavky mimo plánu',
      message:
        'Rozpočty pokrývajú len časť toho, čo míňate; {{unbudgetedAmount}} ({{percent}}%) zostáva nemerané. Rozšírte plán tam, kam peniaze naozaj idú.',
    },
    {
      title: 'Plán vidí len časť obrazu',
      message:
        '{{percent}}% výdavkov mesiaca nemá rozpočet. Jasný pohľad predchádza dobrému úsudku.',
    },
    {
      title: '{{unbudgetedAmount}} minuté bez limitu',
      message:
        'To je {{percent}}% mesiaca. Nemusíte to obmedzovať — len rozhodnite, koľko z toho naozaj chcete.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '„{{category}}“ je väčšina vašej zábavy',
      message:
        '{{percent}}% výdavkov na zábavu išlo do kategórie „{{category}}“. Užívajte si, ale overte, že by ste sa od toho vedeli odvrátiť.',
    },
    {
      title: 'Jeden pôžitok dominuje',
      message:
        '„{{category}}“ berie {{percent}}% všetkého, čo ste minuli na zábavu. Opýtajte sa, či vás to ešte teší, alebo sa z toho stala rutina.',
    },
    {
      title: 'Zábava sa opiera o „{{category}}“',
      message:
        '{{percent}}% zábavy na jednom mieste. Čo nevieme postrádať, to nás drží — skontrolujte, či je ten stisk stále ľahký.',
    },
    {
      title: '„{{category}}“: {{percent}}% zábavy',
      message:
        'Jediný zdroj radosti si berie takmer všetko. Skúste to na čas oželieť a uvidíte, čo vám naozaj dáva.',
    },
    {
      title: 'Váš oddych má jednu adresu',
      message:
        'Väčšina peňazí na zábavu, {{percent}}%, ide do kategórie „{{category}}“. Od pôžitku ste slobodní len vtedy, ak by ste sa bez neho zaobišli.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Časť výdavkov ešte nie je posúdená',
      message:
        'Kategórie bez triedy: {{count}}. V Rozpočtoch rozhodnite, čo je nevyhnutnosť, práca, cnosť a čo zábava.',
    },
    {
      title: 'Kategórie čakajúce na váš úsudok: {{count}}',
      message:
        'Majú výdavky, ale žiadnu triedu, takže ich rada nemôže zvážiť. Minúta v Rozpočtoch to vyrieši.',
    },
    {
      title: 'Pomenujte, čomu slúžia vaše peniaze',
      message:
        'Stále nezaradené kategórie: {{count}}. Úsudok začína tým, že veci voláme správnymi menami.',
    },
    {
      title: 'Neposúdené výdavky — kategórie: {{count}}',
      message:
        'Je to potreba, vaša práca, cnosť alebo pôžitok? To môžete povedať len vy — a plán sa tým vyjasní.',
    },
    {
      title: 'Niekoľko kategórií nemá triedu',
      message:
        'Kategórie mimo štyroch tried: {{count}}. Zaraďte ich v Rozpočtoch, aby bol každý výdavok videný taký, aký je.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: 'Drobné nákupy – {{merchant}}: {{count}}',
      message:
        'Každý nákup sa zdal nepatrný; spolu za mesiac vyšli na {{totalAmount}}. V malých, neskúmaných zvykoch potichu mizne najviac peňazí.',
    },
    {
      title: '{{merchant}}: {{count}}-krát za mesiac',
      message:
        '{{totalAmount}} v drobných sumách. Spýtajte sa, či bola každá návšteva voľbou, alebo reflexom: len prvé je sloboda.',
    },
    {
      title: 'Kúsok po kúsku: {{totalAmount}}',
      message:
        'Nákupy – {{merchant}}: {{count}}. Na žiadnom jednotlivom nezáleží; záleží na zvyku. Rozhodnite, ako často ho naozaj chcete.',
    },
    {
      title: 'Zvyk: {{merchant}}',
      message:
        '{{count}} nákupov, spolu {{totalAmount}}. Skúste každý tretí vynechať a uvidíte, či vám bude chýbať.',
    },
    {
      title: 'Drobnosti sa sčítavajú',
      message:
        '{{merchant}}: {{count}}× za {{totalAmount}}. Vláda nad veľkými rozhodnutiami stojí na malých, ako sú tieto.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Víkendy nesú {{percent}}% zábavy',
      message:
        'Väčšina vašich výdavkov na zábavu pripadá na sobotu a nedeľu. Oddych je dobrý; overte si, že je to oddych, a nie náhrada za týždeň.',
    },
    {
      title: 'Zábava žije cez víkend',
      message:
        '{{percent}}% výdavkov na zábavu pripadá na víkendy. Naplánujte si víkend aspoň trochu a bude stáť menej a dá viac.',
    },
    {
      title: 'Víkend míňa za celý týždeň',
      message:
        'Víkendy berú {{percent}}% toho, čo míňate na zábavu. Ak treba týždeň každú sobotu opravovať, pozrite sa na týždeň.',
    },
    {
      title: 'Sobota a nedeľa: {{percent}}% zábavy',
      message:
        'Voľné dni lákajú k voľnému míňaniu. Pred víkendom rozhodnite, na čo je, a peniaze nech nasledujú.',
    },
    {
      title: 'Víkendový vzorec',
      message:
        '{{percent}}% výdavkov na zábavu pripadá na víkendy. Pokoj počas pracovných dní často zlacní víkendy.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}}: {{percent}}% mesiaca',
      message:
        'Jednému obchodníkovi išlo na zábavu {{totalAmount}}. Keď má jedno miesto toľko vašich peňazí, opýtajte sa, koľko má aj z vašej pozornosti.',
    },
    {
      title: 'Jedno miesto, {{totalAmount}}',
      message:
        '{{merchant}} tvorí {{percent}}% výdavkov mesiaca. Stojí za taký diel práce vášho života?',
    },
    {
      title: '{{merchant}} vedie vaše výdavky',
      message:
        '{{percent}}% mesiaca — {{totalAmount}} — išlo tam. Nie je nič zlé na tom tešiť sa z toho, pokiaľ by ste si to vybrali znova.',
    },
    {
      title: 'Veľký podiel: {{merchant}}',
      message:
        '{{totalAmount}}, teda {{percent}}% výdavkov, na jednom mieste zábavy. Pokojne zvážte pôžitok oproti cene.',
    },
    {
      title: '{{percent}}% – {{merchant}}',
      message:
        'Tento jediný obchodník si vzal {{totalAmount}}. Sloboda je môcť ho obísť, keď sa tak rozhodnete.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Príjem klesol, výdavky nie',
      message:
        'Príjem klesol o {{percent}}% na {{incomeAmount}}, no výdavky zostali na {{expenseAmount}}. Šťastena si to rozmyslela; vaše výdavky si to ešte nevšimli.',
    },
    {
      title: 'Príjem nižší o {{percent}}%',
      message:
        'Prišlo {{incomeAmount}}, odišlo {{expenseAmount}}. Čo šťastena dá, môže aj vziať — prispôsobte výdavky tomu, čo je, nie tomu, čo bolo.',
    },
    {
      title: 'Skromnejší mesiac, tie isté zvyky',
      message:
        'Príjem je o {{percent}}% nižší ({{incomeAmount}}), výdavky sa držia na {{expenseAmount}}. Príjem nie je vo vašej moci; reakcia áno.',
    },
    {
      title: 'Šťastena sa obrátila',
      message:
        'Zarobili ste o {{percent}}% menej než zvyčajne, no minuli ste {{expenseAmount}} ako predtým. Škrtajte teraz, kým je to voľba, a nie nutnosť.',
    },
    {
      title: 'Výdavky nenasledovali príjem',
      message:
        'Príjem klesol na {{incomeAmount}} (o {{percent}}%); výdavky sú {{expenseAmount}}. Nastavte plachtu podľa vetra, ktorý naozaj máte.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Predplatné: {{monthlyAmount}} mesačne',
      message:
        'Počet predplatných: {{count}} — spolu {{percent}}% vašich mesačných výdavkov. Každé sa obnovuje bez opýtania — pýtajte sa na každé vy sami.',
    },
    {
      title: '{{percent}}% výdavkov sa obnovuje samo',
      message:
        'Predplatné: {{count}}, {{monthlyAmount}} mesačne. Ponechajte si tie, ktoré by ste si dnes objednali znova.',
    },
    {
      title: 'Tiché, opakované, {{monthlyAmount}}',
      message:
        'Počet predplatných: {{count}}; stoja {{percent}}% vášho mesiaca. Pohodlie je dobrý sluha a drahý pán.',
    },
    {
      title: 'Predplatné na kontrolu: {{count}}',
      message:
        'Spolu {{monthlyAmount}} mesačne, {{percent}}% výdavkov. Zrušte jedno, ktoré takmer nepoužívate, a všimnite si, ako málo vám chýba.',
    },
    {
      title: 'Čo sa obnovuje samo',
      message:
        '{{monthlyAmount}} mesačne za predplatné (počet: {{count}}). Automatické míňanie si zaslúži zámernú kontrolu.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Váš úspech môže siahať o kúsok ďalej',
      message:
        'Za {{months}} mes. ste si ponechali {{savingsPercent}}% príjmu, no k iným nešlo takmer nič. Bohatstvo sa najlepšie drží v otvorených rukách — čo tak tento mesiac jeden dar alebo príspevok?',
    },
    {
      title: 'Dobre zarábate, málo dávate',
      message:
        'Príjem za {{months}} mes.: {{incomeAmount}}, iným: {{givenAmount}}. Ak pomáhate spôsobom, ktorý táto aplikácia nevidí, nevšímajte si to; ak nie, v pláne je na to miesto.',
    },
    {
      title: 'Dobrý čas na štedrosť',
      message:
        'Ušetrili ste {{savingsPercent}}% príjmu — znak pevnej ruky. Malá časť z toho, daná niekomu, kto ju potrebuje, by tej pevnosti dala väčší zmysel.',
    },
    {
      title: 'Na obraze zatiaľ nikto iný',
      message:
        'Posledné obdobie ({{months}} mes.) ukazuje starostlivé zarábanie a sporenie, ale žiadnu charitu ani dary. Sme stvorení jeden pre druhého; na začiatok stačí skromný dar.',
    },
    {
      title: 'Priestor pre láskavosť',
      message:
        'Na pomoc iným išla len suma {{givenAmount}} z {{incomeAmount}}. Zvážte malý pravidelný príspevok — štedrosť sa zvykom stáva ľahšou, ako každá cnosť.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '„{{goal}}“ zaostáva',
      message:
        'Potrebuje {{requiredAmount}} mesačne a vy vkladáte asi {{paceAmount}}. Týmto tempom dorazí o {{monthsLate}} mes. neskôr. Tempo je vo vašej moci.',
    },
    {
      title: '„{{goal}}“: oneskorenie {{monthsLate}} mes. pri tomto tempe',
      message:
        'Potrebné {{requiredAmount}} mesačne, skutočne asi {{paceAmount}}. Posuňte termín úprimne, alebo zámerne presuňte viac peňazí.',
    },
    {
      title: 'Cieľ a tempo sa nezhodujú',
      message:
        '„{{goal}}“ žiada {{requiredAmount}} mesačne; dostáva {{paceAmount}}. Cieľ je len taký skutočný ako mesačný krok k nemu.',
    },
    {
      title: '„{{goal}}“ potrebuje pevnejší krok',
      message:
        '{{paceAmount}} mesačne oproti potrebným {{requiredAmount}}. Budúci mesiac zaplaťte cieľu ako prvému, pred čímkoľvek voliteľným.',
    },
    {
      title: 'Cieľ „{{goal}}“ zaostáva',
      message:
        'Súčasné tempo ({{paceAmount}} mesačne) ho zdržiava o {{monthsLate}} mes. Vo vašej moci je ďalší krok, nie celá cesta.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '„{{goal}}“ sa nezmestí do plánu',
      message:
        'Potrebuje {{requiredAmount}} mesačne, no po rozpočtoch zostáva voľných len {{freeAmount}}. Zmeňte termín, cieľovú sumu alebo rozpočty — nádej nie je plán.',
    },
    {
      title: '„{{goal}}“ žiada viac, než máte voľné',
      message:
        'Potrebné každý mesiac: {{requiredAmount}}, k dispozícii: {{freeAmount}}. Kto chce všetko naraz, nedosiahne nič; vyberte si.',
    },
    {
      title: 'Čísla hovoria nie — zatiaľ',
      message:
        '„{{goal}}“ potrebuje {{requiredAmount}} mesačne; vaša voľná hotovosť je {{freeAmount}}. Upravte, čo je vo vašej moci: termín alebo ostatné limity.',
    },
    {
      title: '„{{goal}}“ si žiada rozhodnutie',
      message:
        'Pri {{requiredAmount}} mesačne prevyšuje {{freeAmount}}, ktoré zostáva po rozpočtoch. Cieľ zvolený s otvorenými očami je lepší než cieľ držaný zbožným želaním.',
    },
    {
      title: 'Nemožné tempo pre „{{goal}}“',
      message:
        'Potrebné {{requiredAmount}} mesačne, voľné {{freeAmount}}. Poctivá aritmetika teraz ušetrí sklamanie neskôr.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Zostatok klesne pod nulu: {{date}}',
      message:
        'Pri súčasnom chode príjmov a výdavkov klesne predpokladaný zostatok na {{lowestAmount}}. Pripravte sa teraz, kým je to len predpoveď.',
    },
    {
      title: 'Blíži sa schodok: {{date}}',
      message:
        'Platby a bežné výdavky predbiehajú príjem a zostatok klesne až na {{lowestAmount}}. Predvídaním ťažkostí im berieme moc.',
    },
    {
      title: 'Plánujte na {{date}}',
      message:
        'V ten deň dosiahne predpokladaný zostatok {{lowestAmount}}. Presuňte platbu, odložte túžbu alebo si odložte hotovosť — čokoľvek z toho je dnes vo vašej moci.',
    },
    {
      title: 'Predpoveď klesá pod nulu',
      message: 'Zostatok klesne na {{lowestAmount}} okolo {{date}}. Pokojná odpoveď je tá včasná.',
    },
    {
      title: 'Predvídajte medzeru: {{date}}',
      message:
        'Najnižší predpokladaný zostatok: {{lowestAmount}}. Čo je predvídané, možno prijať s pokojom; čo nás prekvapí, zriedka.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Dodržali ste slovo dané sebe',
      message:
        'Už {{months}} mes. po sebe sa výdavky držia v pláne, ktorý ste si sami stanovili. Takto vyzerá vláda nad sebou.',
    },
    {
      title: 'V pláne: {{months}} mes.',
      message:
        'Mesiac čo mesiac sa to, čo ste zamýšľali, zhoduje s tým, čo ste urobili. Vytrvalosť je tichšia než vôľa a vydrží dlhšie.',
    },
    {
      title: 'Plán a život sa zhodujú',
      message:
        'Už {{months}} mes. po sebe v rámci vašich limitov. Plán dodržiavaný takto dobre už nie je obmedzenie — je to spôsob, akým žijete.',
    },
    {
      title: 'Stabilne už {{months}} mes.',
      message:
        'Vaše rozpočty vydržali {{months}} mes. po sebe. Zachovajte rovnakú pozornosť; funguje.',
    },
    {
      title: 'Disciplína, ktorá vydrží',
      message:
        '{{months}} mes. bez porušenia plánu. Máloco tak oslobodzuje ako dôvera vo vlastné rozhodnutia.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Vaše peniaze nasledujú vaše hodnoty',
      message:
        'Peniaze v službe cnosti tvorili {{actual}}% vašich výdavkov, nie menej než plánovaných {{planned}}%. Dobre minuté.',
    },
    {
      title: 'Cnosť dostala plný podiel',
      message:
        '{{actual}}% na zdravie, vzdelávanie a iných oproti plánovaným {{planned}}%. Za to, čo si ceníte, ste aj zaplatili.',
    },
    {
      title: 'Minuté na to, aby ste boli lepší',
      message:
        'Zdravie, učenie a podobné dostali {{actual}}% výdavkov mesiaca (plánované {{planned}}%). Cnosť sa kúpiť nedá, ale možno jej slúžiť.',
    },
    {
      title: 'Úmysel splnený',
      message:
        'Na cnosť ste plánovali {{planned}}% a minuli {{actual}}%. Dobré úmysly zriedka prežijú mesiac — ten váš prežil.',
    },
    {
      title: 'Najlepšie využitie peňazí',
      message: '{{actual}}% išlo na to, čo robí lepšími vás aj iných. Voľte to naďalej.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Zábava na svojom mieste',
      message:
        'Zábava tvorí {{actual}}% výdavkov, pod vyhradenými {{planned}}%. Tešíte sa z vecí bez toho, aby vám vládli.',
    },
    {
      title: 'Pôžitok v primeranej miere',
      message:
        'Zábava zabrala {{actual}}% oproti plánovaným {{planned}}%. Striedmosť nie je o tom, že o niečo prídete — je to voľba.',
    },
    {
      title: 'Oddych bez výstrelkov',
      message:
        '{{actual}}% na zábavu, pod vaším limitom {{planned}}%. Radosť chutí lepšie, keď nevelí.',
    },
    {
      title: 'Striedmosť, potichu',
      message:
        'Zábave ste dali {{planned}}% a využila len {{actual}}%. Ten rozdiel je sloboda, ktorú ste si ponechali.',
    },
    {
      title: 'Zábava pod plánom',
      message: 'S {{actual}}% výdavkov zostala zábava pod stanovenými {{planned}}%. Dobre udržané.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '{{percent}}% pod plánom',
      message:
        'Minuli ste o {{savedAmount}} menej, než ste si na mesiac dovolili. Nepotrebovať všetko, čo by ste mohli mať, je druh bohatstva.',
    },
    {
      title: 'Zostalo neminuté: {{savedAmount}}',
      message:
        'Mesiac skončil {{percent}}% pod plánom. To, čo ste neminuli, stále môžete nasmerovať.',
    },
    {
      title: 'Menej, než ste si dovolili',
      message:
        'Výdavky sú {{percent}}% pod plánom — ušetrili ste {{savedAmount}}. Dajte tej rezerve účel skôr, než si ju privlastní zvyk.',
    },
    {
      title: 'Plán mal rezervu',
      message:
        '{{savedAmount}} pod vašimi limitmi za mesiac. Zdržanlivosť, ktorá pôsobí ľahko, je tá trvalá.',
    },
    {
      title: 'Ľahšie, než ste plánovali',
      message:
        'Potrebovali ste o {{percent}}% menej, než ste rozpočtovali. Zvážte, či {{savedAmount}} nepošlete na nejaký cieľ.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '„{{goal}}“ ide podľa plánu',
      message:
        'Ste na {{percent}}% cesty, tempom, aké cieľ potrebuje. Pevné kroky, robené každý mesiac, dôjdu ďaleko.',
    },
    {
      title: 'Na dobrej ceste k „{{goal}}“',
      message: 'Hotovo {{percent}}% a tempo drží. Naďalej plaťte cieľu ako prvému; funguje to.',
    },
    {
      title: '„{{goal}}“: {{percent}}% a stabilne',
      message: 'Cieľ dostáva každý mesiac, čo potrebuje. Trpezlivosť robí svoju prácu.',
    },
    {
      title: 'Cieľ napreduje podľa plánu',
      message:
        '„{{goal}}“ je financovaný na {{percent}}% a načas. Čo sa robí po troške každý mesiac, to jeden zlý týždeň nezastaví.',
    },
    {
      title: 'Pokrok, ktorému môžete veriť',
      message:
        '„{{goal}}“ je na {{percent}}%, v tempe. Budujete ho jediným spôsobom, ktorý funguje — postupne.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: 'Menej impulzívnych nákupov – {{merchant}}',
      message:
        'Z {{before}} nákupov za mesiac na zhruba {{after}}. Uvoľnený zvyk je získaná sloboda.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'Chodíte tam menej než predtým. Každý vynechaný reflex je malé víťazstvo voľby nad zvykom.',
    },
    {
      title: 'Drobný zvyk sa zmenšuje',
      message:
        'Nákupy – {{merchant}}: z {{before}} na približne {{after}}. Pokračujte — bude to ľahšie.',
    },
    {
      title: 'Voľba nad reflexom',
      message:
        '{{merchant}}: počet nákupov klesol z {{before}} na približne {{after}}. Takto sa buduje vláda nad sebou, jedno rozhodnutie za druhým.',
    },
    {
      title: 'Menej drobností',
      message:
        '{{merchant}}: približne {{after}}× namiesto {{before}}×. Malé víťazstvá sa sčítavajú.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Prispôsobili ste sa skromnejšiemu mesiacu',
      message:
        'Príjem klesol o {{incomePercent}}% a vy ste znížili výdavky o {{expensePercent}}%. Na zmenu šťasteny ste odpovedali zmenou kurzu.',
    },
    {
      title: 'Pokoj, keď príjem klesol',
      message:
        'Príjem nižší o {{incomePercent}}%, výdavky nižšie o {{expensePercent}}%. Prispôsobili ste sa tomu, čo je, nie tomu, čo bolo.',
    },
    {
      title: 'Šťastena sa zmenila; vy tiež',
      message:
        'Pokles príjmu o {{incomePercent}}% ste vyvážili poklesom výdavkov o {{expensePercent}}%. To je vyrovnanosť v číslach.',
    },
    {
      title: 'Dobre kormidlované',
      message:
        'Keď príjem klesol o {{incomePercent}}%, výdavky ho nasledovali (o {{expensePercent}}% menej). Vietor nebol váš; plachta áno.',
    },
    {
      title: 'Výdavky nasledovali príjem nadol',
      message:
        'Minuli ste o {{expensePercent}}% menej, keď príjem klesol o {{incomePercent}}%. Včasné prispôsobenie je pokojná cesta.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'Nevyhnutnosti sú stabilné',
      message:
        'Už {{months}} mes. sa vaše základné náklady takmer nepohli. Pevné dno vám dáva slobodu nad ním.',
    },
    {
      title: 'Potreby pod kontrolou',
      message:
        'Výdavky na nevyhnutnosti sa držia na rovnakej úrovni už {{months}} mes. Potreby, ktoré nerastú, sú potreby, ktoré ovládate.',
    },
    {
      title: 'Stabilné základy: {{months}} mes.',
      message: 'Nájom, jedlo a účty zostali tam, kde boli. Tichá stabilita je tiež úspech.',
    },
    {
      title: 'Nevyhnutnosti sa neplazia nahor',
      message:
        '{{months}} mes. bez posunu v tom, čo život vyžaduje. Na takom základe sa všetko ostatné plánuje ľahšie.',
    },
    {
      title: 'Pevné dno',
      message:
        'Základné výdavky sú stabilné už {{months}} mes. Nedovoľujete pohodliu vydávať sa za potreby.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Štedrosť k tomu, čo zarobíte',
      message:
        'Za {{months}} mes. išlo {{percent}}% vášho príjmu — {{givenAmount}} — na pomoc iným. To sú peniaze využité čo najlepšie.',
    },
    {
      title: 'Darované iným: {{givenAmount}}',
      message:
        'Za {{months}} mes. ste sa podelili o {{percent}}% príjmu. Láskavosť, ktorá sa ukáže v číslach, je láskavosť praktizovaná, nielen pociťovaná.',
    },
    {
      title: 'Otvorené ruky',
      message:
        'Charita a dary v poslednom čase tvorili {{percent}}% vášho príjmu. To, čo darujete, je časť vášho bohatstva, ktorú vám žiadne nešťastie nevezme.',
    },
    {
      title: 'Štedrosť je súčasťou vášho plánu',
      message:
        'Iným: {{givenAmount}} za {{months}} mes. Vydržte pri tom — dobro, ktoré robíte pre iných, robíte aj pre seba.',
    },
    {
      title: 'Dobre dané',
      message:
        '{{percent}}% toho, čo ste zarobili, išlo na pomoc iným. Málo zvykov povie o človeku viac.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Nie je čo opravovať',
      message: 'Vaše výdavky zodpovedajú tomu, čo ste zamýšľali. Pokračujte tak ďalej.',
    },
    {
      title: 'Úmysel a čin sa zhodujú',
      message: 'Mesiac vyzerá tak, ako ste ho naplánovali. Práve tá zhoda je zmyslom všetkého.',
    },
    {
      title: 'Pokojný mesiac',
      message:
        'Žiadny prebytok, žiadne zanedbanie hodné zmienky. Výborne — udržte rovnakú pozornosť aj ďalej.',
    },
    {
      title: 'Všetko v poriadku',
      message: 'Váš plán vydržal a nič si nežiada opravu. Užite si pokoj, ktorý ste si zaslúžili.',
    },
    {
      title: 'Pevná ruka',
      message: 'Mesiac sa niesol podľa vášho plánu. Dobré zvyky robia z dobrých mesiacov obyčajné.',
    },
  ],
  'stoic.keep_first': [
    {
      title: 'Najprv si ponechajte svoj diel',
      message:
        'Za obdobie {{months}} mes. ste si ponechali {{savingsPercent}}% príjmu. Senecovo varovanie: je neskoro šetriť, keď ste sa dostali na dno suda. Odložte {{tenthAmount}} v deň, keď príjem príde.',
    },
    {
      title: 'Šetriť z vrchu suda',
      message:
        'Zostalo vám len {{savingsPercent}}% príjmu. Šetrnosť, ktorá čaká na zvyšok, prichádza neskoro; {{tenthAmount}} mesačne, odložených ako prvé, ju začína hneď.',
    },
    {
      title: 'Čo je vaše, to si držte',
      message:
        'Seneca radí uchovať to, čo je naozaj vaše, a začať včas. V poslednom čase vám zostáva {{savingsPercent}}% príjmu; začnite sumou {{tenthAmount}} v deň výplaty a nechajte výdavky prispôsobiť sa zvyšku.',
    },
    {
      title: 'Začnite skôr než na kvasniciach',
      message:
        'Za obdobie {{months}} mes. ste si ponechali {{savingsPercent}}%. Šetriť je vo vašej moci, len kým je ešte čo ušetriť: odložte {{tenthAmount}} skôr než čokoľvek iné.',
    },
    {
      title: 'Ponechané {{savingsPercent}}% a sud sa vyprázdňuje',
      message:
        '{{tenthAmount}} mesačne, desatina príjmu, odložená pred akoukoľvek platbou. To, čo si ponecháte ako prvé, nezávisí od toho, čo mesiac nechá.',
    },
  ],
  'stoic.prepare_beforehand': [
    {
      title: 'Pripravte sa, kým je pokoj',
      message:
        'Vaša rezerva pokryje asi {{cushionDays}} dní výdavkov. Seneca: duša sa má otužovať v časoch bez starostí. Tri mesiace výdavkov sú {{targetAmount}}.',
    },
    {
      title: 'Rezerva na {{cushionDays}} dní',
      message:
        'Šťastena sa neohlasuje. Budujte rezervu k sume {{targetAmount}}, tri mesiace výdavkov, kým nič netlačí: vtedy je to ľahké.',
    },
    {
      title: '„Toto je ten stav, ktorého som sa bál?“',
      message:
        'Seneca nechal Lucilia nacvičovať chudobu, aby stratila svoju hrôzu. S rezervou na {{cushionDays}} dní by jeden ťažký mesiac nebol žiadnym nácvikom. Usilujte o {{targetAmount}}.',
    },
    {
      title: 'Predvídajte ťažký mesiac',
      message:
        'Vaše úspory by vydržali zhruba {{cushionDays}} dní. Čo je predvídané, prichádza mierne; {{targetAmount}} by vás nieslo tri mesiace.',
    },
    {
      title: 'Postavte hrádzu pred búrkou',
      message:
        'Pokrytých je asi {{cushionDays}} dní. Strata príjmu nie je vo vašej moci, rezerva áno. Tri mesiace výdavkov robia {{targetAmount}}.',
    },
  ],
  'stoic.wants_outrun_income': [
    {
      title: 'Túžby predbiehajú príjem',
      message:
        'Výdavky za posledný štvrťrok vzrástli o {{expenseGrowth}}%, príjem sa zmenil o {{incomeGrowth}}%. Chudobný nie je ten, kto má málo, píše Seneca, ale ten, kto túži po viac.',
    },
    {
      title: 'Žiť vyššie, nie lepšie',
      message:
        'Výdavky vzrástli o {{expenseGrowth}}%, príjem o {{incomeGrowth}}%. Potreby prírody sú nepatrné; nároky mienenia nemajú hraníc. Spýtajte sa, ktorým z nich prírastok slúži.',
    },
    {
      title: 'Túžby vyrástli: +{{expenseGrowth}}%',
      message:
        'Výdavky rástli rýchlejšie než príjem ({{incomeGrowth}}%). Nové pohodlie sa čoskoro zdá potrebou: všimnite si ho, kým ho ešte môžete odmietnuť.',
    },
    {
      title: 'Bránky sa posúvajú',
      message:
        'Výdavky sú o {{expenseGrowth}}% vyššie než v predchádzajúcom štvrťroku, príjem o {{incomeGrowth}}%. Dosť zostane dosť len vtedy, ak sami určíte, čo to je.',
    },
    {
      title: 'Viac nie je liek',
      message:
        'Za posledný štvrťrok vzrástli výdavky o {{expenseGrowth}}% a príjem o {{incomeGrowth}}%. Bohatstvo, ktoré rastie s túžbou, nikdy nepríde; stanovte hranicu skôr, než sa z toho stane nová norma.',
    },
  ],
  'stoic.price_in_life': [
    {
      title: '{{merchant}} vás stál {{hours}} hodín života',
      message:
        'Seneca pripomína, že len čas je skutočne náš. Suma {{totalAmount}} u obchodníka {{merchant}} je asi {{hours}} hodín vašej práce. Stálo to za to?',
    },
    {
      title: '{{hours}} hodín: {{merchant}}',
      message:
        'Peniaze strážime a čas rozdávame. Pri vašej priemernej hodinovej mzde je {{totalAmount}} tu zhruba {{hours}} pracovných hodín.',
    },
    {
      title: 'Ocenenie v hodinách',
      message:
        'Suma {{totalAmount}} u obchodníka {{merchant}} je asi {{hours}} hodín práce. Hodiny sú jediné, čo si nemôžete zarobiť späť.',
    },
    {
      title: 'Koľko vás {{merchant}} naozaj stál',
      message:
        'Vymieňate dni za peniaze a peniaze za veci. Obchodník {{merchant}} vám vzal asi {{hours}} hodín ({{totalAmount}}). Zodpovedá pôžitok týmto hodinám?',
    },
    {
      title: 'Zvážte hodiny',
      message:
        'Prepočítané na vašu priemernú hodinovú mzdu je {{totalAmount}} u obchodníka {{merchant}} asi {{hours}} hodín. Veľkú časť času strácame, píše Seneca. Vybrali ste si to?',
    },
  ],
  'stoic.rule_broken': [
    {
      title: 'Pravidlo „{{rule}}“ zablúdilo',
      message:
        'Mieri na niečo, čo už neexistuje, a tak potichu prestalo fungovať. Opravte ho alebo odstráňte: poriadok, ktorý nič nerobí, len vyzerá ako poriadok.',
    },
    {
      title: '„{{rule}}“ už nepôsobí',
      message:
        'Jeho kategória, účet alebo príjemca zmizli a pravidlo sa pri každej transakcii preskakuje. Pozerajte sa na veci, aké sú, a potom ich opravte.',
    },
    {
      title: 'Pravidlo, ktoré nemieri nikam',
      message:
        '„{{rule}}“ posiela transakcie na miesto, ktoré bolo odstránené. Raz ste sa rozhodli; rozhodnite sa znova, keď sa veci zmenili.',
    },
    {
      title: '„{{rule}}“ potrebuje váš úsudok',
      message:
        'To, na čo odkazuje, bolo zmazané, a transakcie, ktoré predtým zaraďovalo, čakajú teraz na vás. Dajte mu nový cieľ, alebo ho nechajte ísť.',
    },
    {
      title: 'Pokazené pravidlo, potichu',
      message:
        '„{{rule}}“ nerobí nič a nič o tom nehovorí. Napravte, čo je vo vašej moci: zaberie to minútu.',
    },
  ],
  'stoic.rule_contradicted': [
    {
      title: 'Vaša ruka nesúhlasí s pravidlom „{{rule}}“',
      message:
        '{{count}}-krát ste ručne zaradili inam, než kam to toto pravidlo zaraďuje. Buď je zlé pravidlo, alebo ruka: rozhodnite sa, čo z toho.',
    },
    {
      title: '„{{rule}}“ bolo prebité {{count}}-krát',
      message:
        'Pravidlo, ktoré stále opravujete, už nie je rozhodnutie, len zvyk hádať sa sám so sebou. Zmeňte ho, alebo mu dôverujte.',
    },
    {
      title: 'Hovorte, čo robíte, a robte, čo ste povedali',
      message:
        'Pravidlo „{{rule}}“ hovorí jedno; vašich posledných {{count}} opráv hovorí druhé. Uveďte oboje do súladu.',
    },
    {
      title: 'Rozhodnutie v spore',
      message:
        'Pravidlo „{{rule}}“ ste nastavili s chladnou hlavou a {{count}} transakcií odvtedy išlo inam. Pozrite sa znova, v pokoji, kto z vás mal pravdu.',
    },
    {
      title: '{{count}} opráv proti pravidlu „{{rule}}“',
      message:
        'Opakovanie je informácia. Nechajte ju zmeniť pravidlo, alebo nechajte pravidlo zmeniť zvyk.',
    },
  ],
  'stoic.rule_worth_writing': [
    {
      title: 'Rozhodnite raz: {{payee}}',
      message:
        'Príjemcu {{payee}} ste zaradili ručne {{decided}}-krát, vždy rovnako. Čo rozhodujete znova a znova, rozhodnite raz, s chladnou hlavou.',
    },
    {
      title: 'Rozhodnutie urobené {{decided}}-krát',
      message:
        'Príjemca {{payee}} kladie stále tú istú otázku a vy dávate stále tú istú odpoveď. Pravidlo by uchovalo vašu pozornosť pre to, čo ju naozaj potrebuje.',
    },
    {
      title: 'Príjemcov pripravených na pravidlo: {{count}}',
      message:
        'Stále tí istí príjemcovia dostávajú od vás tú istú kategóriu, najviac {{payee}}. Šetrite úsudok pre to, čo je nové.',
    },
    {
      title: 'Váš zvyk je pripravený stať sa zásadou',
      message:
        'Príjemcu {{payee}} zaraďujete zakaždým rovnako (zatiaľ {{decided}}-krát). Zapíšte to ako pravidlo a bude to držať bez námahy.',
    },
    {
      title: 'Nechajte to niesť pravidlo',
      message:
        'Príjemcov, ktorých zaraďujete zakaždým rovnako: {{count}}, pri príjemcovi {{payee}} je to {{decided}} transakcií. Zásada raz vyriešená sa nemusí obhajovať znova.',
    },
  ],
  'stoic.rule_idle': [
    {
      title: '„{{rule}}“ nič nestretlo {{months}} mes.',
      message:
        'Buď zmizol svet, pre ktorý vzniklo, alebo jeho podmienky míňajú cieľ. Udržujte svoje pravidlá pravdivé: opravte ho, alebo odstráňte.',
    },
    {
      title: 'Pravidlo v pokoji: „{{rule}}“',
      message:
        'Po dobu {{months}} mes. sa nedotklo žiadnej transakcie. Odhoďte, čo je nadbytočné; tomu, čo zostane, bude ľahšie veriť.',
    },
    {
      title: '„{{rule}}“ stojí nečinne',
      message:
        '{{months}} mes. bez zhody, kým nové transakcie stále prichádzajú. Vyskúšajte ho na tých nedávnych a potom sa rozhodnite.',
    },
    {
      title: 'Je „{{rule}}“ ešte potrebné?',
      message:
        'Po dobu {{months}} mes. mu nič nezodpovedalo. Pravidlo držané zo zvyku je jedna vec navyše, o ktorú sa musíte starať.',
    },
    {
      title: 'Rozhodnutie, ktoré nemá čo rozhodovať',
      message: '„{{rule}}“ mlčí už {{months}} mes. Poriadok znamená mať, čo potrebujete, a len to.',
    },
  ],
  'stoic.praise_rules_hold': [
    {
      title: 'Vaše rozhodnutia držia',
      message:
        'Pravidlá zaradili {{percent}}% transakcií mesiaca a nemuseli ste ich prebíjať. Rozhodnutie urobené raz a dodržané oslobodzuje myseľ.',
    },
    {
      title: '{{percent}}% vyriešených vopred',
      message:
        'Väčšina transakcií mesiaca bola zaradená podľa toho, čo ste rozhodli skôr. To je pozornosť ušetrená pre to, na čom záleží.',
    },
    {
      title: 'Zásady v práci',
      message:
        'Vaše pravidlá vybavili {{percent}}% transakcií bez sporu. Ustálené zásady robia dni pokojnými.',
    },
    {
      title: 'Menej na rozhodovanie',
      message:
        '{{percent}}% transakcií nevyžadovalo nové rozhodnutie. Posúdili ste raz, dobre, a úsudok platí ďalej.',
    },
    {
      title: 'Poriadok zachovaný',
      message:
        'Pravidlá zaradili {{percent}}% mesiaca a žiadne nebolo napadnuté. Dobrý poriadok vyzerá, akoby sa nič nedialo.',
    },
  ],
  'stoic.goal_no_date': [
    {
      title: 'Cieľ „{{goal}}“ nemá dátum',
      message:
        'Stojí na {{percent}}% a nič do neho netečie. Keď človek nevie, do akého prístavu mieri, žiadny vietor nie je ten pravý: pomenujte deň, kedy chcete doraziť.',
    },
    {
      title: 'Želanie, alebo cieľ?',
      message:
        'Cieľ „{{goal}}“ nemá termín ani tempo. Cieľ je rozhodnutie s dátumom; dajte mu ho, alebo ho nechajte ísť.',
    },
    {
      title: 'Pomenujte deň: „{{goal}}“',
      message:
        'Je splnený na {{percent}}% a nehýbe sa. Čo sa dá urobiť kedykoľvek, robí sa zriedkakedy.',
    },
    {
      title: '„{{goal}}“ čaká na „niekedy“',
      message:
        'V poslednom čase do neho nič netieklo a žiadny dátum nič nežiada. Niekedy vo vašom kalendári nie je; zvoľte deň, ktorý tam je.',
    },
    {
      title: 'Cieľ „{{goal}}“ nemá prístav',
      message: 'Na {{percent}}%, bez termínu. Vedzte, kam plávate, a mesačný krok príde sám.',
    },
  ],
};
