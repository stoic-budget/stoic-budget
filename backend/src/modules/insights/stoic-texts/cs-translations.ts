import type { StoicTextMap } from './types';

export const cs: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'Měsíc přerostl svůj plán',
      message:
        'Plánovali jste {{plannedAmount}} a utratili {{spentAmount}} — o {{percent}} % více. Plán vznikl s chladnou hlavou; nechte ho mluvit silněji než okamžik.',
    },
    {
      title: 'O {{percent}} % nad tím, co jste chtěli utratit',
      message:
        'Výdaje stojí na {{spentAmount}} proti plánu {{plannedAmount}}. Podívejte se, který limit povolil první — tam je ta lekce.',
    },
    {
      title: 'Váš plán a váš měsíc se neshodnou',
      message:
        '{{spentAmount}} utraceno, {{plannedAmount}} zamýšleno. Buď plán žádal od skutečnosti příliš málo, nebo skutečnost od vás příliš mnoho — rozhodněte v klidu, co z toho.',
    },
    {
      title: 'Vyšlo víc, než jste dovolili',
      message:
        'Měsíc je o {{percent}} % nad {{plannedAmount}}, které jste si stanovili. Zastavit se teď nic neztratí; předstírat, že se to nestalo, ztratí mnoho.',
    },
    {
      title: 'Limit, který jste si dali, limit, který jste překročili',
      message:
        'Chtěli jste utratit {{plannedAmount}}; je to {{spentAmount}}. Sebeovládání není nikdy neuklouznout — je to všimnout si včas a vrátit se na cestu.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Volný čas bere víc, než jste plánovali',
      message:
        'Chtěli jste, aby zábava tvořila {{planned}} % výdajů; vyšla na {{actual}} %. Požitek je vítán jako host, ne jako pán domu.',
    },
    {
      title: 'Volný čas na {{actual}} %, plán {{planned}} %',
      message:
        'Odpočinek si zaslouží své místo, když vás obnovuje. Zeptejte se, které z radostí měsíce to dokázaly, a zbytek bez lítosti nechte jít.',
    },
    {
      title: 'Pohodlí utrácí víc než záměr',
      message:
        'Volný čas drží {{actual}} % výdajů proti {{planned}} %, které jste zvolili. Umírněnost není odmítání potěšení — je to držet je v rozměru, který jste určili.',
    },
    {
      title: 'Příjemné vytlačuje plánované',
      message:
        'Dali jste volnému času {{planned}} % plánu a on si vzal {{actual}} %. To, co si dopřáváte snadno, stojí za druhý pohled, než se z toho stane to, co potřebujete.',
    },
    {
      title: 'Volný čas překročil svou čáru',
      message:
        '{{actual}} % měsíce šlo na volný čas, {{planned}} % byl záměr. Čára byla vaše nakreslit a je vaše ji držet.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Volný čas opět nad plánem',
      message:
        'Volný čas překročil váš plán v {{months}} z posledních {{window}} měsíců. Opakování už není náhoda — je to zvyk, který je vhodné prozkoumat.',
    },
    {
      title: '{{months}} z {{window}} měsíců nad plánem volného času',
      message:
        'Co se stane jednou, jsou okolnosti; co se stane {{months}}krát, je charakter ve vzniku. Zvolte charakter záměrně.',
    },
    {
      title: 'Stejné uklouznutí, měsíc po měsíci',
      message:
        'Volný čas přerostl plán v {{months}} z {{window}} měsíců. Zvyšte plán poctivě nebo změňte zvyk — žít mezi tím stojí nejvíc.',
    },
    {
      title: 'Vzorec, ne výjimka',
      message:
        'V {{months}} z posledních {{window}} měsíců si volný čas vzal víc, než jste mu dali. Všímejte si okamžiku, kdy se rozhoduje, nikoli jen účtu potom.',
    },
    {
      title: 'Zvyk hlasuje proti vašemu plánu',
      message:
        'Volný čas překonal plán {{months}}krát za {{window}} měsíců. Zvyky se staví po jedné volbě; stejně se i rozkládají.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'Ctnost dostává méně, než jste zamýšleli',
      message:
        'Z rozpočtu jste vyhradili {{planned}} % na zdraví, učení a podobné; vyšlo to na {{actual}} %. Záměr se počítá, až když je vykonán.',
    },
    {
      title: 'Ctnost na {{actual}} % z plánovaných {{planned}} %',
      message:
        'Peníze, které jste určili tomu, co vás činí lepšími, stále čekají. Není lepší chvíle, kdy je dobře utratit, než právě teď.',
    },
    {
      title: 'Dobro, které jste naplánovali, je neutraceno',
      message:
        'Zdraví, učení a velkorysost měly dostat {{planned}} % výdajů; dostaly {{actual}} %. Udělejte jedno z nich tento týden, záměrně.',
    },
    {
      title: 'Záměr bez činu',
      message:
        'Ctnost drží {{actual}} % výdajů proti {{planned}} %, které jste zvolili. Co si ceníme, se pozná na tom, za co skutečně platíme.',
    },
    {
      title: 'Zbylo místo na to, co má cenu',
      message:
        'Na ctnost šlo jen {{actual}} %, i když jste plánovali {{planned}} %. Kniha, prohlídka u lékaře, dar někomu v nouzi — plán už řekl ano.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'Ctnost se stále odkládá',
      message:
        'Výdaje na zdraví, učení a druhé zůstávají pod vaším plánem už {{months}} měsíců v řadě. Co stále odkládáte, jste ve skutečnosti odmítli.',
    },
    {
      title: '{{months}} měsíců odložené ctnosti',
      message:
        'Každý měsíc plán udělal místo tomu, co vás zlepšuje, a každý měsíc zůstalo nevyužito. Čas je to jediné, co nelze rozpočtovat dvakrát.',
    },
    {
      title: 'Lepší já stále čeká',
      message:
        'Ctnost je pod plánem {{months}} měsíců za sebou. Začněte malým a jistým, nikoli velkým a později.',
    },
    {
      title: 'Dobré úmysly stárnou',
      message:
        '{{months}} měsíců dostávaly zdraví, učení a velkorysost méně, než jste plánovali. Vyberte jedno a příští měsíc je zaplaťte první, dřív než cokoli jiného.',
    },
    {
      title: 'Ctnost pořád prohrává s „později“',
      message:
        '{{months}} měsíců v řadě pod plánem. Později je místo, kam dobré úmysly chodí být zapomenuty — dejte tomuhle datum.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'Váš plán nemá místo pro ctnost',
      message:
        'Žádný z vašich rozpočtů neslouží zdraví, učení ani druhým. Plán ukazuje, co si ceníme — zvažte dát ctnosti vlastní řádek.',
    },
    {
      title: 'Všechny rozpočty, ale žádný pro dobro',
      message:
        'Nutnost, práce i volný čas mají limity; ctnost žádný. Co se nikdy neplánuje, se obvykle nikdy nestane.',
    },
    {
      title: 'Plánujte to, co vás zlepšuje',
      message:
        'Ve třídě ctnosti dosud žádný rozpočet není. I malý — knihy, sport, dar — změní přání na závazek.',
    },
    {
      title: 'Plán o ctnosti mlčí',
      message:
        'Rozpočtujete to, co musíte, a to, co si dopřáváte, ještě ne toho, kým chcete být. Jeden skromný rozpočet na ctnost by to změnil.',
    },
    {
      title: 'Ctnost nemá rozpočet',
      message:
        'Výdaje na zdraví, učení nebo druhé nejsou naplánovány nikde. Vyberte jeden a dejte mu limit, jehož dosažení by vás potěšilo.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'Nutnosti stojí víc, než bylo plánováno',
      message:
        'Plánovali jste {{planned}} % výdajů na nutnosti; berou {{actual}} %. Zkontrolujte, zda je každá z nich stále potřeba, nebo se tiše stala pohodlím.',
    },
    {
      title: 'Nutnost na {{actual}} %, plán {{planned}} %',
      message:
        'To, co život vyžaduje, je obvykle méně než to, čemu jsme si zvykli. Projděte největší nutnost svěžím okem.',
    },
    {
      title: 'To nezbytné se nadouvá',
      message:
        'Nutnosti drží {{actual}} % měsíce proti {{planned}} %, které jste očekávali. Potřeba, která stále roste, si zaslouží otázku.',
    },
    {
      title: 'Potřeby přerůstají plán',
      message:
        'Plánováno {{planned}} %, skutečnost {{actual}} %. Buď plán podcenil reálné náklady, nebo některá přání cestují pod jménem potřeb.',
    },
    {
      title: 'Na „musím“ šlo víc, než bylo zamýšleno',
      message:
        'Nutnosti si vzaly {{actual}} % výdajů místo {{planned}} %. Oddělte to, co skutečně musí být, od toho, co jen vždycky bylo.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'Nutnosti se plíží vzhůru',
      message:
        'Výdaje na nutnosti rostou {{months}} měsíců v řadě, celkem {{percent}} %. Potřeby rostou tiše, když je nikdo nenutí se obhájit.',
    },
    {
      title: '+{{percent}} % na nutnostech za {{months}} měsíců',
      message:
        'Každý krok vypadal malý; dohromady malé nejsou. Vezměte největší opakující se nutnost a zvažte, zda musí ještě stát tolik.',
    },
    {
      title: 'Podlaha vašich výdajů se zvedá',
      message:
        'Nutnosti rostly {{months}} měsíců za sebou (+{{percent}} %). Stoupající podlaha nechává méně místa na vše, co volíte svobodně.',
    },
    {
      title: 'Potřeby se rozpínají',
      message:
        '{{months}} měsíců růstu, celkem {{percent}} %. Stoická zkouška je jednoduchá: zvolili byste to dnes znovu, když znáte cenu?',
    },
    {
      title: 'Malé přírůstky, stálý směr',
      message:
        'Nutnosti jsou za {{months}} měsíců výše o {{percent}} %. Směr znamená víc než jediný měsíc — tento stojí za včasnou korekci.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'Práce stojí víc, než bylo plánováno',
      message:
        'Plánovali jste {{planned}} % výdajů na práci; bere {{actual}} %. Nástroje a služby si musí na sebe vydělat — zkontrolujte, které to dělají.',
    },
    {
      title: 'Výdaje na práci {{actual}} %, plán {{planned}} %',
      message:
        'Investice do práce je dobrá, když něco vrací. Projděte, za co platíte, ale co už nepoužíváte.',
    },
    {
      title: 'Rozpočet na práci je napnutý',
      message:
        'Práce si vzala {{actual}} % místo {{planned}} %. Pracovitost je dělat práci dobře, ne kupovat na ni každý nástroj.',
    },
    {
      title: 'Nástroje utrácejí nad plán',
      message:
        'Plánováno {{planned}} %, utraceno {{actual}} % na práci. Zvažte u každého výdaje: pomáhá mi práci dělat, nebo jen připomíná pokrok?',
    },
    {
      title: 'Náklady práce se posunuly',
      message:
        'Práce drží {{actual}} % výdajů proti zamýšleným {{planned}} %. Rychlá revize nyní ušetří větší později.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '„{{category}}“ opakovaně prolamuje svůj limit',
      message:
        '„{{category}}“ přesáhla rozpočet v {{months}} z posledních {{window}} měsíců. Buď je špatný limit, nebo chuť — rozhodněte, co z toho.',
    },
    {
      title: '„{{category}}“: nad rozpočtem {{months}} z {{window}} měsíců',
      message:
        'Limit, který se vždy překročí, není limit, jen přání. Udělejte ho poctivým — zvyšte ho záměrně nebo ho záměrně držte.',
    },
    {
      title: 'Stejný rozpočet opět povolil',
      message:
        '„{{category}}“ přesáhla svůj limit {{months}}krát za {{window}} měsíců. Opakování je informace; využijte ji.',
    },
    {
      title: '„{{category}}“ si říká o vaši pozornost',
      message:
        'Nad rozpočtem v {{months}} z {{window}} měsíců. Pozorujte okamžik před nákupem — jen tam lze zvyk změnit.',
    },
    {
      title: 'Vzorec v „{{category}}“',
      message:
        '{{months}} překročení za {{window}} měsíců. Čím se stáváme, to opakujeme; rozhodněte, co má tato kategorie o vás říkat.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '„{{category}}“ vyčerpá limit kolem dne {{day}}',
      message:
        'Utratili jste {{spentAmount}} z {{limitAmount}} a tímto tempem limit skončí kolem dne {{day}}. Zpomalit teď je snazší než zastavit později.',
    },
    {
      title: '„{{category}}“ je před měsícem',
      message:
        '{{spentAmount}} je už pryč z limitu {{limitAmount}}. Tímto tempem bude vyčerpán kolem dne {{day}} — zbytek měsíce je ale stále váš.',
    },
    {
      title: 'Kontrola tempa: „{{category}}“',
      message:
        'Rozpočet {{limitAmount}} vydrží při současném tempu asi do dne {{day}}. Předvídavost je nejlevnější druh disciplíny.',
    },
    {
      title: '„{{category}}“ utrácí budoucnost',
      message:
        '{{spentAmount}} z {{limitAmount}} utraceno; limit končí poblíž dne {{day}}. To, co uděláte tento týden, rozhodne, zda se to stane.',
    },
    {
      title: 'Včasné varování pro „{{category}}“',
      message:
        'Při současném tempu limit {{limitAmount}} nedosáhne konce měsíce — vyčerpá se kolem dne {{day}}. Upravte to, dokud je to levné.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '„{{category}}“ zůstala nevyužitá',
      message:
        'Rozpočet „{{category}}“ nezaznamenal žádné výdaje už {{months}} měsíců. Buď jste z něj vyrostli, nebo je to záměr, který ještě čeká — rozhodněte, co z toho.',
    },
    {
      title: 'Prázdný rozpočet: „{{category}}“',
      message:
        '{{months}} měsíců bez jediného výdaje. Plán má popisovat život, který žijete, nebo ten, který stavíte — který z nich je tento?',
    },
    {
      title: '„{{category}}“ stojí nečinně',
      message:
        'Tady se {{months}} měsíců nic neutratilo. Byla-li to zdrženlivost, výborně; byla-li to nedbalost, udělejte s tím něco.',
    },
    {
      title: 'Naplánováno, ale neprožito',
      message:
        '„{{category}}“ má limit a žádné výdaje už {{months}} měsíců. Udržte plán pravdivý: zrušte ho, nebo ho využijte.',
    },
    {
      title: '„{{category}}“: {{months}} tichých měsíců',
      message:
        'Rozpočet, kterého se nikdo nedotkne, stále zabírá místo ve vašem plánu. Uvolněte to místo, nebo ten záměr naplňte.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}} % výdajů nemá limit',
      message:
        '{{unbudgetedAmount}} z měsíce šlo do kategorií, které žádný rozpočet nehlídá. Na co jste se nepodívali, to nemůžete posoudit.',
    },
    {
      title: 'Velká část měsíce je nenaplánovaná',
      message:
        '{{percent}} % výdajů — {{unbudgetedAmount}} — leží mimo všechny rozpočty. Dejte největší části limit a plán uvidí víc z vašeho života.',
    },
    {
      title: 'Výdaje mimo plán',
      message:
        'Rozpočty pokrývají jen část toho, co utrácíte; {{unbudgetedAmount}} ({{percent}} %) zůstává neměřeno. Rozšiřte plán tam, kam peníze skutečně jdou.',
    },
    {
      title: 'Plán vidí jen část obrazu',
      message: '{{percent}} % výdajů měsíce nemá rozpočet. Jasný pohled předchází dobrému úsudku.',
    },
    {
      title: '{{unbudgetedAmount}} utraceno bez limitu',
      message:
        'To je {{percent}} % měsíce. Nemusíte to omezovat — jen se rozhodnout, kolik z toho skutečně chcete.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '„{{category}}“ je většina vašeho volného času',
      message:
        '{{percent}} % výdajů za zábavu šlo do kategorie „{{category}}“. Užívejte si, ale ověřte, že byste se od toho dokázali odvrátit.',
    },
    {
      title: 'Jedno potěšení vládne',
      message:
        '„{{category}}“ bere {{percent}} % všeho, co jste dali na volný čas. Zvažte, zda vás ještě těší, nebo se z toho stala rutina.',
    },
    {
      title: 'Volný čas se opírá o „{{category}}“',
      message:
        '{{percent}} % volného času na jednom místě. To, bez čeho se neobejdeme, nás drží — zkontrolujte, že je ten úchop stále lehký.',
    },
    {
      title: '„{{category}}“: {{percent}} % volného času',
      message:
        'Jediný zdroj radosti si bere téměř všechno. Zkuste to na čas oželet a uvidíte, co vám skutečně dává.',
    },
    {
      title: 'Váš odpočinek má jednu adresu',
      message:
        'Většina peněz na zábavu, {{percent}} %, jde do kategorie „{{category}}“. Od požitku jste svobodní jen tehdy, když byste se bez něj obešli.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Část výdajů ještě nebyla posouzena',
      message:
        '{{count}} kategorií nemá třídu. Rozhodněte v Rozpočtech, co je nutnost, práce, ctnost nebo volný čas.',
    },
    {
      title: '{{count}} kategorií čeká na váš úsudek',
      message:
        'Mají výdaje, ale žádnou třídu, takže je doporučení nemohou vážit. Minuta v Rozpočtech to vyřeší.',
    },
    {
      title: 'Pojmenujte to, čemu vaše peníze slouží',
      message:
        '{{count}} kategorií je stále bez zařazení. Úsudek začíná tím, že věci nazýváme pravými jmény.',
    },
    {
      title: 'Neposouzené výdaje: {{count}} kategorií',
      message:
        'Je to potřeba, vaše práce, ctnost, nebo potěšení? Říct to můžete jen vy — a plán se tím vyjasní.',
    },
    {
      title: 'Několik kategorií nemá třídu',
      message:
        '{{count}} kategorií stojí mimo čtyři třídy. Zařaďte je v Rozpočtech, aby byl každý výdaj viděn tím, čím je.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: '{{count}} malých nákupů u {{merchant}}',
      message:
        'Každý nákup se zdál nicotný; dohromady za měsíc vyšly na {{totalAmount}}. V malých, neprozkoumaných zvycích tiše mizí nejvíc peněz.',
    },
    {
      title: '{{merchant}}: {{count}}krát za měsíc',
      message:
        '{{totalAmount}} v drobných částkách. Zeptejte se, zda byla každá návštěva volbou, nebo reflexem: jen první je svoboda.',
    },
    {
      title: 'Po troškách: {{totalAmount}}',
      message:
        '{{count}} nákupů u {{merchant}}. Žádný jediný nerozhoduje; rozhoduje zvyk. Rozhodněte, jak často to vlastně chcete.',
    },
    {
      title: 'Zvyk u {{merchant}}',
      message:
        '{{count}} nákupů, celkem {{totalAmount}}. Zkuste každý třetí vynechat a uvidíte, jestli vám bude chybět.',
    },
    {
      title: 'Drobnosti se sčítají',
      message:
        '{{merchant}} vás viděl {{count}}krát, za {{totalAmount}}. Vláda nad velkými rozhodnutími se staví na takových malých.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Víkendy nesou {{percent}} % volného času',
      message:
        'Většina vašich výdajů na volný čas padá na sobotu a nedělí. Odpočinek je dobrý; zkontrolujte, že je to odpočinek a ne náhrada za týden.',
    },
    {
      title: 'Volný čas žije o víkendu',
      message:
        '{{percent}} % výdajů na volný čas padá na víkend. Naplánujte víkend trochu a bude stát méně a dávat více.',
    },
    {
      title: 'Víkend platí za týden',
      message:
        'Víkendy berou {{percent}} % toho, co dáváte na volný čas. Pokud se týden musí spravovat každou sobotu, podívejte se na ten týden.',
    },
    {
      title: 'Sobota a nedělě: {{percent}} % volného času',
      message:
        'Volné dny zvou k volným výdajům. Rozhodněte před víkendem, k čemu je, a nechte peníze následovat.',
    },
    {
      title: 'Víkendový vzorec',
      message:
        '{{percent}} % výdajů na volný čas se děje o víkendu. Lehčí pracovní dny často dělají víkendy levnějšími.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} si vzal {{percent}} % měsíce',
      message:
        '{{totalAmount}} šlo jednomu obchodníkovi na volný čas. Když má jedno místo tolik vašich peněz, zvažte, kolik má i vaší pozornosti.',
    },
    {
      title: 'Jedno místo, {{totalAmount}}',
      message:
        '{{merchant}} tvoří {{percent}} % výdajů měsíce. Stojí za takový díl práce vašeho života?',
    },
    {
      title: '{{merchant}} vede vaše výdaje',
      message:
        '{{percent}} % měsíce — {{totalAmount}} — šlo tam. Není nic špatného si to dopřát, pokud byste to zvolili znovu.',
    },
    {
      title: 'Velký podíl u {{merchant}}',
      message:
        '{{totalAmount}}, tedy {{percent}} % výdajů, na jediném místě volného času. Zvažte potěšení proti ceně, v klidu.',
    },
    {
      title: '{{percent}} % u {{merchant}}',
      message:
        'Tento jediný obchodník si vzal {{totalAmount}}. Svoboda je umět projít kolem, když se tak rozhodnete.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Příjem klesl, výdaje ne',
      message:
        'Příjem spadl o {{percent}} % na {{incomeAmount}}, ale výdaje zůstaly na {{expenseAmount}}. Štěstěna změnila názor; vaše výdaje si toho ještě nevšimly.',
    },
    {
      title: 'Příjem dolů o {{percent}} %',
      message:
        '{{incomeAmount}} přišlo dovnitř proti {{expenseAmount}} naven. Co náhoda dá, může vzít zpět — přizpůsobte výdaje tomu, co je, ne tomu, co bylo.',
    },
    {
      title: 'Hubenější měsíc, stejné zvyky',
      message:
        'Příjem je o {{percent}} % nižší ({{incomeAmount}}), zatímco výdaje zůstaly na {{expenseAmount}}. Příjem ve vaší moci není; odpověď ano.',
    },
    {
      title: 'Štěstěna se pohnula',
      message:
        'Vydělali jste o {{percent}} % méně než obvykle, ale utratili {{expenseAmount}} jako dřív. Omezte teď, dokud je to volba a ne nutnost.',
    },
    {
      title: 'Výdaje nenásledovaly příjem',
      message:
        'Příjem klesl na {{incomeAmount}} (o {{percent}} % dolů); výdaje jsou {{expenseAmount}}. Nastavte plachtu podle větru, který skutečně máte.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Předplatné: {{monthlyAmount}} měsíčně',
      message:
        '{{count}} předplatných bere {{percent}} % vašich měsíčních výdajů. Každé se obnoví, aniž by se vás zeptalo — zeptejte se na každé sami.',
    },
    {
      title: '{{percent}} % výdajů se obnovuje samo',
      message:
        '{{count}} předplatných, {{monthlyAmount}} měsíčně. Nechte si ta, která byste si dnes zřídili znovu.',
    },
    {
      title: 'Tiché, opakované, {{monthlyAmount}}',
      message:
        '{{count}} předplatných stojí {{percent}} % vašeho měsíce. Pohodlí je dobrý sluha a drahý pán.',
    },
    {
      title: '{{count}} předplatných k revizi',
      message:
        'Dohromady je to {{monthlyAmount}} měsíčně, {{percent}} % výdajů. Zrušte jedno, které téměř nepoužíváte, a všimněte si, jak málo vám bude chybět.',
    },
    {
      title: 'Co se obnovuje samo',
      message:
        '{{monthlyAmount}} měsíčně napříč {{count}} předplatnými. Automatické výdaje si zaslouží záměrnou revizi.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Váš úspěch by mohl sahat o trochu dál',
      message:
        'Za {{months}} měsíců jste si nechali {{savingsPercent}} % příjmu, ale druhým z toho šlo téměř nic. Bohatství sedí nejlépe v otevřených rukou — co takhle jeden dar tento měsíc?',
    },
    {
      title: 'Vydělává dobře, dává málo',
      message:
        '{{incomeAmount}} přišlo za {{months}} měsíců a {{givenAmount}} šlo druhým. Pomáháte-li způsoby, které tato aplikace nevidí, nevšímejte si toho; pokud ne, plán na to má místo.',
    },
    {
      title: 'Dobrý rok být velkorysý',
      message:
        'Uspořili jste {{savingsPercent}} % příjmu — znamení pevné ruky. Malá část z toho, dána někomu, kdo to potřebuje, by té pevnosti dala větší smysl.',
    },
    {
      title: 'V obrázku zatím nikdo další',
      message:
        'Posledních {{months}} měsíců ukazuje pečlivé vydělávání a spoření, ale žádnou dobročinnost ani dary. Jsme stvořeni jeden pro druhého; skromný dar stačí na začátek.',
    },
    {
      title: 'Místo pro laskavost',
      message:
        'Na pomoc druhým šlo jen {{givenAmount}} z {{incomeAmount}}. Zvažte malý, pravidelný dar — velkorysost se zvykem usnadňuje, jako každá ctnost.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '„{{goal}}“ zaostává',
      message:
        'Potřebuje {{requiredAmount}} měsíčně a vy vkládáte asi {{paceAmount}}. Tímto tempem dorazí o {{monthsLate}} měs. později. Tempo je ve vaší moci.',
    },
    {
      title: '„{{goal}}“: o {{monthsLate}} měsíců později při tomto tempu',
      message:
        'Požadováno {{requiredAmount}} měsíčně, skutečnost asi {{paceAmount}}. Posuňte datum poctivě nebo posuňte více peněz záměrně.',
    },
    {
      title: 'Cíl a tempo se neshodnou',
      message:
        '„{{goal}}“ žádá {{requiredAmount}} měsíčně; dostává {{paceAmount}}. Cíl je tak skutečný jako měsíční krok k němu.',
    },
    {
      title: '„{{goal}}“ potřebuje pevnější krok',
      message:
        '{{paceAmount}} měsíčně proti {{requiredAmount}}, které potřebuje. Příští měsíc zaplaťte cíl první, dřív než cokoli nepovinného.',
    },
    {
      title: 'Zaostáváte u „{{goal}}“',
      message:
        'Současné tempo ({{paceAmount}} měsíčně) ho zdržuje o {{monthsLate}} měs.. Ve vaší moci je další krok, ne celá cesta.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '„{{goal}}“ se do plánu nevejde',
      message:
        'Potřebuje {{requiredAmount}} měsíčně, ale po vašich rozpočtech je volné jen {{freeAmount}}. Změňte datum, cíl nebo rozpočty — doufání není plán.',
    },
    {
      title: '„{{goal}}“ žádá víc, než máte volného',
      message:
        '{{requiredAmount}} požadováno každý měsíc, {{freeAmount}} k dispozici. Chtít vše naráz je způsob, jak se nic neudělá; vyberte.',
    },
    {
      title: 'Čísla říkají ne — prozatím',
      message:
        '„{{goal}}“ potřebuje {{requiredAmount}} měsíčně; volné prostředky máte {{freeAmount}}. Upravte to, co je ve vaší moci: termín nebo ostatní limity.',
    },
    {
      title: '„{{goal}}“ potřebuje rozhodnutí',
      message:
        'Při {{requiredAmount}} měsíčně překračuje {{freeAmount}}, které zbývají po rozpočtech. Cíl zvolený s otevřenými očima je lepší než ten držený zbožným přáním.',
    },
    {
      title: 'Nemožné tempo pro „{{goal}}“',
      message:
        'Požadováno {{requiredAmount}} měsíčně, volné {{freeAmount}}. Poctivá aritmetika nyní ušetří zklamání později.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Váš zůstatek klesne pod nulu {{date}}',
      message:
        'Při současném chodu příjmů a výdajů klesne předpokládaný zůstatek na {{lowestAmount}}. Připravte se teď, dokud je to jen předpověď.',
    },
    {
      title: 'Blíží se manko: {{date}}',
      message:
        'Platby a běžné výdaje předbíhají příjem a zůstatek klesne až na {{lowestAmount}}. Předvídáním nesnází jim bereme moc.',
    },
    {
      title: 'Počítejte s {{date}}',
      message:
        'Ten den dosáhne odhadovaný zůstatek {{lowestAmount}}. Přesuňte platbu, zadržte přání nebo odložte hotovost — každé z toho je dnes ve vaší moci.',
    },
    {
      title: 'Předpověď klesá pod nulu',
      message: 'Zůstatek klesne na {{lowestAmount}} kolem {{date}}. Klidná odpověď je ta včasná.',
    },
    {
      title: 'Předvídejte mezeru {{date}}',
      message:
        'Odhadovaný nejnižší zůstatek: {{lowestAmount}}. Co je předvídáno, lze přijmout s rovnováhou; co nás zaskočí, zřídka.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Dodrželi jste slovo, které jste dali sobě',
      message:
        '{{months}} měsíců v řadě zůstaly vaše výdaje v plánu, který jste si dali. Takhle vypadá sebeovládání.',
    },
    {
      title: '{{months}} měsíců v plánu',
      message:
        'Měsíc po měsíci se to, co jste zamýšleli, a to, co jste udělali, shodují. Důslednost je tišší než vůle a vydrží déle.',
    },
    {
      title: 'Plán a život se shodují',
      message:
        '{{months}} měsíců za sebou ve vašich limitech. Plán držený tak dobře už není omezení — je to způsob, jak žijete.',
    },
    {
      title: 'Stabilně {{months}} měsíců',
      message: 'Vaše rozpočty drží {{months}} měsíců v řadě. Udržte stejnou pozornost; funguje to.',
    },
    {
      title: 'Disciplína, udržená',
      message:
        '{{months}} měsíců bez porušení vašeho plánu. Málo věcí osvobozuje tak jako důvěra ve vlastní rozhodnutí.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Vaše peníze jdou za vašimi hodnotami',
      message:
        'Peníze ve službě ctnosti tvořily {{actual}} % vašich výdajů, ne méně než plánovaných {{planned}} %. Dobře utraceno.',
    },
    {
      title: 'Ctnost dostala svůj plný díl',
      message:
        '{{actual}} % na zdraví, učení a druhé, proti plánovaným {{planned}} %. Za to, čeho si ceníte, jste zaplatili.',
    },
    {
      title: 'Utraceno na to, abyste byli lepší',
      message:
        'Zdraví, učení a podobné dostaly {{actual}} % výdajů měsíce (plánováno {{planned}} %). Ctnost se koupit nedá, ale lze jí sloužit.',
    },
    {
      title: 'Záměr vykonán',
      message:
        'Plánovali jste {{planned}} % na ctnost a utratili {{actual}} %. Dobré úmysly zřídka přežijí měsíc — vaše ano.',
    },
    {
      title: 'Nejlepší užití peněz',
      message: '{{actual}} % šlo na to, co dělá vás i druhé lepšími. Volte to dál.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Volný čas na svém místě',
      message:
        'Volný čas je {{actual}} % výdajů, pod {{planned}} %, které jste mu dovolili. Dopřáváte si, aniž by vás to ovládalo.',
    },
    {
      title: 'Potěšení držené v rozměru',
      message:
        'Volný čas si vzal {{actual}} % proti plánovaným {{planned}} %. Umírněnost není o něco přijít — je to volit.',
    },
    {
      title: 'Odpočinek bez nadbytku',
      message:
        '{{actual}} % na volný čas, pod vaším limitem {{planned}} %. Radost chutná lépe, když nevládne.',
    },
    {
      title: 'Umírněnost, potichu',
      message:
        'Dali jste volnému času {{planned}} % a on využil jen {{actual}} %. Ta rezerva je svoboda, kterou jste si udrželi.',
    },
    {
      title: 'Volný čas pod plánem',
      message:
        'S {{actual}} % výdajů zůstal volný čas pod {{planned}} %, které jste si dali. Dobře udrženo.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: 'O {{percent}} % pod plánem',
      message:
        'Utratili jste o {{savedAmount}} méně, než jste si na měsíc dovolili. Nepotřebovat všechno, co byste mohli mít, je druh bohatství.',
    },
    {
      title: '{{savedAmount}} zůstalo neutraceno',
      message:
        'Měsíc skončil o {{percent}} % pod plánem. To, co jste neutratili, je stále vaše, abyste s tím naložili.',
    },
    {
      title: 'Méně, než jste dovolili',
      message:
        'Výdaje jsou o {{percent}} % pod plánem — {{savedAmount}} zůstalo. Dejte té rezervě účel, než si ji zvyk vezme.',
    },
    {
      title: 'Plán měl rezervu',
      message:
        '{{savedAmount}} pod vašimi limity za měsíc. Zdrženlivost, která působí snadno, je ta trvalá.',
    },
    {
      title: 'Lehčí, než bylo plánováno',
      message:
        'Potřebovali jste o {{percent}} % méně, než jste rozpočtovali. Zvažte poslat {{savedAmount}} na cíl.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '„{{goal}}“ je v plánu',
      message:
        'Jste {{percent}} % cesty, tempem, které cíl potřebuje. Pevné kroky, dělané každý měsíc, dosáhnou daleko.',
    },
    {
      title: 'Na dobré cestě k „{{goal}}“',
      message: '{{percent}} % hotovo a tempo drží. Plaťte cíl dál jako první; funguje to.',
    },
    {
      title: '„{{goal}}“: {{percent}} % a stabilně',
      message: 'Cíl dostává každý měsíc to, co potřebuje. Trpělivost koná své.',
    },
    {
      title: 'Cíl se hýbe podle plánu',
      message:
        '„{{goal}}“ je {{percent}} % financován a v čase. Co se dělá po troškách každý měsíc, nezastaví jeden špatný týden.',
    },
    {
      title: 'Pokrok, kterému lze věřit',
      message:
        '„{{goal}}“ stojí na {{percent}} %, v tempu. Stavíte ho jediným způsobem, který funguje — postupně.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: 'Méně impulzivních nákupů u {{merchant}}',
      message:
        'Z {{before}} nákupů za měsíc na zhruba {{after}}. Uvolněný zvyk je získaná svoboda.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'Chodíte tam méně než dřív. Každý přeskočený reflex je malé vítězství volby nad zvykem.',
    },
    {
      title: 'Malý zvyk se zmenšuje',
      message:
        'Nákupy u {{merchant}} klesly z {{before}} na asi {{after}}. Pokračujte — bude to snazší.',
    },
    {
      title: 'Volba místo reflexu',
      message:
        'U {{merchant}} jste šli z {{before}} nákupů na asi {{after}}. To je vláda budovaná po jednom rozhodnutí.',
    },
    {
      title: 'Méně drobností',
      message:
        '{{merchant}} vás viděl asi {{after}}krát místo {{before}}. Malá vítězství se skládají.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Přizpůsobili jste se hubenějšímu měsíci',
      message:
        'Příjem klesl o {{incomePercent}} % a vy jste snížili výdaje o {{expensePercent}} %. Na změnu štěstěny jste odpověděli změnou kurzu.',
    },
    {
      title: 'Vyrovnanost, když příjem poklesl',
      message:
        'Příjem dolů o {{incomePercent}} %, výdaje dolů o {{expensePercent}} %. Přizpůsobili jste se tomu, co je, ne tomu, co bylo.',
    },
    {
      title: 'Štěstěna se změnila; vy také',
      message:
        'Pokles příjmu o {{incomePercent}} % se potkal s poklesem výdajů o {{expensePercent}} %. To je rovnováha v číslech.',
    },
    {
      title: 'Dobře kormidlováno',
      message:
        'Když příjem klesl o {{incomePercent}} %, výdaje následovaly (o {{expensePercent}} % méně). Vítr nebyl váš; plachta ano.',
    },
    {
      title: 'Výdaje šly dolů s příjmem',
      message:
        'Utratili jste o {{expensePercent}} % méně, když příjem klesl o {{incomePercent}} %. Přizpůsobit se včas je klidná cesta skrz.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'Nutnosti jsou stabilní',
      message:
        '{{months}} měsíců se vaše nezbytné náklady téměř nehýbou. Stabilní podlaha dává svobodu nad sebou.',
    },
    {
      title: 'Potřeby pod kontrolou',
      message:
        'Výdaje na nutnosti se drží na stejné úrovni {{months}} měsíců. Potřeby, které nerostou, jsou potřeby, které ovládáte.',
    },
    {
      title: '{{months}} měsíců stabilních nezbytností',
      message: 'Nájem, jídlo a účty zůstaly tam, kde byly. Tichá stabilita je také výsledek.',
    },
    {
      title: 'Žádné plíživé nutnosti',
      message:
        '{{months}} měsíců bez posunu v tom, co život vyžaduje. Vše ostatní se na tom základě plánuje snáz.',
    },
    {
      title: 'Pevná podlaha',
      message:
        'Nezbytné výdaje jsou stabilní {{months}} měsíců. Nenecháváte pohodlí vydávat se za potřeby.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Velkorysý s tím, co vyděláte',
      message:
        'Za {{months}} měsíců šlo {{percent}} % vašeho příjmu — {{givenAmount}} — na pomoc druhým. To jsou peníze v nejlepším užití.',
    },
    {
      title: '{{givenAmount}} darováno druhým',
      message:
        'Za {{months}} měsíců jste rozdělili {{percent}} % svého příjmu. Laskavost, která se objeví v číslech, je laskavost praktikovaná, nikoli jen pociťovaná.',
    },
    {
      title: 'Otevřené ruce',
      message:
        'Dobročinnost a dary vzaly v poslední době {{percent}} % vašeho příjmu. To, co dáte, je ta část bohatství, kterou žádné nešťastí nevezme.',
    },
    {
      title: 'Velkorysost je součástí vašeho plánu',
      message:
        '{{givenAmount}} druhým za {{months}} měsíců. Držte to — dobro, které činíte druhým, činíte i sobě.',
    },
    {
      title: 'Dobře darováno',
      message:
        '{{percent}} % toho, co jste vydělali, šlo na pomoc druhým. Málo zvyků řekne o člověku více.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Není co opravovat',
      message: 'Vaše výdaje odpovídají tomu, co jste zamýšleli. Pokračujte, jak jste.',
    },
    {
      title: 'Záměr a čin se shodují',
      message: 'Měsíc vypadá tak, jak jste ho naplánovali. Právě ta shoda je smyslem všeho.',
    },
    {
      title: 'Klidný měsíc',
      message:
        'Žádný přepych, žádná nedbalost, která by stála za zmínku. Výborně — nesete tu samou pozornost dál.',
    },
    {
      title: 'Vše v pořádku',
      message:
        'Váš plán vydržel a nic si neříká o opravu. Vychutnejte si klid, který jste si zasloužili.',
    },
    {
      title: 'Pevná ruka',
      message: 'Měsíc šel podle vašeho plánu. Dobré zvyky dělají z dobrých měsíců obyčejné.',
    },
  ],
  'stoic.keep_first': [
    {
      title: 'Nejdřív si ponechte svůj díl',
      message:
        'Za období {{months}} měs. jste si ponechali {{savingsPercent}} % příjmů. Senecovo varování: je pozdě šetřit, když jste došli na dno sudu. Odložte {{tenthAmount}} v den, kdy příjem dorazí.',
    },
    {
      title: 'Šetřit z vrchu sudu',
      message:
        'Zůstalo vám jen {{savingsPercent}} % příjmů. Šetrnost, která čeká na zbytek, přichází pozdě; {{tenthAmount}} měsíčně, odložených jako první, ji začíná hned.',
    },
    {
      title: 'Co je vaše, to si držte',
      message:
        'Seneca radí uchovat to, co je skutečně vaše, a začít brzy. V poslední době vám zůstává {{savingsPercent}} % příjmů; začněte částkou {{tenthAmount}} v den výplaty a nechte výdaje přizpůsobit se zbytku.',
    },
    {
      title: 'Začněte dřív než na kalu',
      message:
        'Za období {{months}} měs. jste si ponechali {{savingsPercent}} %. Spořit je ve vaší moci jen dokud je ještě co ušetřit: odložte {{tenthAmount}} dřív než cokoli jiného.',
    },
    {
      title: 'Ponecháno {{savingsPercent}} % a sud se vyprazdňuje',
      message:
        '{{tenthAmount}} měsíčně, desetina příjmů, odložených před jakoukoli platbou. To, co si ponecháte jako první, nezávisí na tom, co měsíc nechá.',
    },
  ],
  'stoic.prepare_beforehand': [
    {
      title: 'Připravte se, dokud je klid',
      message:
        'Vaše rezerva pokryje asi {{cushionDays}} dní výdajů. Seneca: duše se má otužovat v časech bez starostí. Tři měsíce výdajů jsou {{targetAmount}}.',
    },
    {
      title: 'Rezerva na {{cushionDays}} dní',
      message:
        'Štěstěna se neohlašuje. Budujte rezervu k částce {{targetAmount}}, tři měsíce výdajů, dokud nic netlačí: tehdy je to snadné.',
    },
    {
      title: '„Tohoto stavu jsem se bál?“',
      message:
        'Seneca nechal Lucilia nacvičovat chudobu, aby ztratila svůj děs. S rezervou na {{cushionDays}} dní by jeden těžký měsíc nebyl žádným nácvikem. Usilujte o {{targetAmount}}.',
    },
    {
      title: 'Předvídejte těžký měsíc',
      message:
        'Vaše úspory by vydržely zhruba {{cushionDays}} dní. Co je předvídáno, přichází mírně; {{targetAmount}} by vás neslo tři měsíce.',
    },
    {
      title: 'Postavte hráz před bouří',
      message:
        'Pokryto je asi {{cushionDays}} dní. Ztráta příjmu není ve vaší moci, rezerva ano. Tři měsíce výdajů dělají {{targetAmount}}.',
    },
  ],
  'stoic.wants_outrun_income': [
    {
      title: 'Chtění předbíhá příjem',
      message:
        'Výdaje za poslední čtvrtletí vzrostly o {{expenseGrowth}} %, příjem se změnil o {{incomeGrowth}} %. Chudý není ten, kdo má málo, píše Seneca, ale ten, kdo touží po víc.',
    },
    {
      title: 'Žít výš, ne lépe',
      message:
        'Výdaje vzrostly o {{expenseGrowth}} %, příjem o {{incomeGrowth}} %. Potřeby přírody jsou nepatrné; nároky mínění nemají mez. Zeptejte se, kterým z nich přírůstek slouží.',
    },
    {
      title: 'Chtění vyrostlo: +{{expenseGrowth}} %',
      message:
        'Výdaje rostly rychleji než příjem ({{incomeGrowth}} %). Nové pohodlí se brzy zdá potřebou: všimněte si ho, dokud je ještě můžete odmítnout.',
    },
    {
      title: 'Branky se posouvají',
      message:
        'Výdaje jsou o {{expenseGrowth}} % výš než minulé čtvrtletí, příjem o {{incomeGrowth}} %. Dost zůstane dost jen tehdy, když sami určíte, co to je.',
    },
    {
      title: 'Víc není lék',
      message:
        'Za poslední čtvrtletí vzrostly výdaje o {{expenseGrowth}} % a příjem o {{incomeGrowth}} %. Bohatství, které roste s touhou, nikdy nedorazí; stanovte mez, než se z toho stane nová norma.',
    },
  ],
  'stoic.price_in_life': [
    {
      title: '{{merchant}} vás stál {{hours}} hodin života',
      message:
        'Seneca připomíná, že jen čas je skutečně náš. Částka {{totalAmount}} u obchodníka {{merchant}} je asi {{hours}} hodin vaší práce. Stálo to za to?',
    },
    {
      title: '{{hours}} hodin: {{merchant}}',
      message:
        'Peníze střežíme a čas rozdáváme. Při vaší průměrné hodinové mzdě je {{totalAmount}} tady zhruba {{hours}} pracovních hodin.',
    },
    {
      title: 'Ocenění v hodinách',
      message:
        'Částka {{totalAmount}} u obchodníka {{merchant}} je asi {{hours}} hodin práce. Hodiny jsou jediné, co si nemůžete vydělat zpět.',
    },
    {
      title: 'Kolik vás {{merchant}} opravdu stál',
      message:
        'Vyměňujete dny za peníze a peníze za věci. Obchodník {{merchant}} vám vzal asi {{hours}} hodin ({{totalAmount}}). Odpovídá požitek těm hodinám?',
    },
    {
      title: 'Zvažte hodiny',
      message:
        'Přepočteno na vaši průměrnou hodinovou mzdu je {{totalAmount}} u obchodníka {{merchant}} asi {{hours}} hodin. Velkou část času ztrácíme, píše Seneca. Vybrali jste si to?',
    },
  ],
  'stoic.rule_broken': [
    {
      title: 'Pravidlo „{{rule}}“ zabloudilo',
      message:
        'Míří na něco, co už neexistuje, a tak tiše přestalo fungovat. Opravte je nebo odstraňte: pořádek, který nic nedělá, jen vypadá jako pořádek.',
    },
    {
      title: '„{{rule}}“ už nepůsobí',
      message:
        'Jeho kategorie, účet nebo příjemce zmizely a pravidlo se u každé transakce přeskakuje. Dívejte se na věci, jaké jsou, a pak je opravte.',
    },
    {
      title: 'Pravidlo, které nemíří nikam',
      message:
        '„{{rule}}“ posílá transakce na místo, které bylo odstraněno. Kdysi jste se rozhodli; rozhodněte se znovu, když se věci změnily.',
    },
    {
      title: '„{{rule}}“ potřebuje váš úsudek',
      message:
        'To, na co odkazuje, bylo smazáno, a transakce, které dřív zařazovalo, čekají nyní na vás. Dejte mu nový cíl, nebo ho nechte jít.',
    },
    {
      title: 'Rozbité pravidlo, tiše',
      message:
        '„{{rule}}“ nedělá nic a nic o tom neříká. Napravte, co je ve vaší moci: zabere to minutu.',
    },
  ],
  'stoic.rule_contradicted': [
    {
      title: 'Vaše ruka nesouhlasí s pravidlem „{{rule}}“',
      message:
        '{{count}}krát jste ručně zařadili jinam, než kam to toto pravidlo zařazuje. Buď je špatně pravidlo, nebo ruka: rozhodněte se, co z toho.',
    },
    {
      title: '„{{rule}}“ bylo přebito {{count}}krát',
      message:
        'Pravidlo, které stále opravujete, už není rozhodnutí, jen zvyk hádat se sám se sebou. Změňte ho, nebo mu věřte.',
    },
    {
      title: 'Říkejte, co děláte, a dělejte, co jste řekli',
      message:
        'Pravidlo „{{rule}}“ říká jedno; vašich posledních {{count}} oprav říká druhé. Uveďte obojí do souladu.',
    },
    {
      title: 'Rozhodnutí ve sporu',
      message:
        'Pravidlo „{{rule}}“ jste nastavili s chladnou hlavou a {{count}} transakcí od té doby šlo jinam. Pohleďte znovu, v klidu, kdo z vás měl pravdu.',
    },
    {
      title: '{{count}} oprav proti pravidlu „{{rule}}“',
      message:
        'Opakování je informace. Nechte ji změnit pravidlo, nebo nechte pravidlo změnit zvyk.',
    },
  ],
  'stoic.rule_worth_writing': [
    {
      title: 'Rozhodněte jednou: {{payee}}',
      message:
        'Příjemce {{payee}} jste zařadili ručně {{decided}}krát, vždy stejně. Co rozhodujete znovu a znovu, rozhodněte jednou, s chladnou hlavou.',
    },
    {
      title: 'Rozhodnutí učiněné {{decided}}krát',
      message:
        'Příjemce {{payee}} klade stále tutéž otázku a vy dáváte stále tutéž odpověď. Pravidlo by uchovalo vaši pozornost pro to, co ji opravdu potřebuje.',
    },
    {
      title: 'Příjemců připravených na pravidlo: {{count}}',
      message:
        'Stále stejní příjemci dostávají od vás stejnou kategorii, nejvíc {{payee}}. Šetřete úsudek pro to, co je nové.',
    },
    {
      title: 'Váš zvyk je připraven stát se zásadou',
      message:
        'Příjemce {{payee}} zařazujete pokaždé stejně (zatím {{decided}}krát). Zapište to jako pravidlo a bude to držet bez námahy.',
    },
    {
      title: 'Nechte to nést pravidlo',
      message:
        'Příjemců, které zařazujete pokaždé stejně: {{count}}, u příjemce {{payee}} je to {{decided}} transakcí. Zásada jednou vyřešená se nemusí hájit znovu.',
    },
  ],
  'stoic.rule_idle': [
    {
      title: '„{{rule}}“ nic nepotkalo {{months}} měs.',
      message:
        'Buď zmizel svět, pro který vzniklo, nebo jeho podmínky míjejí cíl. Udržujte svá pravidla pravdivá: opravte je, nebo odstraňte.',
    },
    {
      title: 'Pravidlo v klidu: „{{rule}}“',
      message:
        'Po dobu {{months}} měs. se nedotklo žádné transakce. Odhoďte, co je nadbytečné; tomu, co zbyde, bude snazší věřit.',
    },
    {
      title: '„{{rule}}“ stojí nečinně',
      message:
        '{{months}} měs. bez shody, zatímco nové transakce stále přicházejí. Vyzkoušejte ho na těch nedávných a pak se rozhodněte.',
    },
    {
      title: 'Je „{{rule}}“ ještě potřeba?',
      message:
        'Po dobu {{months}} měs. mu nic neodpovídalo. Pravidlo držené ze zvyku je jedna věc navíc, o kterou se musíte starat.',
    },
    {
      title: 'Rozhodnutí, které nemá co rozhodovat',
      message: '„{{rule}}“ mlčí už {{months}} měs.. Pořádek znamená mít, co potřebujete, a jen to.',
    },
  ],
  'stoic.praise_rules_hold': [
    {
      title: 'Vaše rozhodnutí drží',
      message:
        'Pravidla zařadila {{percent}} % transakcí měsíce a nemuseli jste je přebíjet. Rozhodnutí učiněné jednou a dodržené osvobozuje mysl.',
    },
    {
      title: '{{percent}} % vyřešeno předem',
      message:
        'Většina transakcí měsíce byla zařazena podle toho, co jste rozhodli dřív. To je pozornost ušetřená pro to, na čem záleží.',
    },
    {
      title: 'Zásady v práci',
      message:
        'Vaše pravidla vyřídila {{percent}} % transakcí bez sporu. Ustálené zásady dělají dny klidné.',
    },
    {
      title: 'Méně k rozhodování',
      message:
        '{{percent}} % transakcí nevyžadovalo nové rozhodnutí. Posoudili jste jednou, dobře, a úsudek platí dál.',
    },
    {
      title: 'Pořádek zachován',
      message:
        'Pravidla zařadila {{percent}} % měsíce a žádné nebylo rozporováno. Dobrý pořádek vypadá, jako by se nedělo nic.',
    },
  ],
  'stoic.goal_no_date': [
    {
      title: 'Cíl „{{goal}}“ nemá datum',
      message:
        'Stojí na {{percent}} % a nic do něj neplyne. Když člověk neví, do jakého přístavu míří, žádný vítr není ten pravý: pojmenujte den, kdy chcete dorazit.',
    },
    {
      title: 'Přání, nebo cíl?',
      message:
        'Cíl „{{goal}}“ nemá termín ani tempo. Cíl je rozhodnutí s datem; dejte mu je, nebo ho nechte jít.',
    },
    {
      title: 'Pojmenujte den: „{{goal}}“',
      message: 'Je z {{percent}} % splněn a nehýbe se. Co lze udělat kdykoli, dělá se zřídka kdy.',
    },
    {
      title: '„{{goal}}“ čeká na „někdy“',
      message:
        'V poslední době do něj nic neplynulo a žádné datum nic nežádá. Někdy ve vašem kalendáři není; zvolte den, který tam je.',
    },
    {
      title: 'Cíl „{{goal}}“ nemá přístav',
      message: 'Na {{percent}} %, bez termínu. Vězte, kam plujete, a měsíční krok přijde sám.',
    },
  ],
};
