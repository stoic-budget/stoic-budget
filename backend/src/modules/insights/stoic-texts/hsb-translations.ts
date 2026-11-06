import type { StoicTextMap } from './types';

export const hsb: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'Měsac je swój plan přerostł',
      message:
        'Planowali sće {{plannedAmount}} a wudali {{spentAmount}} — {{percent}} % wjace. Plan nasta ze zymnej hłowu; dajće jemu rěčeć hłośnišo hač wokomik.',
    },
    {
      title: '{{percent}} % nad tym, což sće wudać chcyli',
      message:
        'Wudawki steja na {{spentAmount}} přećiwo planej {{plannedAmount}}. Hladajće, kotry limit prěni popušći — tam je nawuk.',
    },
    {
      title: 'Waš plan a waš měsac so njezjednawaja',
      message:
        '{{spentAmount}} wudate, {{plannedAmount}} planowane. Pak plan přemało wot woprawdźitosće žadaše, pak woprawdźitosć přewjele wot was — rozsudźće měrnje, što.',
    },
    {
      title: 'Wušło je wjace, hač sće dowolił',
      message:
        'Měsac je {{percent}} % nad {{plannedAmount}}, kotrež sće postajił. Jeli nětko zastanjeće, ničo zhubjene njeje; jeli so činiće, zo so to njesta, zhubi so wjele.',
    },
    {
      title: 'Hranica, kotruž sće stajił, a hranica, kotruž sće překročił',
      message:
        'Chcyli sće {{plannedAmount}} wudać; je {{spentAmount}}. Samowobknježenje njeje ženje so njezmylić — je to zahe spóznać a so na puć wróćić.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Wotpočink bjerje wjace, hač sće planował',
      message:
        'Planowali sće wotpočink na {{planned}} % wudawkow; bě {{actual}} %. Wjesele je jako hósć witane, nic jako knjez domu.',
    },
    {
      title: 'Wotpočink při {{actual}} %, planowane {{planned}} %',
      message:
        'Wotpočink zasłuži sej swoje městno, hdyž was wobnowja. Prašće so, kotre wjeselosće měsaca su to činile, a druhe bjez wotpočinka pušćće.',
    },
    {
      title: 'Komfort wudawa wjace hač zaměr',
      message:
        'Wotpočink dźerži {{actual}} % wudawkow přećiwo {{planned}} %, kotrež sće wuzwolił. Měrnosć njeje wotpokazanje wjesełosće — je to dźeržeć ju w měrje, kotru sće postajił.',
    },
    {
      title: 'Přijomne wutłóči planowane',
      message:
        'Wotpočinkej sće {{planned}} % plana dał, a wón wza {{actual}} %. To, což bjez prócy wužiwaće, je druheho pohlada hódne, prjedy hač so stanje tym, což trjebaće.',
    },
    {
      title: 'Wotpočink je swoju liniju překročił',
      message:
        '{{actual}} % měsaca du na wotpočink, {{planned}} % bě zaměr. Linija bě waša, zo byšće ju zarysował, a waša je, zo byšće ju dźeržał.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Wotpočink zaso nad planom',
      message:
        'Wotpočink překroči waš plan w {{months}} ze poslednich {{window}} měsacow. Wospjetowanje hižo njeje njezbožo — je nawyk, kotryž so hodźi přepruwować.',
    },
    {
      title: '{{months}} z {{window}} měsacow nad planom wotpočinka',
      message:
        'To, což so raz stawa, su wobstejnosće; to, což so {{months}} razow stawa, je charakter w nastawanju. Wuzwolće charakter z wolu.',
    },
    {
      title: 'Samsne zmylkowanje, měsac po měsacu',
      message:
        'Wotpočink překroči plan w {{months}} z {{window}} měsacow. Zwyšće plan čestnje abo změńće nawyk — mjez tym žiwy być najdróžšo je.',
    },
    {
      title: 'Muster, nic wuwzaće',
      message:
        'W {{months}} ze poslednich {{window}} měsacow wza wotpočink wjace, hač sće jemu dał. Wobkedźbujće wokomik, hdyž so rozsud přijima, nic jenož ličbu pozdźišo.',
    },
    {
      title: 'Nawyk hłosuje přećiwo wašemu planej',
      message:
        'Wotpočink zdoby plan {{months}} razow w {{window}} měsacach. Nawyki so po jednym wuzwolenju twarja; tak so tež rozbuchaja.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'Čestnosć dóstawa mjenje, hač sće zaměrił',
      message:
        'Wotstajili sće {{planned}} % budgeta za strowotu, wuknjenje a druhich; bě {{actual}} %. Zaměr liči, hdyž je wuwjedźeny.',
    },
    {
      title: 'Čestnosć při {{actual}} % z planowanych {{planned}} %',
      message:
        'Pjenjezy, kotrež sće za to postajił, što was lěpšeho čini, hišće čakaja. Lěpšeho časa, zo byšće je derje wudał, hač nětko njeje.',
    },
    {
      title: 'Dobre, kotrež sće planował, je njewudate',
      message:
        'Strowota, wuknjenje a dawkomócnosć měli {{planned}} % wudawkow dóstać; dóstachu {{actual}} %. Čińće jedne z nich tutón tydźeń, z wolu.',
    },
    {
      title: 'Zaměr bjez čina',
      message:
        'Čestnosć dźerži {{actual}} % wudawkow přećiwo {{planned}} %, kotrež sće wuzwolił. To, což sej cenimy, so w tym pokazuje, za čož woprawdźe płaćimy.',
    },
    {
      title: 'Městno za wažne je wostało',
      message:
        'Na čestnosć du jenož {{actual}} %, hačrunjež sće {{planned}} % planował. Kniha, přepruwowanje při lěkarju, dar někomu w nuzy — plan je hižo haj prajił.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'Čestnosć so dale wotkładuje',
      message:
        'Wudawki za strowotu, wuknjenje a druhich wostawaja pod wašim planom hižo {{months}} měsacow po rjedźe. To, což stajnje wotkładujeće, sće woprawdźe wotpokazał.',
    },
    {
      title: '{{months}} měsacow wotkładźeneje čestnosće',
      message:
        'Kóždy měsac plan městno za to wostaji, což was lěpšeho čini, a kóždy měsac wosta njewužite. Čas je jenički, kotryž so njehodźi dwójce planować.',
    },
    {
      title: 'Lěpše ja hišće čaka',
      message:
        'Čestnosć je pod planom {{months}} měsacow po rjedźe. Započńće mało a wěsće, nic wulko a pozdźišo.',
    },
    {
      title: 'Dobre zaměry staršeja',
      message:
        '{{months}} měsacow dóstachu strowota, wuknjenje a dawkomócnosć mjenje, hač sće planował. Wuzwolće jedne a zapłaćće jemu přichodny měsac jako prěnjemu, před wšěm druhim.',
    },
    {
      title: 'Čestnosć stajnje přećiwo „pozdźišo“ zhubja',
      message:
        '{{months}} měsacow po rjedźe pod planom. Pozdźišo je městno, hdźež dobre zaměry du, zo bychu so zabyli — tutomu dajće datum.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'Waš plan nima městna za čestnosć',
      message:
        'Žadyn z wašich budgetow strowoće, wuknjenju abo druhim njesłuži. Plan pokazuje, što sej cenimy — rozmyslujće, zo byšće čestnosći swójsku linku dał.',
    },
    {
      title: 'Wšě budgety, ale žadyn za dobre',
      message:
        'Potrjeba, dźěło a wotpočink maja hranicy; čestnosć žanu. To, což so ženje njeplanuje, so zwjetša ženje njestawa.',
    },
    {
      title: 'Planujće to, což was lěpšeho čini',
      message:
        'W klasy čestnosće hišće žadyn budget njeje. Tež mały — knihi, sport, dar — přemjeni přeće na zawjazanosć.',
    },
    {
      title: 'Plan wo čestnosći mjelči',
      message:
        'Planujeće za to, což dyrbiće, a za to, což wužiwaće, hišće nic za toho, kiž chceće być. Jedyn skromny budget za čestnosć by to změnił.',
    },
    {
      title: 'Čestnosć nima budget',
      message:
        'Wudawanje za strowotu, wuknjenje abo druhich njeje nikajkež planowane. Wuzwolće jedne a dajće jemu limit, kotryž byšće rady docpěł.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'Potrjeby płaća wjace, hač bě planowane',
      message:
        'Planowali sće {{planned}} % wudawkow za potrjeby; bjeru {{actual}} %. Přepruwujće, hač kóžda je hišće potrjeba abo je so po ćichim komfort stała.',
    },
    {
      title: 'Potrjeba při {{actual}} %, planowane {{planned}} %',
      message:
        'To, což žiwjenje žada, je zwjetša mjenje hač to, na což so zwučimy. Přehladajće najwjetšu potrjebu ze swěžim wokom.',
    },
    {
      title: 'Trěbne so nadymuje',
      message:
        'Potrjeby dźerža {{actual}} % měsaca přećiwo {{planned}} %, kotrež sće wočakował. Potrjeba, kotraž dale rosće, prašenje zasłuži.',
    },
    {
      title: 'Potrjeby plan přerostu',
      message:
        'Planowane {{planned}} %, woprawdźite {{actual}} %. Pak plan woprawdźite kóšty podhódnoći, pak někotre přeća pod mjenom potrjebow pućuja.',
    },
    {
      title: 'Na „dyrbju“ du wjace, hač bě mysleno',
      message:
        'Potrjeby wzachu {{actual}} % wudawkow město {{planned}} %. Dźělće to, což woprawdźe być dyrbi, wot toho, což jenož stajnje bě.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'Potrjeby so horje łazyja',
      message:
        'Wudawki za potrjeby rostu {{months}} měsacow po rjedźe, dohromady {{percent}} %. Potrjeby rostu po ćichim, hdyž nichtó je njenuzuje so wobswědčić.',
    },
    {
      title: '+{{percent}} % při potrjebach w {{months}} měsacach',
      message:
        'Kóždy krok wupadaše mały; dohromady njejsu. Wzmiće najwjetšu wospjetowanu potrjebu a prašejće so, hač dyrbi hišće telko płaćić.',
    },
    {
      title: 'Dno wašich wudawkow so zběha',
      message:
        'Potrjeby rostu {{months}} měsacow po rjedźe (+{{percent}} %). Zběhace so dno mjenje městna za wšo wostaji, což swobodnje wuzwoliće.',
    },
    {
      title: 'Potrjeby so rozšěrjeja',
      message:
        '{{months}} měsacow rosta, dohromady {{percent}} %. Stoiska proba je prosta: byšće to dźensa zaso wuzwolił, znajo płaćiznu?',
    },
    {
      title: 'Małe přirosty, stajny směr',
      message:
        'Potrjeby su w {{months}} měsacach wyše wo {{percent}} %. Směr wjace woznamjenja hač jednotliwy měsac — tutón so hodźi zahe korigować.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'Dźěło płaći wjace, hač bě planowane',
      message:
        'Planowali sće {{planned}} % wudawkow za dźěło; bjerje {{actual}} %. Nastroje a posłužby dyrbja swoje městno zasłužić — přepruwujće, kotre je zasłužuja.',
    },
    {
      title: 'Wudawki za dźěło při {{actual}} %, planowane {{planned}} %',
      message:
        'Inwesticija do dźěła je dobra, hdyž něšto wróći. Přehladajće, za čož płaćiće, ale hižo njewužiwaće.',
    },
    {
      title: 'Budget za dźěło je napjaty',
      message:
        'Dźěło wza {{actual}} % město {{planned}} %. Dźěławosć je dźěło derje činić, nic kóždy nastroj za nje kupować.',
    },
    {
      title: 'Nastroje wudawaja nad planom',
      message:
        'Planowane {{planned}} %, wudate {{actual}} % za dźěło. Při kóždym wudawku so prašejće: pomha mi dźěło činić, abo so jenož kaž postup začuwa?',
    },
    {
      title: 'Kóšty dźěła su so přesunyli',
      message:
        'Dźěło dźerži {{actual}} % wudawkow přećiwo zaměrjenym {{planned}} %. Spěšne přepruwowanje nětko wjetše pozdźišo zalutuje.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '„{{category}}“ stajnje swoju hranicu łama',
      message:
        '„{{category}}“ překroči budget w {{months}} ze poslednich {{window}} měsacow. Pak je hranica wopak, pak přeće — rozsudźće, što.',
    },
    {
      title: '„{{category}}“: nad budgetom {{months}} z {{window}} měsacow',
      message:
        'Hranica, kotraž so stajnje překročuje, hranica njeje, jenož přeće. Čińće ju čestnu — zwyšće ju z wolu abo dźeržće ju z wolu.',
    },
    {
      title: 'Samsny budget zaso popušći',
      message:
        '„{{category}}“ překroči swoju hranicu {{months}} razow w {{window}} měsacach. Wospjetowanje je informacija; wužiwajće ju.',
    },
    {
      title: '„{{category}}“ waše kedźbnosć prosy',
      message:
        'Nad budgetom w {{months}} z {{window}} měsacow. Hladajće na wokomik před kupnjenjom — to je jenička městnosć, hdźež so nawyk změnić hodźi.',
    },
    {
      title: 'Muster w „{{category}}“',
      message:
        '{{months}} překročenjow w {{window}} měsacach. To, což wospjetujemy, so stanjemy; rozsudźće, što chceće, zo tuta kategorija wo was praji.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '„{{category}}“ so wokoło dnja {{day}} wučerpa',
      message:
        'Wudali sće {{spentAmount}} z {{limitAmount}}, a w tutym tempje so hranica wokoło dnja {{day}} kónči. Nětko spomałšić je lóše hač pozdźišo zastać.',
    },
    {
      title: '„{{category}}“ je před měsacom',
      message:
        '{{spentAmount}} je hižo wotešło z hranicy {{limitAmount}}. W tutym tempje budźe wokoło dnja {{day}} wučerpana — zbytk měsaca je weto waš.',
    },
    {
      title: 'Přepruwowanje tempa: „{{category}}“',
      message:
        'Budget {{limitAmount}} při nětčišim tempje traje hač k dnju {{day}}. Předwidźiwosć je najpřihódniša forma discipliny.',
    },
    {
      title: '„{{category}}“ přichod wudawa',
      message:
        '{{spentAmount}} z {{limitAmount}} wudate; hranica so blisko dnja {{day}} kónči. Što tutón tydźeń činiće, rozsudźuje, hač so to stanje.',
    },
    {
      title: 'Zahe warnowanje za „{{category}}“',
      message:
        'Při nětčišim tempje hranica {{limitAmount}} kónc měsaca njedocpěje — wučerpa so wokoło dnja {{day}}. Korigujće, dokulž je přihódne.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '„{{category}}“ wosta njewužity',
      message:
        'Budget za „{{category}}“ njeje wudawki widźał hižo {{months}} měsacow. Pak sće z njeho wurostł, pak je zaměr, kotryž hišće čaka — rozsudźće, što.',
    },
    {
      title: 'Prózdny budget: „{{category}}“',
      message:
        '{{months}} měsacow bjez jednoho wudawka. Plan měł žiwjenje wopisać, kotrež žiwjeće, abo tamne, kotrež twariće — kotre je to?',
    },
    {
      title: '„{{category}}“ steji njewužity',
      message:
        'Tu njeje ničo wudate {{months}} měsacow. Jeli bě to zdźerženosć, derje; jeli njedbawosć, čińće něšto.',
    },
    {
      title: 'Planowane, ale nic přežite',
      message:
        '„{{category}}“ ma hranicu a žane wudawki hižo {{months}} měsacow. Dźeržće plan prawdźiwy: wotstrońće ju abo wužiwajće ju.',
    },
    {
      title: '„{{category}}“: {{months}} ćichich měsacow',
      message:
        'Budget, kotrehož so nichtó njedótkuje, hišće městno we wašim planje wobsadźa. Spušćće městno abo zaměr dopjelńće.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}} % wudawkow nima hranicu',
      message:
        '{{unbudgetedAmount}} z měsaca je do kategorijow šło, kotrež žadyn budget njewobkedźbuje. Što njejsće přehladał, njemóžeće sudźić.',
    },
    {
      title: 'Wulki dźěl měsaca je njeplanowany',
      message:
        '{{percent}} % wudawkow — {{unbudgetedAmount}} — leži zwonka wšěch budgetow. Dajće najwjetšemu dźělu hranicu a plan budźe wjace wašeho žiwjenja widźeć.',
    },
    {
      title: 'Wudawanje zwonka plana',
      message:
        'Budgety pokrywaja jenož dźěl toho, což wudawaće; {{unbudgetedAmount}} ({{percent}} %) wostanje njezměrjene. Rozšěrće plan tam, hdźež pjenjezy woprawdźe du.',
    },
    {
      title: 'Plan widźi jenož dźěl wobraza',
      message: '{{percent}} % wudawkow měsaca nima budget. Jasny pohlad předchadźa dobremu sudej.',
    },
    {
      title: '{{unbudgetedAmount}} wudate bjez hranicy',
      message:
        'To je {{percent}} % měsaca. Njetrjebaće to wobmjezować — jenož rozsudźić, kelko z toho woprawdźe chceće.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '„{{category}}“ je najwjetši dźěl wašeho wotpočinka',
      message:
        '{{percent}} % wudawkow za wotpočink je do „{{category}}“ šło. Wužiwajće to, ale přepruwujće, hač byšće so wot toho wotwobrócić móhł.',
    },
    {
      title: 'Jedna wjesełosć knježi',
      message:
        '„{{category}}“ bjerje {{percent}} % wšeho, což sće za wotpočink wudał. Prašejće so, hač was hišće wjeseli abo je so rutina stała.',
    },
    {
      title: 'Wotpočink so na „{{category}}“ podpěra',
      message:
        '{{percent}} % wotpočinka na jednym městnje. To, bjez čehož njemóžemy, nas dźerži — přepruwujće, hač je dźerženje hišće lochke.',
    },
    {
      title: '„{{category}}“: {{percent}} % wotpočinka',
      message:
        'Jedyn žórłowy wjesela bjerje skoro wšo. Wostańće na chwilu bjez njeho a hladajće, što wam woprawdźe dawa.',
    },
    {
      title: 'Waš wotpočink ma jednu adresu',
      message:
        'Najwjetši dźěl pjenjez za wotpočink, {{percent}} %, du do „{{category}}“. Wot wjesela sće swobodny jenož, jeli byšće bjez njeho wuńdźe móhł.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Dźěl wudawkow hišće pohódnoćeny njeje',
      message:
        '{{count}} kategorijow nima klasu. W Budgetach rozsudźće, što je potrjeba, dźěło, čestnosć abo wotpočink.',
    },
    {
      title: '{{count}} kategorijow na waše pohódnoćenje čaka',
      message:
        'Maja wudawki, ale žanu klasu, tohodla porady je zwažić njemóžeja. Minuta w Budgetach to rozrisa.',
    },
    {
      title: 'Pomjenujće to, čemuž waše pjenjezy słuža',
      message:
        '{{count}} kategorijow je hišće nkategorizowanych. Pohódnoćenje so z tym započina, zo wěcy z prawymi mjenami pomjenujemy.',
    },
    {
      title: 'Njepohódnoćene wudawki: {{count}} kategorijow',
      message:
        'Je to potrjeba, waše dźěło, čestnosć abo wjesełosć? Prajić móžeće jenož wy — a plan so z tym wujasni.',
    },
    {
      title: 'Někotre kategorije nimaja klasu',
      message:
        '{{count}} kategorijow steji zwonka štyrjoch klasow. Kategorizujće je w Budgetach, zo by so kóždy wudawk widźał tak, kajkiž je.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: '{{count}} małych kupnjenjow při {{merchant}}',
      message:
        'Kóžde kupnjenje wupadowaše njeznaćace; zhromadnje činjachu {{totalAmount}} za měsac. W małych, njepruwowanych nawadach pjenjezy najwjace mjelčo zmiznu.',
    },
    {
      title: '{{merchant}}: {{count}}-króć za měsac',
      message:
        '{{totalAmount}} w małych sumach. Prašće so, hač bě kóžde wopyće wuběr abo refleks: jenož prěnje je swoboda.',
    },
    {
      title: 'Po mału: {{totalAmount}}',
      message:
        '{{count}} kupnjenjow při {{merchant}}. Žane jednotliwe njeje wažne; nawyk je. Rozsudźće, kak husto to woprawdźe chceće.',
    },
    {
      title: 'Nawyk při {{merchant}}',
      message:
        '{{count}} kupnjenjow, zhromadnje {{totalAmount}}. Spytajće kóždy třeći přeskočić a hladajće, hač wam so za nim styska.',
    },
    {
      title: 'Małe wěcy so sumuja',
      message:
        '{{merchant}} widźeše was {{count}} razow, za {{totalAmount}}. Knjejstwo nad wulkimi rozsudami so na tajkich małych twari.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Kónc tydźenja njese {{percent}} % wotpočinka',
      message:
        'Najwjetši dźěl wašich wudawkow za wotpočink padnje na sobotu a njedźelu. Wotpočink je dobry; přepruwujće, hač je wotpočink a nic narunanje za tydźeń.',
    },
    {
      title: 'Wotpočink na kóncu tydźenja žiwy je',
      message:
        '{{percent}} % wudawkow za wotpočink padnje na kónc tydźenja. Planujće kónc tydźenja mało a budźe mjenje płaćić a wjace dawać.',
    },
    {
      title: 'Kónc tydźenja za tydźeń płaći',
      message:
        'Kónc tydźenja bjerje {{percent}} % toho, což za wotpočink wudawaće. Jeli dyrbi so tydźeń kóždu sobotu reparować, hladajće na tydźeń.',
    },
    {
      title: 'Sobota a njedźela: {{percent}} % wotpočinka',
      message:
        'Swobodne dny k swobodnemu wudawanju přeprošuja. Rozsudźće před kóncom tydźenja, za čož je, a dajće pjenjezam slědować.',
    },
    {
      title: 'Muster kónca tydźenja',
      message:
        '{{percent}} % wudawkow za wotpočink so na kóncu tydźenja stawa. Lóše dźěłowe dny činja kónc tydźenja husto přihódniši.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} wza {{percent}} % měsaca',
      message:
        '{{totalAmount}} du jednomu předawarjej za wotpočink. Hdyž jedne městno telko wašich pjenjez ma, prašejće so, kelko wašeje kedźbnosće tež ma.',
    },
    {
      title: 'Jedne městno, {{totalAmount}}',
      message:
        '{{merchant}} wza {{percent}} % wudawkow měsaca. Je to takle wulki dźěl wašeho žiwjenskeho dźěła hódny?',
    },
    {
      title: '{{merchant}} waše wudawki wjedźe',
      message:
        '{{percent}} % měsaca — {{totalAmount}} — du tam. Ničo wopak njeje so tomu wjeselić, dołhož byšće to zaso wuzwolił.',
    },
    {
      title: 'Wulki dźěl při {{merchant}}',
      message:
        '{{totalAmount}}, to je {{percent}} % wudawkow, na jednym městnje wotpočinka. Zwažće měrnje wjesełosć přećiwo płaćiznje.',
    },
    {
      title: '{{percent}} % při {{merchant}}',
      message:
        'Tutón jedyn předawar wza {{totalAmount}}. Swoboda je móc nimo hić, hdyž so tak rozsudźiće.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Dochod spadny, wudawki nic',
      message:
        'Dochod spadny {{percent}} % na {{incomeAmount}}, ale wudawki wostachu při {{expenseAmount}}. Zbožo je sej rozmysliło; waše wudawki to hišće njespóznachu.',
    },
    {
      title: 'Dochod dele wo {{percent}} %',
      message:
        '{{incomeAmount}} přińdźe nutř přećiwo {{expenseAmount}} won. Što zbožo da, móže tež wzać — přiměrće wudawki tomu, což je, nic tomu, což bě.',
    },
    {
      title: 'Słabši měsac, samsne nawyki',
      message:
        'Dochod je {{percent}} % nišši ({{incomeAmount}}), a wudawki wostachu při {{expenseAmount}}. Dochod njeje we wašej mocy; wotmołwa je.',
    },
    {
      title: 'Zbožo so přesuny',
      message:
        'Zasłužili sće {{percent}} % mjenje hač zwjetša, ale wudali {{expenseAmount}} kaž prjedy. Skrótšće nětko, dokulž je to wuzwolenje a nic nuza.',
    },
    {
      title: 'Wudawki dochodej njeslědowachu',
      message:
        'Dochod spadny na {{incomeAmount}} ({{percent}} % dele); wudawki su {{expenseAmount}}. Nastajće płachtu na wětr, kotryž woprawdźe maće.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Abonementy: {{monthlyAmount}} na měsac',
      message:
        '{{count}} abonementow bjerje {{percent}} % wašich měsačnych wudawkow. Kóždy so wobnowja, bjez toho zo by so was prašał — prašejće so wo kóždy sami.',
    },
    {
      title: '{{percent}} % wudawkow so same wobnowja',
      message:
        '{{count}} abonementow, {{monthlyAmount}} na měsac. Dźeržće te, na kotrež byšće so dźensa zaso přizjewił.',
    },
    {
      title: 'Ćicho, wospjetowano, {{monthlyAmount}}',
      message:
        '{{count}} abonementow płaći {{percent}} % wašeho měsaca. Komfort je dobry słužobnik a droghi knjez.',
    },
    {
      title: '{{count}} abonementow na přepruwowanje',
      message:
        'Dohromady su {{monthlyAmount}} na měsac, {{percent}} % wudawkow. Wupowědźće jedyn, kotryž lědma wužiwaće, a wobkedźbujće, kak mało wam pobrachuje.',
    },
    {
      title: 'To, což so samo wobnowja',
      message:
        '{{monthlyAmount}} na měsac přez {{count}} abonementow. Awtomatiske wudawanje zasłuži wědome přepruwowanje.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Waš wuspěch móhł mało dale docpěć',
      message:
        'Přez {{months}} měsacow sće {{savingsPercent}} % dochoda zdźeržał, ale druhim z toho nimale ničo njeje šło. Bohatstwo najlěpje w wotewrjenych rukach sedźi — snano jedyn dar abo pomoc tutón měsac?',
    },
    {
      title: 'Derje zasłužuje, mało dawa',
      message:
        '{{incomeAmount}} přińdźe přez {{months}} měsacow a {{givenAmount}} du druhim. Jeli pomhaće na puće, kotrež tuta aplikacija njewidźi, ignorujće to; jeli nic, ma plan za to městno.',
    },
    {
      title: 'Dobre lěto, zo byšće dawkomócny był',
      message:
        'Zalutowali sće {{savingsPercent}} % dochoda — znamjo krutej ruki. Mały dźěl toho, dany někomu w nuzy, by tej krutosći wjace woznama dał.',
    },
    {
      title: 'Na wobrazu hišće nichtó druhi njeje',
      message:
        'Poslednich {{months}} měsacow pokazuje starostne zasłužowanje a lutowanje, ale žanu dobroćinskosć ani dary. Smy jedyn za druheho storjeni; skromny dar dosaha za započatk.',
    },
    {
      title: 'Městno za dobrotu',
      message:
        'Na pomoc druhim du jenož {{givenAmount}} z {{incomeAmount}}. Rozmyslujće wo małej, regularnej pomocy — dawkomócnosć so z nawykom lóša stanje, kaž kóžda čestnosć.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '„{{goal}}“ zady wostawa',
      message:
        'Trjeba {{requiredAmount}} na měsac, a wy kładźeće něhdźe {{paceAmount}}. W tutym tempje přińdźe {{monthsLate}} měs. pozdźišo. Tempo je w wašej mocy.',
    },
    {
      title: '„{{goal}}“: {{monthsLate}} měsacow pozdźišo w tutym tempje',
      message:
        'Trěbne {{requiredAmount}} na měsac, woprawdźite něhdźe {{paceAmount}}. Přesuńće datum čestnje abo přesuńće wjace pjenjez z wolu.',
    },
    {
      title: 'Cil a tempo so njezjednawaja',
      message:
        '„{{goal}}“ prosy {{requiredAmount}} na měsac; dóstawa {{paceAmount}}. Cil je jenož telko woprawdźity kaž měsačny krok k njemu.',
    },
    {
      title: '„{{goal}}“ trjeba krutiši krok',
      message:
        '{{paceAmount}} na měsac přećiwo {{requiredAmount}}, kotrež trjeba. Přichodny měsac zapłaćće cilej jako prěnjemu, před wšěm opcionalnym.',
    },
    {
      title: 'Zastawanje při „{{goal}}“',
      message:
        'Aktualne tempo ({{paceAmount}} na měsac) wostaji jón {{monthsLate}} měs. pozadk. W wašej mocy je přichodny krok, nic cyła dróha.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '„{{goal}}“ so do plana njehodźi',
      message:
        'Trjeba {{requiredAmount}} na měsac, ale po wašich budgetach je jenož {{freeAmount}} swobodne. Změńće datum, cil abo budgety — nadźijeć so plan njeje.',
    },
    {
      title: '„{{goal}}“ prosy wjace, hač swobodneho maće',
      message:
        '{{requiredAmount}} trěbne kóždy měsac, {{freeAmount}} k dispoziciji. Wšo naraz chcyć je puć, zo so ničo njestanje; wuzwolće.',
    },
    {
      title: 'Ličby prajeja ně — hač dotal',
      message:
        '„{{goal}}“ trjeba {{requiredAmount}} na měsac; swobodnych pjenjez maće {{freeAmount}}. Přiměrće to, což je we wašej mocy: termin abo druhe hranicy.',
    },
    {
      title: '„{{goal}}“ trjeba rozsud',
      message:
        'Při {{requiredAmount}} na měsac přewyša {{freeAmount}}, kotrež po budgetach wostanu. Cil, z wotewrjenymi wočimi wuzwoleny, je lěpši hač tón, kotryž prózdna nadźija dźerži.',
    },
    {
      title: 'Njemóžne tempo za „{{goal}}“',
      message:
        'Trěbne {{requiredAmount}} měsačnje, swobodne {{freeAmount}}. Čestna arithmetika nětko zalutuje zrudźenje pozdźišo.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Waš staw spadnje pod nulu {{date}}',
      message:
        'Při wuwiću dochodow a wudawkow, kaž nětko běži, spadnje prognozowany staw na {{lowestAmount}}. Přihotujće so nětko, dokulž je to hišće jenož prognoza.',
    },
    {
      title: 'Deficit přińdźe: {{date}}',
      message:
        'Płaćenja a wšědne wudawki předběhnu dochod, a najnižši staw je {{lowestAmount}}. Přewidźenje ćežkosćow bjerje jim móc.',
    },
    {
      title: 'Liče na {{date}}',
      message:
        'Tón dźeń docpěje prognozowany staw {{lowestAmount}}. Přesuńće zapłaćenje, zdźeržće přeće abo wotstajće pjenjezy — kóžde z toho je dźensa we wašej mocy.',
    },
    {
      title: 'Prognoza spadnje pod nulu',
      message: 'Staw spadnje wokoło {{date}} na {{lowestAmount}}. Měrna wotmołwa je tuta zahe.',
    },
    {
      title: 'Předwidźće dźěru {{date}}',
      message:
        'Prognozowany najnišši staw: {{lowestAmount}}. To, což je předwidźane, hodźi so měrnje přiwzać; to, což nas překwapi, lědma.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Sće swoje słowo sebi dźeržał',
      message:
        '{{months}} měsacow po rjedźe wostachu waše wudawki w planje, kotryž sće postajił. Tak samowobknježenje wupada.',
    },
    {
      title: '{{months}} měsacow w planje',
      message:
        'Měsac po měsacu so to, což sće zaměrił, a to, což sće činił, zjednawaja. Konsekwentnosć je ćichiša hač wola a traje dlěje.',
    },
    {
      title: 'Plan a žiwjenje so zjednawaja',
      message:
        '{{months}} slědowacych měsacow we wašich hranicach. Plan, tak derje dźeržany, hižo njeje wobmjezowanje — je to, kak žiwjeće.',
    },
    {
      title: 'Stabilnje {{months}} měsacow',
      message:
        'Waše budgety dźerža {{months}} měsacow po rjedźe. Dźeržće samsnu kedźbnosć; funguje.',
    },
    {
      title: 'Disciplina, zdźeržana',
      message:
        '{{months}} měsacow bjez łamanja wašeho plana. Mało wěcow tak wuswobodźa kaž dowěra do swójskich rozsudow.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Waše pjenjezy wašim hódnotam slěduja',
      message:
        'Pjenjezy w słužbje čestnosće činjachu {{actual}} % waših wudawkow, nic mjenje hač planowane {{planned}} %. Derje wudate.',
    },
    {
      title: 'Čestnosć dósta swój dospołny dźěl',
      message:
        '{{actual}} % na strowotu, wuknjenje a druhich, přećiwo planowanym {{planned}} %. Za to, což cenjeće, sće zapłaćił.',
    },
    {
      title: 'Wudate na to, zo byšće lěpši był',
      message:
        'Strowota, wuknjenje a druhe dóstachu {{actual}} % wudawkow měsaca (planowane {{planned}} %). Čestnosć njeda so kupić, ale móže so jej słužić.',
    },
    {
      title: 'Zaměr wuwjedźeny',
      message:
        'Planowali sće {{planned}} % za čestnosć a wudali {{actual}} %. Dobre zaměry lědma měsac přežiwja — waše přežiwichu.',
    },
    {
      title: 'Najlěpše wužiwanje pjenjez',
      message: '{{actual}} % du na to, což was a druhich lěpšich čini. Wuzwolujće to dale.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Wotpočink na swojim městnje',
      message:
        'Wotpočink je {{actual}} % wudawkow, pod {{planned}} %, kotrež sće jemu dowolił. Wužiwaće wěcy, bjez toho zo by was wodźili.',
    },
    {
      title: 'Wjesełosć, w měrje dźeržana',
      message:
        'Wotpočink wza {{actual}} % přećiwo planowanym {{planned}} %. Měrnosć njeje něšto přepušćić — je to wuzwolić.',
    },
    {
      title: 'Wotpočink bjez přewjele',
      message:
        '{{actual}} % na wotpočink, pod wašej hranicu {{planned}} %. Wjesele lěpje słodźi, hdyž njeknježi.',
    },
    {
      title: 'Měrnosć, po ćichim',
      message:
        'Wotpočinkej sće {{planned}} % dał a wón wužiwaše jenož {{actual}} %. Ta rezerwa je swoboda, kotruž sće sej zdźeržał.',
    },
    {
      title: 'Wotpočink pod planom',
      message:
        'Při {{actual}} % wudawkow wosta wotpočink pod {{planned}} %, kotrež sće postajił. Derje dźeržane.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '{{percent}} % pod planom',
      message:
        'Wudali sće {{savedAmount}} mjenje, hač sće sej za měsac dowolił. Njetrjebać wšo, štož byšće měć móhł, je druh bohatstwa.',
    },
    {
      title: '{{savedAmount}} wosta njewudate',
      message:
        'Měsac so {{percent}} % pod planom skónči. To, což sće njewudał, je hišće waše, zo byšće z tym rozsudźił.',
    },
    {
      title: 'Mjenje, hač sće dowolił',
      message:
        'Wudawki su {{percent}} % pod planom — {{savedAmount}} wosta. Dajće tej rezerwje zaměr, prjedy hač ju nawyk wza.',
    },
    {
      title: 'Plan měješe rezerwu',
      message:
        '{{savedAmount}} pod wašimi mjezemi za měsac. Zdźerżnosć, kotraž so lochko čuje, je ta, kotraž traje.',
    },
    {
      title: 'Lóše, hač bě planowane',
      message:
        'Trjebali sće {{percent}} % mjenje, hač sće budgetował. Rozmyslujće, zo byšće {{savedAmount}} k cilej pósłał.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '„{{goal}}“ je po planje',
      message:
        'Přešli sće {{percent}} % puća, w tempje, kotrež cil trjeba. Krute kroki, měsačnje činjene, dale docpěja.',
    },
    {
      title: 'Na puću k „{{goal}}“',
      message: '{{percent}} % hotowe a tempo dźerži. Dale płaćće cilej jako prěnjemu; funguje.',
    },
    {
      title: '„{{goal}}“: {{percent}} % a stabilnje',
      message: 'Cil kóždy měsac dóstawa to, což trjeba. Sćerpnosć swoje čini.',
    },
    {
      title: 'Cil so po planje hiba',
      message:
        '„{{goal}}“ je {{percent}} % financowany a na času. To, což so po mału kóždy měsac čini, jedyn špatny tydźeń njezastaji.',
    },
    {
      title: 'Postup, kotremuž móžeće wěrić',
      message:
        '„{{goal}}“ steji na {{percent}} %, w tempje. Twariće jón na jenički puć, kotryž funguje — postupnje.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: 'Mjenje impulsiwnych kupnjenjow při {{merchant}}',
      message:
        'Z {{before}} kupnjenjow za měsac na chětro {{after}}. Wolóžena nawada je dobyta swoboda.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'Chodźiće tam mjenje hač prjedy. Kóždy přeskočeny refleks je małe dobyće wuzwolenja nad nawykom.',
    },
    {
      title: 'Mały nawyk so zmjeńša',
      message:
        'Kupnjenja při {{merchant}} spadnychu wot {{before}} na něhdźe {{after}}. Dźiće dale — stanje so lóše.',
    },
    {
      title: 'Wuzwolenje město refleksa',
      message:
        'Při {{merchant}} sće wot {{before}} kupnjenjow na něhdźe {{after}} přešoł. To je knjejstwo, po jednym rozsudźe twarjene.',
    },
    {
      title: 'Mjenje małych wěcow',
      message:
        '{{merchant}} widźeše was něhdźe {{after}} razow město {{before}}. Małe dobyća so sumuja.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Přiměrili sće so słabšemu měsacej',
      message:
        'Dochod spadny {{incomePercent}} %, a wy sće wudawki {{expensePercent}} % skrótšił. Na změnu zboža sće ze změnu kursa wotmołwił.',
    },
    {
      title: 'Měrnosć, hdyž dochod spadny',
      message:
        'Dochod dele {{incomePercent}} %, wudawki dele {{expensePercent}} %. Přiměrili sće so tomu, což je, nic tomu, což bě.',
    },
    {
      title: 'Zbožo so změni; a wy tež',
      message:
        'Spad dochoda wo {{incomePercent}} % zetka spad wudawkow wo {{expensePercent}} %. To je runowaha w ličbach.',
    },
    {
      title: 'Derje wodźene',
      message:
        'Hdyž dochod {{incomePercent}} % spadny, slědowachu wudawki ({{expensePercent}} % mjenje). Wětr njebě waš; płachta bě.',
    },
    {
      title: 'Wudawki dochodej dele slědowachu',
      message:
        'Wudali sće {{expensePercent}} % mjenje, hdyž dochod {{incomePercent}} % spadny. Zahe so přiměrić je měrny puć přez.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'Potrjeby su stabilne',
      message:
        '{{months}} měsacow waše trěbne kóšty so nimale njehibachu. Stabilne dno wam swobodu nad njim dawa.',
    },
    {
      title: 'Potrjeby pod kontrolu',
      message:
        'Wudawki za potrjeby wostachu runje {{months}} měsacow. Potrjeby, kotrež njerostu, su potrjeby, kotrež wobknježiće.',
    },
    {
      title: '{{months}} měsacow stabilnych potrjebow',
      message: 'Nawjam, jědź a zličbowanki wostachu, hdźež bychu. Ćicha stabilnosć je tež wukon.',
    },
    {
      title: 'Žane łazenje při potrjebach',
      message:
        '{{months}} měsacow bjez přesunjenja w tym, což žiwjenje žada. Wšo druhe so na tym zakładźe lóše planuje.',
    },
    {
      title: 'Krute dno',
      message:
        'Trěbne wudawki su stabilne {{months}} měsacow. Njedawaće komfortam jako potrjebam přeńć.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Dawkomócny z tym, což zasłužuće',
      message:
        'Přez {{months}} měsacow du {{percent}} % wašeho dochoda — {{givenAmount}} — na pomoc druhim. To su pjenjezy w swojim najlěpšim wužiwanju.',
    },
    {
      title: '{{givenAmount}} druhim dane',
      message:
        'Přez {{months}} měsacow sće {{percent}} % swojeho dochoda dźělił. Dobrota, kotraž so w ličbach pokazuje, je dobrota praktikowana, nic jenož začuwana.',
    },
    {
      title: 'Wotewrjene ruki',
      message:
        'Dobroćinskosć a dary wzachu w poslednim času {{percent}} % wašeho dochoda. To, což dawaće, je tón dźěl bohatstwa, kotryž žane njezbožo wzać njemóže.',
    },
    {
      title: 'Dawkomócnosć je dźěl wašeho plana',
      message:
        '{{givenAmount}} druhim přez {{months}} měsacow. Dźeržće to — dobre, kotrež druhim činiće, je tež za was činjene.',
    },
    {
      title: 'Derje dane',
      message:
        '{{percent}} % toho, což sće zasłužił, du na pomoc druhim. Mało nawykow wjace wo čłowjeku praji.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Ničo za korigowanje',
      message: 'Waše wudawki wotpowěduja tomu, což sće zaměrił. Dźiće dale, kaž sće.',
    },
    {
      title: 'Zaměr a čin so zjednawaja',
      message: 'Měsac wupada tak, kaž sće jón planował. Tuta zhoda je cyły zmysł.',
    },
    {
      title: 'Měrny měsac',
      message:
        'Žane přewjele, žana njedbawosć, kotraž by so naspomnić hodźała. Derje — njesće samsnu kedźbnosć dale.',
    },
    {
      title: 'Wšo w porjadku',
      message:
        'Waš plan wutraje a ničo korekturu njeprosy. Wužiwajće měr, kotryž sće sej zasłužił.',
    },
    {
      title: 'Kruta ruka',
      message: 'Měsac wašemu planej slědowaše. Dobre nawyki činja dobre měsacy wšědne.',
    },
  ],
  'stoic.keep_first': [
    {
      title: 'Najprjedy sej swój dźěl wobchowajće',
      message:
        'Za {{months}} měs. sće sej {{savingsPercent}} % dochodu wobchował. Senecowe warnowanje: je přepozdźe šetrić, hdyž sće na dno sudka dóšoł. Wotpołožće {{tenthAmount}} w dnju, hdyž dochod přińdźe.',
    },
    {
      title: 'Šetrić wot wjerška sudka',
      message:
        'Jenož {{savingsPercent}} % dochodu je wam wostało. Šetrnosć, kotraž na zbytk čaka, přińdźe přepozdźe; {{tenthAmount}} na měsac, jako prěnje wotpołožene, ju nětko započina.',
    },
    {
      title: 'Což je waše, to dźeržće',
      message:
        'Seneca radźi wobchować to, což woprawdźe waše je, a zahe započeć. Poslednje časy wam {{savingsPercent}} % dochodu wostawa; započńće z {{tenthAmount}} w dnju popłata a dajće wudawkam so po zbytku rjadować.',
    },
    {
      title: 'Započńće prjedy hač na kwasnicach',
      message:
        'Za {{months}} měs. sće sej {{savingsPercent}} % wobchował. Šetrić je w wašej mocy jenož, doniž hišće něšto k šetrjenju je: přesuńće {{tenthAmount}} do boka prjedy hač wšo druhe.',
    },
    {
      title: 'Wobchowane {{savingsPercent}} %, a sudk so wuprózdnja',
      message:
        '{{tenthAmount}} na měsac, dźesatina dochodu, wotpołožena prjedy hač někajka płaćizna. To, což sej prěnje wobchowaće, wotwisuje wot toho, što měsac wostaji, njewotwisuje.',
    },
  ],
  'stoic.prepare_beforehand': [
    {
      title: 'Přihotujće so, doniž je měrno',
      message:
        'Waša rezerwa dosaha za chětro {{cushionDays}} dnjow wudawkow. Seneca: duša dyrbi so w časach bjez starosćow zwučować. Wudawki za tři měsacy su {{targetAmount}}.',
    },
    {
      title: 'Rezerwa za {{cushionDays}} dnjow',
      message:
        'Fortuna so njepowěda. Natwarće rezerwu k {{targetAmount}}, wudawkam za tři měsacy, doniž ničo njetłóči: potom je to lochko.',
    },
    {
      title: '„Bě to staw, kotrehož so bojach?“',
      message:
        'Seneca da Luciliju khudobu zwučować, zo by swój strach zhubiła. Z rezerwu za {{cushionDays}} dnjow njebyło by jedyn ćežki měsac žane zwučowanje. Mějće {{targetAmount}} za zaměr.',
    },
    {
      title: 'Přewidźće ćežki měsac',
      message:
        'Wašě spórjenja byštej dosahałoj za chětro {{cushionDays}} dnjow. Což so přewidźi, přińdźe mjechko; {{targetAmount}} by was tři měsacy njesło.',
    },
    {
      title: 'Natwarće murju prjedy hač wichor',
      message:
        'Pokrytych je něhdźe {{cushionDays}} dnjow. Zhubjenje dochoda njeje w wašej mocy, rezerwa pak je. Wudawki za tři měsacy činja {{targetAmount}}.',
    },
  ],
  'stoic.wants_outrun_income': [
    {
      title: 'Přeća so dochodej wotběhaja',
      message:
        'Wudawki su w poslednim kwartalu wo {{expenseGrowth}} % rosćeli, dochod so wo {{incomeGrowth}} % změnił. Nic ten, štóž ma přemało, je khudy, piše Seneca, ale ten, štóž wjace žada.',
    },
    {
      title: 'Wyše žiwy, nic lěpje',
      message:
        'Wudawki su wo {{expenseGrowth}} % rosćeli, dochod wo {{incomeGrowth}} %. Trěbnosće přirody su małe; požadanja mjenjenja su bjez mjezow. Prašće so, kotremu z nich přirost słuži.',
    },
    {
      title: 'Přeća su porosćeli: +{{expenseGrowth}} %',
      message:
        'Wudawki su spěšnišo rosćeli hač dochod ({{incomeGrowth}} %). Nowy komfort so bórze jako trěbnosć jewi: wobkedźbujće jón, doniž móžeće hišće wotpokazać.',
    },
    {
      title: 'Cil so posuwa',
      message:
        'Wudawki su wo {{expenseGrowth}} % wyše hač w kwartalu do toho, dochod wo {{incomeGrowth}} %. Dosć wostanje dosć jenož, jeli sami postajiće, što to je.',
    },
    {
      title: 'Wjace njeje lěk',
      message:
        'W poslednim kwartalu wudawki wo {{expenseGrowth}} % a dochod wo {{incomeGrowth}} % rosćechu. Bohatstwo, kotrež z přećom rosće, njedóńdźe ženje; postajće mjezu, prjedy hač so z tohole nowa normalnosć stanje.',
    },
  ],
  'stoic.price_in_life': [
    {
      title: '{{merchant}} je was {{hours}} hodźin žiwjenja płaćił',
      message:
        'Seneca dopomina, zo jenož čas je woprawdźe naš. {{totalAmount}} pola poskićowarja {{merchant}} je něhdźe {{hours}} hodźin waše dźěło. Bě to hódne?',
    },
    {
      title: '{{hours}} hodźin: {{merchant}}',
      message:
        'Pjenjezy strażimy, čas pak rozdawamy. Při wašim přerězkowym hodźinskim dochodźe je {{totalAmount}} tu chětro {{hours}} dźěłowych hodźin.',
    },
    {
      title: 'Płaćizna w hodźinach',
      message:
        '{{totalAmount}} pola poskićowarja {{merchant}} je něhdźe {{hours}} hodźin dźěła. Hodźiny su jenički wěc, kotruž njemóžeće sej wróćo zasłužić.',
    },
    {
      title: 'Što je {{merchant}} woprawdźe płaćił',
      message:
        'Dny měnjeće za pjenjezy a pjenjezy za wěcy. {{merchant}} je wam něhdźe {{hours}} hodźin wzał ({{totalAmount}}). Wotpowěduje wjesele tutym hodźinam?',
    },
    {
      title: 'Zwažće hodźiny',
      message:
        'Přeličene na waš přerězkowy hodźinski dochod je {{totalAmount}} pola poskićowarja {{merchant}} něhdźe {{hours}} hodźin. Wulki dźěl swojeho časa zhubimy, piše Seneca. Sće to wuzwolił?',
    },
  ],
  'stoic.rule_broken': [
    {
      title: 'Prawidło „{{rule}}“ je zabłudźiło',
      message:
        'Pokazuje na něšto, což wjace njeje, a tak je mjelčo přestało fungować. Porjedźće abo wotstrońće: porjad, kotryž ničo nječini, jenož kaž porjad wupada.',
    },
    {
      title: '„{{rule}}“ wjace njedźěła',
      message:
        'Jeho kategorija, konto abo přijimar su preč, a prawidło so při kóždej transakciji přeskoči. Hladajće na wěcy, kaž su, a porjedźće je potom.',
    },
    {
      title: 'Prawidło, kotrež na ničo njecěli',
      message:
        '„{{rule}}“ posyła transakcije na městno, kotrež je so wotstroniło. Raz sće so rozsudźił; rozsudźće so znowa, dokelž su so wěcy změnili.',
    },
    {
      title: '„{{rule}}“ trjeba waš sud',
      message:
        'Na čož pokazuje, je so zničiło, a transakcije, kotrež do toho zarjadowaše, čakaja nětko na was. Dajće jemu nowy cil abo jón pušćće.',
    },
    {
      title: 'Połamane prawidło, mjelčo',
      message:
        '„{{rule}}“ ničo nječini a ničo wo tym njewěsća. Porjedźće, což je w wašej mocy: trjeba to minutu.',
    },
  ],
  'stoic.rule_contradicted': [
    {
      title: 'Waša ruka so z „{{rule}}“ njezhoduje',
      message:
        '{{count}}-króć sće z ruku hinak zarjadował, hač to prawidło činja. Abo je prawidło zmylne abo ruka: rozsudźće, štó.',
    },
    {
      title: '„{{rule}}“ bu {{count}}-króć přewinjene',
      message:
        'Prawidło, kotrež stajnje korigujeće, njeje wjace rozsud, jenož nawada, so z sobu hrajkać. Změńće je abo jemu dowěrće.',
    },
    {
      title: 'Prajće, což činiće, a čińće, což sće prajił',
      message:
        'Prawidło „{{rule}}“ praji jedne; waše poslednje {{count}} korekturow praji druhe. Přiwjedźće wobej do zhody.',
    },
    {
      title: 'Wobsporjeny rozsud',
      message:
        'Prawidło „{{rule}}“ sće ze zymnej hłowu postajił, a {{count}} transakcijow je wot toho časa hinak šło. Pohladajće znowa, w měrje, štó z was prawje měješe.',
    },
    {
      title: '{{count}} korekturow přećiwo „{{rule}}“',
      message:
        'Wospjetowanje je informacija. Dajće jej prawidło změnić abo dajće prawidłu nawadu změnić.',
    },
  ],
  'stoic.rule_worth_writing': [
    {
      title: 'Rozsudźće raz: {{payee}}',
      message:
        'Přijimarja {{payee}} sće {{decided}}-króć z ruku zarjadował, přeco samsnje. Což zaso a zaso rozsudźeće, rozsudźće raz, ze zymnej hłowu.',
    },
    {
      title: 'Rozsud {{decided}}-króć přijaty',
      message:
        'Přijimar {{payee}} stajnje samsne prašenje stawa a wy stajnje samsnu wotmołwu dawaće. Prawidło by waše kedźbnosće za to wobchowało, štož ju woprawdźe trjeba.',
    },
    {
      title: 'Přijimarjow, kotřiž su hotowi za prawidło: {{count}}',
      message:
        'Samsni přijimarjo dóstawaja wot was samsnu kategoriju, najbóle {{payee}}. Wobchowajće sud za nowe wěcy.',
    },
    {
      title: 'Waša nawada je hotowa, zo by zasada była',
      message:
        'Přijimarja {{payee}} zarjaduje kóždy króć samsnje (dotal {{decided}}-króć). Zapisajće to jako prawidło a budźe bjez prózy dźeržeć.',
    },
    {
      title: 'Dajće prawidłu to njesć',
      message:
        'Přijimarjow, kotrychž zarjaduje kóždy króć samsnje: {{count}}, při přijimarju {{payee}} {{decided}} transakcijow. Zasada, raz rozsudźena, njetrjeba so znowa wobsporować.',
    },
  ],
  'stoic.rule_idle': [
    {
      title: '„{{rule}}“ njeje {{months}} měs. ničo dótknyło',
      message:
        'Abo je swět, za kotryž bu wutworjene, preč, abo jeho wuměnjenja cil minu. Dźeržće swoje prawidła wěrne: porjedźće abo wotstrońće.',
    },
    {
      title: 'Prawidło w měrje: „{{rule}}“',
      message:
        'Njeje so {{months}} měs. žanej transakciji dótknyło. Zahońće, štož je zbytne; tomu, štož wostanje, je lěpje dowěrić.',
    },
    {
      title: '„{{rule}}“ stejí njedźěławje',
      message:
        '{{months}} měs. bjez wotpowědnika, mjeztym zo nowe transakcije přińdu. Spytajće je na najnowšich transakcijach a rozsudźće potom.',
    },
    {
      title: 'Trjeba so „{{rule}}“ hišće?',
      message:
        '{{months}} měs. ničo jemu njewotpowěduje. Prawidło, kotrež so z nawady dźerži, je jedna wěc wjace, wo kotruž so starać dyrbiće.',
    },
    {
      title: 'Rozsud, kotryž nima ničo rozsudźić',
      message:
        '„{{rule}}“ mjelči {{months}} měs. Porjad woznamjenja měć, což trjebaće, a nic wjace.',
    },
  ],
  'stoic.praise_rules_hold': [
    {
      title: 'Waše rozsudy dźerža',
      message:
        'Prawidła su {{percent}} % transakcijow měsaca zarjadowali, a wy njejsće dyrbjał ani jedne přewinyć. Rozsud, raz přijaty a dodźeržany, duchu swobodu dawa.',
    },
    {
      title: '{{percent}} % předewzaty rozsud',
      message:
        'Wjetšina transakcijow měsaca bu po tym zarjadowana, što sće prjedy rozsudźił. To je kedźbnosć wobchowana za to, což zaleži.',
    },
    {
      title: 'Zasady w skutku',
      message:
        'Waše prawidła su {{percent}} % transakcijow bjez sporu wuhotowali. Zakótwjene zasady činja dny měrne.',
    },
    {
      title: 'Mjenje rozsudźić',
      message:
        '{{percent}} % transakcijow njetrjebaše žadyn nowy rozsud. Sće raz, derje, sudźił, a sud hišće płaći.',
    },
    {
      title: 'Porjad wobchowany',
      message:
        'Prawidła su {{percent}} % měsaca zarjadowali a žane njebu sporowane. Dobry porjad wupada, kaž by so ničo njeje stało.',
    },
  ],
  'stoic.goal_no_date': [
    {
      title: '„{{goal}}“ nima datum',
      message:
        'Steji při {{percent}} % a ničo do njeho njetyje. Hdyž čłowjek njewě, kotry přistaw naměrja, žadyn wjetřik njeje prawy: pomjenujće dźeń, hdyž chceće dóńć.',
    },
    {
      title: 'Přeće abo cil?',
      message:
        '„{{goal}}“ nima termin ani tempo. Cil je rozsud z datumom; dajće jemu jón abo jón pušćće.',
    },
    {
      title: 'Pomjenujće dźeń: „{{goal}}“',
      message:
        'Je {{percent}} % dospołny a so njehibje. Což móže so kóždy čas činić, so rědko činja.',
    },
    {
      title: '„{{goal}}“ čaka na „někajkižkuli čas“',
      message:
        'Poslednje časy ničo do njeho njeje šło a žadyn datum ničo nježada. „Někajkižkuli čas“ njeje we wašim kalenderje; wuzwolće dźeń, kotryž tam je.',
    },
    {
      title: 'Cil „{{goal}}“ nima přistaw',
      message: 'Při {{percent}} %, bjez terminu. Wjedźće, hdźe pluwaće, a měsačny krok sćěhuje.',
    },
  ],
};
