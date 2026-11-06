import type { StoicTextMap } from './types';

export const nn: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'Månaden voks ut over planen sin',
      message:
        'Du planla {{plannedAmount}} og har brukt {{spentAmount}} — {{percent}} % meir. Planen vart lagd med klårt hovud; lat han tale høgare enn augneblinken.',
    },
    {
      title: '{{percent}} % over det du ville bruke',
      message:
        'Forbruket står på {{spentAmount}} mot ein plan på {{plannedAmount}}. Sjå på kva grense som gav etter først — der ligg lærdomen.',
    },
    {
      title: 'Planen din og månaden din er usamde',
      message:
        '{{spentAmount}} brukt, {{plannedAmount}} tenkt. Anten kravde planen for lite av røyndomen, eller røyndomen kravde for mykje av deg — avgjer roleg kva.',
    },
    {
      title: 'Meir gjekk ut enn du tillét',
      message:
        'Månaden er {{percent}} % over dei {{plannedAmount}} du sette. Ingenting er tapt ved å stoppe no; mykje er tapt ved å late som det ikkje hende.',
    },
    {
      title: 'Ei grense du sette, ei grense du kryssa',
      message:
        'Du ville bruke {{plannedAmount}}; det er {{spentAmount}}. Sjølvkontroll er ikkje å aldri skli — det er å merke det tidleg og vende attende til stien.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Fritid tek meir enn du planla',
      message:
        'Du ville at fritida skulle vere {{planned}} % av forbruket; ho vart {{actual}} %. Nyting er velkomen som gjest, ikkje som husets herre.',
    },
    {
      title: 'Fritid på {{actual}} %, planlagt {{planned}} %',
      message:
        'Kvile fortener plassen sin når ho gir deg krefter att. Spør kva for gleder i månaden som gjorde det, og la resten gå utan anger.',
    },
    {
      title: 'Komfort brukar meir enn hensikta',
      message:
        'Fritida held {{actual}} % av forbruket mot dei {{planned}} % du valde. Måtehald er ikkje å avvise nyting — det er å halde henne i den storleiken du bestemte.',
    },
    {
      title: 'Det behagelege fortrengjer det planlagde',
      message:
        'Du gav fritida {{planned}} % av planen, og ho tok {{actual}} %. Det du nyt utan strev, er verdt eit nytt blikk før det blir det du treng.',
    },
    {
      title: 'Fritida har gått over streken',
      message:
        '{{actual}} % av månaden gjekk til fritid, {{planned}} % var hensikta. Streken var din å teikne, og han er din å halde.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Fritid over plan igjen',
      message:
        'Fritida gjekk ut over planen din i {{months}} av dei siste {{window}} månadene. Ei gjentaking er ikkje lenger eit uhell — det er ein vane verdt å undersøkje.',
    },
    {
      title: '{{months}} av {{window}} månader over fritidsplanen',
      message:
        'Det som hender éin gong, er omstende; det som hender {{months}} gonger, er karakter i støypeskeia. Vel karakteren med vilje.',
    },
    {
      title: 'Same feilsteg, månad etter månad',
      message:
        'Fritida sprang frå planen i {{months}} av {{window}} månader. Hev planen ærleg eller endre vanen — å leve mellom dei to kostar mest.',
    },
    {
      title: 'Eit mønster, ikkje eit unntak',
      message:
        'I {{months}} av dei siste {{window}} månadene tok fritida meir enn du gav henne. Legg merke til augneblinken avgjerda blir teken, ikkje berre rekninga etterpå.',
    },
    {
      title: 'Vanen røystar mot planen din',
      message:
        'Fritida slo planen {{months}} gonger på {{window}} månader. Vanar blir bygde eitt val om gongen; slik blir dei òg avvikla.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'Dygd får mindre enn du tenkte',
      message:
        'Du sette av {{planned}} % av budsjettet til helse, læring og anna; det vart {{actual}} %. Ei hensikt tel først når ho er gjennomført.',
    },
    {
      title: 'Dygd på {{actual}} % av planlagde {{planned}} %',
      message:
        'Pengane du hadde tenkt til det som gjer deg betre, ventar framleis. Det finst ikkje noko betre tidspunkt å bruke dei godt på enn no.',
    },
    {
      title: 'Det gode du planla, er ubrukt',
      message:
        'Helse, læring og gåvmildheit skulle få {{planned}} % av forbruket; dei fekk {{actual}} %. Gjer éin av dei denne veka, medvite.',
    },
    {
      title: 'Hensikt utan handling',
      message:
        'Dygd held {{actual}} % av forbruket mot dei {{planned}} % du valde. Det vi set pris på, viser seg i det vi faktisk betaler for.',
    },
    {
      title: 'Det er rom att til det som tel',
      message:
        'Berre {{actual}} % gjekk til dygd, sjølv om du planla {{planned}} %. Ei bok, ein helsesjekk, ei gåve til nokon som treng det — planen har alt sagt ja.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'Dygd blir stadig utsett',
      message:
        'Forbruket på helse, læring og andre har lege under planen din {{months}} månader på rad. Det du stadig utset, har du i røynda bestemt deg mot.',
    },
    {
      title: '{{months}} månader med utsett dygd',
      message:
        'Kvar månad gav planen rom til det som gjer deg betre, og kvar månad vart det ubrukt. Tid er det eine du ikkje kan budsjettere to gonger.',
    },
    {
      title: 'Det betre sjølvet ventar framleis',
      message:
        'Dygd har lege under plan {{months}} månader på rad. Byrj lite og sikkert framfor stort og seinare.',
    },
    {
      title: 'Gode hensikter eldast',
      message:
        'I {{months}} månader fekk helse, læring og gåvmildheit mindre enn du planla. Vel éin og finansier han først neste månad, før noko anna.',
    },
    {
      title: 'Dygd taper stadig for «seinare»',
      message:
        '{{months}} månader på rad under plan. Seinare er der gode hensikter går for å bli gløymde — gi denne ein dato.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'Planen din har ikkje rom for dygd',
      message:
        'Ingen av budsjetta dine tener helse, læring eller andre. Ein plan viser kva vi set pris på — vurder å gi dygd si eiga linje.',
    },
    {
      title: 'Alle budsjett, men ingen til det gode',
      message:
        'Nødvende, arbeid og fritid har alle grenser; dygd har ingen. Det som aldri blir planlagt, har ein tendens til aldri å hende.',
    },
    {
      title: 'Planlegg det som gjer deg betre',
      message:
        'Det finst enno ikkje noko budsjett i dygdklassen. Jamvel eit lite — bøker, sport, ei gåve — gjer eit ønske til ei forplikting.',
    },
    {
      title: 'Planen er tagal om dygd',
      message:
        'Du budsjetterer for det du må og det du nyt, enno ikkje for den du vil bli. Eitt beskjedent dygdbudsjett ville endre det.',
    },
    {
      title: 'Dygd har ikkje budsjett',
      message:
        'Forbruk på helse, læring eller andre er ikkje planlagt nokon stad. Vel éin og gi han ei grense du ville vere glad for å nå.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'Nødvende kostar meir enn planlagt',
      message:
        'Du planla {{planned}} % av forbruket til nødvende; dei tek {{actual}} %. Sjekk om kvart av dei framleis er eit behov eller stilt har vorte ein komfort.',
    },
    {
      title: 'Nødvende på {{actual}} %, planlagt {{planned}} %',
      message:
        'Det livet krev, er vanlegvis mindre enn det vi venner oss til. Gå gjennom det største nødvendet med friske auge.',
    },
    {
      title: 'Det nødvendige svell',
      message:
        'Nødvende held {{actual}} % av månaden mot dei {{planned}} % du venta. Eit behov som held fram med å vekse, fortener eit spørsmål.',
    },
    {
      title: 'Behova veks ut over planen',
      message:
        'Planlagt {{planned}} %, faktisk {{actual}} %. Anten undervurderte planen dei reelle kostnadene, eller nokre ønske reiser under namnet behov.',
    },
    {
      title: 'Meir brukt på «må» enn meint',
      message:
        'Nødvende tok {{actual}} % av forbruket i staden for {{planned}} %. Skil det som verkeleg må vere, frå det som berre alltid har vore.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'Nødvende kryp oppover',
      message:
        'Forbruket på nødvende har stige {{months}} månader på rad, {{percent}} % i alt. Behov veks stilt når ingen ber dei rettferdiggjere seg.',
    },
    {
      title: '+{{percent}} % på nødvende i {{months}} månader',
      message:
        'Kvart steg verka lite; til saman er dei det ikkje. Ta det største gjentakande nødvendet og spør om det framleis må koste så mykje.',
    },
    {
      title: 'Golvet i forbruket ditt stig',
      message:
        'Nødvende voks {{months}} månader på rad (+{{percent}} %). Eit stigande golv gir mindre rom for alt du vel fritt.',
    },
    {
      title: 'Behova utvidar seg',
      message:
        '{{months}} månader med vekst, {{percent}} % i alt. Den stoiske prøva er enkel: ville du valt dette igjen i dag, med prisen kjend?',
    },
    {
      title: 'Små aukingar, stabil retning',
      message:
        'Nødvende er opp {{percent}} % over {{months}} månader. Retninga tyder meir enn nokon einskild månad — denne er verdt å rette tidleg.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'Arbeid kostar meir enn planlagt',
      message:
        'Du planla {{planned}} % av forbruket til arbeid; det tek {{actual}} %. Verktøy og tenester må gjere seg fortente — sjekk kva som gjer det.',
    },
    {
      title: 'Arbeidsforbruk på {{actual}} %, planlagt {{planned}} %',
      message:
        'Investering i arbeidet ditt er god når ho gir noko att. Gå gjennom kva du betaler for men ikkje lenger brukar.',
    },
    {
      title: 'Arbeidsbudsjettet er strekt',
      message:
        'Arbeid tok {{actual}} % i staden for {{planned}} %. Flid er å gjere arbeidet godt, ikkje å kjøpe kvart verktøy til det.',
    },
    {
      title: 'Verktøy brukar meir enn planen',
      message:
        'Planlagt {{planned}} %, brukt {{actual}} % på arbeid. Spør om kvar utgift: hjelper ho meg å gjere arbeidet, eller kjennest ho berre som framgang?',
    },
    {
      title: 'Arbeidskostnadene har glidd',
      message:
        'Arbeid held {{actual}} % av forbruket mot {{planned}} % tenkt. Ein rask gjennomgang no sparer ein større seinare.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '«{{category}}» bryt grensa si stadig',
      message:
        '«{{category}}» gjekk over budsjett i {{months}} av dei siste {{window}} månadene. Anten er grensa feil, eller lysta er — avgjer kva.',
    },
    {
      title: '«{{category}}»: over budsjett {{months}} av {{window}} månader',
      message:
        'Ei grense som alltid blir kryssa, er inga grense, berre eit ønske. Gjer henne ærleg — hev henne med vilje eller hald henne med vilje.',
    },
    {
      title: 'Same budsjett gir etter igjen',
      message:
        '«{{category}}» har overskride grensa si {{months}} gonger på {{window}} månader. Gjentakinga er informasjon; bruk henne.',
    },
    {
      title: '«{{category}}» ber om merksemda di',
      message:
        'Over budsjett i {{months}} av {{window}} månader. Følg med på augneblinken før kjøpet — det er den einaste staden vanen kan endrast.',
    },
    {
      title: 'Eit mønster i «{{category}}»',
      message:
        '{{months}} overskridingar på {{window}} månader. Det vi gjentar, blir vi; bestem kva du vil at denne kategorien skal seie om deg.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '«{{category}}» går tom rundt dag {{day}}',
      message:
        'Du har brukt {{spentAmount}} av {{limitAmount}}, og i dette tempoet tek grensa slutt rundt dag {{day}}. Å senke farten no er lettare enn å stoppe seinare.',
    },
    {
      title: '«{{category}}» er framfor månaden',
      message:
        '{{spentAmount}} er alt borte av ei grense på {{limitAmount}}. I dette tempoet er ho oppbrukt rundt dag {{day}} — resten av månaden er framleis din å forme.',
    },
    {
      title: 'Tempokontroll: «{{category}}»',
      message:
        'Budsjettet på {{limitAmount}} held til rundt dag {{day}} i dagens tempo. Framsyn er den billegaste forma for disiplin.',
    },
    {
      title: '«{{category}}» brukar framtida',
      message:
        '{{spentAmount}} av {{limitAmount}} brukt; grensa tek slutt nær dag {{day}}. Det du gjer denne veka, avgjer om det hender.',
    },
    {
      title: 'Tidleg varsel for «{{category}}»',
      message:
        'I dagens tempo rekk ikkje grensa på {{limitAmount}} til månadsslutt — ho går tom rundt dag {{day}}. Juster mens det kostar lite.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '«{{category}}» har stått ubrukt',
      message:
        'Budsjettet for «{{category}}» har ikkje hatt forbruk på {{months}} månader. Anten har du vakse ut av det, eller det er ei hensikt som framleis ventar — avgjer kva.',
    },
    {
      title: 'Eit tomt budsjett: «{{category}}»',
      message:
        '{{months}} månader utan ei einaste utgift. Ein plan bør skildre livet du lever eller det du byggjer — kva er dette?',
    },
    {
      title: '«{{category}}» står stille',
      message:
        'Ingenting brukt her på {{months}} månader. Var det tilbakehald, godt gjort; var det forsøming, gjer noko med det.',
    },
    {
      title: 'Planlagt, men ikkje levd',
      message:
        '«{{category}}» har hatt ei grense og ingen forbruk i {{months}} månader. Hald planen sannferdig: fjern henne eller bruk henne.',
    },
    {
      title: '«{{category}}»: {{months}} stille månader',
      message:
        'Eit budsjett som aldri blir rørt, tek framleis plass i planen din. Frigjer plassen eller ær hensikta.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}} % av forbruket har inga grense',
      message:
        '{{unbudgetedAmount}} av månaden gjekk til kategoriar som inga budsjett våker over. Det du ikkje har sett på, kan du ikkje døme om.',
    },
    {
      title: 'Mykje av månaden er uplanlagt',
      message:
        '{{percent}} % av forbruket — {{unbudgetedAmount}} — ligg utanfor kvart budsjett. Gi den største delen ei grense, og planen vil sjå meir av livet ditt.',
    },
    {
      title: 'Forbruk utanfor planen',
      message:
        'Budsjetta dekkjer berre ein del av det du brukar; {{unbudgetedAmount}} ({{percent}} %) blir umålt. Utvid planen dit pengane faktisk går.',
    },
    {
      title: 'Planen ser berre ein del av biletet',
      message:
        '{{percent}} % av forbruket i månaden har ikkje budsjett. Klårt syn kjem før god dømekraft.',
    },
    {
      title: '{{unbudgetedAmount}} brukt utan grense',
      message:
        'Det er {{percent}} % av månaden. Du treng ikkje avgrense det — berre avgjere kor mykje av det du faktisk vil.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '«{{category}}» er mesteparten av fritida di',
      message:
        '{{percent}} % av fritidsforbruket gjekk til «{{category}}». Nyt det, men sjekk at du kunne gått frå det.',
    },
    {
      title: 'Éi nyting dominerer',
      message:
        '«{{category}}» tek {{percent}} % av alt du brukte på fritid. Spør om ho framleis gleder deg eller har vorte rutine.',
    },
    {
      title: 'Fritida lener seg på «{{category}}»',
      message:
        '{{percent}} % av fritida på éin stad. Det vi ikkje klarar oss utan, har tak i oss — sjekk at taket framleis er lett.',
    },
    {
      title: '«{{category}}»: {{percent}} % av fritida',
      message:
        'Éi einaste kjelde til glede tek nesten alt. Ver utan ho ei stund og sjå kva ho eigentleg gir deg.',
    },
    {
      title: 'Kvila di har éi adresse',
      message:
        'Mesteparten av fritidspengane, {{percent}} %, går til «{{category}}». Du er berre fri frå ei nyting viss du kunne klart deg utan ho.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Noko forbruk er enno ikkje vurdert',
      message:
        '{{count}} kategoriar har ingen klasse. Avgjer i Budsjett kva som er nødvende, arbeid, dygd eller fritid.',
    },
    {
      title: '{{count}} kategoriar ventar på vurderinga di',
      message:
        'Dei har forbruk men ingen klasse, så råda kan ikkje vekte dei. Eitt minutt i Budsjett avgjer det.',
    },
    {
      title: 'Gi namn til det pengane dine tener',
      message:
        '{{count}} kategoriar er framleis uklassifiserte. Dømmekraft byrjar med å kalle ting ved dei rette namna.',
    },
    {
      title: 'Uvurdert forbruk: {{count}} kategoriar',
      message:
        'Er det eit behov, arbeidet ditt, ei dygd eller ei nyting? Berre du kan seie det — og planen blir klårare når du gjer det.',
    },
    {
      title: 'Nokre kategoriar har ingen klasse',
      message:
        '{{count}} kategoriar står utanfor dei fire klassane. Klassifiser dei i Budsjett, så kvar utgift blir sett for det ho er.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: '{{count}} små kjøp hos {{merchant}}',
      message:
        'Kvart einskilt verka uvesentleg; til saman vart det {{totalAmount}} over månaden. Små, uprøvde vanar er der dei fleste pengane stilt forsvinn.',
    },
    {
      title: '{{merchant}}: {{count}} gonger på ein månad',
      message:
        '{{totalAmount}} i små beløp. Spør om kvart besøk var eit val eller ein refleks: berre det første er fridom.',
    },
    {
      title: 'Litt om litt: {{totalAmount}}',
      message:
        '{{count}} kjøp hos {{merchant}}. Ingen einskild tyder noko; vanen gjer. Bestem kor ofte du faktisk vil ha det.',
    },
    {
      title: 'Ein vane hos {{merchant}}',
      message:
        '{{count}} kjøp, {{totalAmount}} til saman. Hopp over kvart tredje og sjå om du saknar det.',
    },
    {
      title: 'Dei små tinga summerer seg',
      message:
        '{{merchant}} såg deg {{count}} gonger, for {{totalAmount}}. Herredøme over store avgjerder blir bygd på små som desse.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Helgene ber {{percent}} % av fritida',
      message:
        'Mesteparten av fritidsforbruket ditt skjer laurdag og sundag. Kvile er godt; sjekk at det er kvile og ikkje kompensasjon for veka.',
    },
    {
      title: 'Fritida lever i helga',
      message:
        '{{percent}} % av fritidsforbruket fell i helga. Planlegg helga litt, og ho vil koste mindre og gi meir.',
    },
    {
      title: 'Helga betaler for veka',
      message:
        'Helgene tek {{percent}} % av det du brukar på fritid. Om veka må reparerast kvar laurdag, sjå på veka.',
    },
    {
      title: 'Laurdag og sundag: {{percent}} % av fritida',
      message:
        'Frie dagar inviterer til fritt forbruk. Avgjer før helga kva ho er til, og lat pengane følgje.',
    },
    {
      title: 'Eit helgemønster',
      message:
        '{{percent}} % av fritidsforbruket skjer i helga. Lettare kvardagar gjer ofte helgene billegare.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} tok {{percent}} % av månaden',
      message:
        '{{totalAmount}} gjekk til éin forretning til fritid. Når éin stad har så mykje av pengane dine, spør kor mykje av merksemda di han òg har.',
    },
    {
      title: 'Éin stad, {{totalAmount}}',
      message:
        '{{merchant}} er {{percent}} % av forbruket i månaden. Er det verdt så stor del av livsarbeidet ditt?',
    },
    {
      title: '{{merchant}} leier forbruket ditt',
      message:
        '{{percent}} % av månaden — {{totalAmount}} — gjekk dit. Ingenting gale i å nyte det, så lenge du ville valt det igjen.',
    },
    {
      title: 'Ein stor del hos {{merchant}}',
      message:
        '{{totalAmount}}, eller {{percent}} % av forbruket, på éin fritidsstad. Vei nytinga mot prisen, roleg.',
    },
    {
      title: '{{percent}} % hos {{merchant}}',
      message:
        'Denne eine forretningen tok {{totalAmount}}. Fridom er å kunne gå forbi når du vel det.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Inntekta fall, forbruket ikkje',
      message:
        'Inntekta fall {{percent}} % til {{incomeAmount}}, men forbruket vart på {{expenseAmount}}. Lagnaden skifta meining; forbruket ditt har ikkje merka det enno.',
    },
    {
      title: 'Inntekta ned {{percent}} %',
      message:
        '{{incomeAmount}} kom inn mot {{expenseAmount}} ut. Det lagnaden gir, kan han ta attende — tilpass forbruket til det som er, ikkje det som var.',
    },
    {
      title: 'Ein slankare månad, dei same vanane',
      message:
        'Inntekta er {{percent}} % lågare ({{incomeAmount}}), mens forbruket heldt seg på {{expenseAmount}}. Inntekta er ikkje i di makt; responsen er.',
    },
    {
      title: 'Lagnaden flytta seg',
      message:
        'Du tente {{percent}} % mindre enn vanleg, men brukte {{expenseAmount}} som før. Kutt no, mens det er eit val og ikkje eit nødvende.',
    },
    {
      title: 'Forbruket har ikkje følgt inntekta',
      message:
        'Inntekta fall til {{incomeAmount}} ({{percent}} % ned); forbruket er {{expenseAmount}}. Set seglet etter den vinden du faktisk har.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Abonnement: {{monthlyAmount}} i månaden',
      message:
        '{{count}} abonnement tek {{percent}} % av det månadlege forbruket ditt. Kvart blir fornya utan å spørje deg — spør sjølv om kvart.',
    },
    {
      title: '{{percent}} % av forbruket fornyar seg sjølv',
      message:
        '{{count}} abonnement, {{monthlyAmount}} i månaden. Behald dei du ville meldt deg på igjen i dag.',
    },
    {
      title: 'Stilt, gjentakande, {{monthlyAmount}}',
      message:
        '{{count}} abonnement kostar {{percent}} % av månaden din. Lettvinte løysingar er gode tenarar og kostbare herrar.',
    },
    {
      title: '{{count}} abonnement å gå gjennom',
      message:
        'Til saman er dei {{monthlyAmount}} i månaden, {{percent}} % av forbruket. Sei opp eitt du nesten ikkje brukar, og merk kor lite du saknar det.',
    },
    {
      title: 'Det som fornyar seg sjølv',
      message:
        '{{monthlyAmount}} i månaden fordelt på {{count}} abonnement. Automatisk forbruk fortener ein medviten gjennomgang.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Suksessen din kunne rekke litt lenger',
      message:
        'Over {{months}} månader heldt du att {{savingsPercent}} % av inntekta, men nesten ingenting av det gjekk til andre. Rikdom sit best i opne hender — kanskje ei gåve eller donasjon denne månaden?',
    },
    {
      title: 'Tener godt, gir lite',
      message:
        '{{incomeAmount}} kom inn over {{months}} månader, og {{givenAmount}} gjekk til andre. Hjelper du på måtar denne appen ikkje ser, så sjå bort frå dette; om ikkje, har planen rom for det.',
    },
    {
      title: 'Eit godt år for å vere gåvmild',
      message:
        'Du sparte {{savingsPercent}} % av inntekta — teikn på ei stø hand. Ein liten del av det, gitt til nokon som treng det, ville gjere stødleiken meir verdt.',
    },
    {
      title: 'Ingen andre med på biletet enno',
      message:
        'Dei siste {{months}} månadene viser nøye inntening og sparing, men inga velgjerd eller gåver. Vi er laga for kvarandre; ei beskjeden gåve er nok til å byrje.',
    },
    {
      title: 'Rom for venlegheit',
      message:
        'Berre {{givenAmount}} av {{incomeAmount}} gjekk til å hjelpe andre. Vurder ein liten, fast donasjon — gåvmildheit blir lettare med vane, som kvar dygd.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '«{{goal}}» fell attende',
      message:
        'Det krev {{requiredAmount}} i månaden, og du legg inn omtrent {{paceAmount}}. Med denne takta kjem det fram {{monthsLate}} månader for seint. Takta står i di makt.',
    },
    {
      title: '«{{goal}}»: {{monthsLate}} månader seint i dette tempoet',
      message:
        'Kravd {{requiredAmount}} i månaden, faktisk om lag {{paceAmount}}. Flytt datoen ærleg eller flytt meir pengar medvite.',
    },
    {
      title: 'Målet og tempoet er usamde',
      message:
        '«{{goal}}» ber om {{requiredAmount}} i månaden; det får {{paceAmount}}. Eit mål er berre så verkeleg som det månadlege steget mot det.',
    },
    {
      title: '«{{goal}}» treng eit fastare steg',
      message:
        '{{paceAmount}} i månaden mot dei {{requiredAmount}} det treng. Betal målet først neste månad, før noko valfritt.',
    },
    {
      title: 'Attende på «{{goal}}»',
      message:
        'Dagens takt ({{paceAmount}}/månad) gjer at det kjem {{monthsLate}} månader for seint. Det som står i di makt, er neste steg, ikkje heile vegen.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '«{{goal}}» passar ikkje i planen',
      message:
        'Det treng {{requiredAmount}} i månaden, men etter budsjetta dine er berre {{freeAmount}} fritt. Endre datoen, målet eller budsjetta — å håpe er ingen plan.',
    },
    {
      title: '«{{goal}}» ber om meir enn du har fritt',
      message:
        '{{requiredAmount}} krevst kvar månad, {{freeAmount}} tilgjengeleg. Å vilje alt på éin gong er slik ingenting blir gjort; vel.',
    },
    {
      title: 'Tala seier nei — for no',
      message:
        '«{{goal}}» treng {{requiredAmount}} i månaden; dei frie midlane dine er {{freeAmount}}. Juster det som er i di makt: fristen eller dei andre grensene.',
    },
    {
      title: '«{{goal}}» krev ei avgjerd',
      message:
        'Med {{requiredAmount}} i månaden overstig det dei {{freeAmount}} som er att etter budsjetta. Eit mål valt med opne auge er betre enn eitt som blir halde av ønsketenking.',
    },
    {
      title: 'Eit umogleg tempo for «{{goal}}»',
      message:
        'Kravd {{requiredAmount}} månadleg, fritt {{freeAmount}}. Ærleg rekning no sparer skuffelse seinare.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Saldoen din går under null {{date}}',
      message:
        'Viss inntekt og forbruk held fram som no, søkk den berekna saldoen til {{lowestAmount}}. Førebu deg no, medan det berre er ein prognose.',
    },
    {
      title: 'Eit underskot kjem: {{date}}',
      message:
        'Betalingar og kvardagsforbruk overstig det som kjem inn, med eit botnpunkt på {{lowestAmount}}. Å sjå motgang i førevegen er slik han mistar makta si.',
    },
    {
      title: 'Planlegg for {{date}}',
      message:
        'Den dagen når den venta saldoen {{lowestAmount}}. Flytt ei betaling, hald att eit ønske, eller set av kontantar — kvart av desse er i di makt i dag.',
    },
    {
      title: 'Prognosen fell under null',
      message:
        'Saldoen søkk til {{lowestAmount}} omkring {{date}}. Det rolege svaret er det tidlege.',
    },
    {
      title: 'Føresjå gapet {{date}}',
      message:
        'Venta lågaste saldo: {{lowestAmount}}. Det som er føresett, kan møtast med fatning; det som overraskar oss, sjeldan.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Du heldt ord til deg sjølv',
      message:
        'I {{months}} månader på rad heldt forbruket ditt seg innanfor planen du sette. Slik ser sjølvkontroll ut.',
    },
    {
      title: '{{months}} månader innanfor plan',
      message:
        'Månad etter månad stemmer det du tenkte og det du gjorde. Jamnleik er stillare enn viljestyrke og varer lenger.',
    },
    {
      title: 'Plan og liv er samde',
      message:
        '{{months}} månader på rad innanfor grensene dine. Ein plan som blir halden så godt, er ikkje lenger ei avgrensing — det er måten du lever.',
    },
    {
      title: 'Stabil i {{months}} månader',
      message:
        'Budsjetta dine har halde {{months}} månader på rad. Behald same merksemd; det fungerer.',
    },
    {
      title: 'Disiplin, oppretthalden',
      message:
        '{{months}} månader utan å bryte planen din. Få ting er så frigjerande som å stole på sine eigne avgjerder.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Pengane dine følgjer verdiane dine',
      message:
        'Pengar i dygdas teneste utgjorde {{actual}} % av forbruket ditt, ikkje mindre enn dei {{planned}} % du planla. Godt brukt.',
    },
    {
      title: 'Dygd fekk sin fulle del',
      message:
        '{{actual}} % på helse, læring og andre, mot {{planned}} % planlagt. Det du set pris på, betalte du for.',
    },
    {
      title: 'Brukt på å bli betre',
      message:
        'Helse, læring og anna fekk {{actual}} % av forbruket i månaden (planlagt {{planned}} %). Dygd kan ikkje kjøpast, men ho kan tenast.',
    },
    {
      title: 'Hensikt gjennomført',
      message:
        'Du planla {{planned}} % til dygd og brukte {{actual}} %. Gode hensikter overlever sjeldan ein månad — dine gjorde.',
    },
    {
      title: 'Den beste bruken av pengar',
      message: '{{actual}} % gjekk til det som gjer deg og andre betre. Hald fram med å velje det.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Fritid på sin plass',
      message:
        'Fritid er {{actual}} % av forbruket, under dei {{planned}} % du tillét henne. Du nyt ting utan å bli styrt av dei.',
    },
    {
      title: 'Nyting, halden i storleik',
      message:
        'Fritid tok {{actual}} % mot {{planned}} % planlagt. Måtehald er ikkje å gå glipp av noko — det er å velje.',
    },
    {
      title: 'Kvile utan overdriving',
      message:
        '{{actual}} % på fritid, under grensa di på {{planned}} %. Glede smakar betre når ho ikkje bestemmer.',
    },
    {
      title: 'Måtehald, stilt',
      message:
        'Du gav fritida {{planned}} % og ho brukte berre {{actual}} %. Den marginen er fridom du heldt att.',
    },
    {
      title: 'Fritid under plan',
      message:
        'Med {{actual}} % av forbruket heldt fritida seg under dei {{planned}} % du sette. Godt halde.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '{{percent}} % under plan',
      message:
        'Du brukte {{savedAmount}} mindre enn du hadde tillate deg for månaden. Å ikkje trenge alt ein kunne hatt, er ei slags rikdom.',
    },
    {
      title: '{{savedAmount}} ubrukt',
      message:
        'Månaden landa {{percent}} % under plan. Det du ikkje brukte, er framleis ditt å styre.',
    },
    {
      title: 'Mindre enn du tillét',
      message:
        'Forbruket er {{percent}} % under planen — {{savedAmount}} halde att. Gi den marginen eit formål før vanen krev han.',
    },
    {
      title: 'Planen hadde rom til overs',
      message:
        '{{savedAmount}} under grensene dine for månaden. Måtehald som kjennest lett, er det som varer.',
    },
    {
      title: 'Lettare enn planlagt',
      message:
        'Du trong {{percent}} % mindre enn du budsjetterte. Vurder å sende dei {{savedAmount}} mot eit mål.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '«{{goal}}» er i rute',
      message:
        'Du er {{percent}} % av vegen, i det tempoet målet treng. Stø steg, tekne månadleg, rekk langt.',
    },
    {
      title: 'I rute mot «{{goal}}»',
      message:
        '{{percent}} % ferdig og tempoet held. Hald fram med å betale målet først; det fungerer.',
    },
    {
      title: '«{{goal}}»: {{percent}} % og stødig',
      message: 'Målet får det det treng kvar månad. Tolmodet gjer sitt arbeid.',
    },
    {
      title: 'Målet rører seg som planlagt',
      message:
        '«{{goal}}» er {{percent}} % finansiert og i tid. Det som blir gjort litt kvar månad, kan ikkje stoppast av éi dårleg veke.',
    },
    {
      title: 'Framgang du kan stole på',
      message:
        '«{{goal}}» står på {{percent}} %, i tempo. Du byggjer det på den einaste måten som verkar — gradvis.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: 'Færre impulskjøp hos {{merchant}}',
      message:
        'Frå {{before}} kjøp i månaden til omtrent {{after}}. Ein laus vane er vunnen fridom.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'Du vitjar mindre enn du gjorde. Kvar hoppa refleks er ein liten siger for val over vane.',
    },
    {
      title: 'Den vesle vanen krympar',
      message:
        'Kjøp hos {{merchant}} fall frå {{before}} til om lag {{after}}. Hald fram — det blir lettare.',
    },
    {
      title: 'Val over refleks',
      message:
        'Hos {{merchant}} gjekk du frå {{before}} kjøp til om lag {{after}}. Det er meistring bygd éi avgjerd om gongen.',
    },
    {
      title: 'Mindre av dei små tinga',
      message:
        '{{merchant}} såg deg om lag {{after}} gonger i staden for {{before}}. Små sigrar veks saman.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Du tilpassa deg ein slankare månad',
      message:
        'Inntekta fall {{incomePercent}} %, og du kutta forbruket {{expensePercent}} %. Du møtte eit skifte i lagnaden med eit skifte i kurs.',
    },
    {
      title: 'Fatning då inntekta dala',
      message:
        'Inntekta ned {{incomePercent}} %, forbruket ned {{expensePercent}} %. Du tilpassa deg det som er, ikkje det som var.',
    },
    {
      title: 'Lagnaden endra seg; det gjorde du òg',
      message:
        'Eit fall i inntekta på {{incomePercent}} % møtte eit fall i forbruket på {{expensePercent}} %. Det er sinnsro i tal.',
    },
    {
      title: 'Godt styrt',
      message:
        'Då inntekta fall {{incomePercent}} %, følgde forbruket ({{expensePercent}} % mindre). Vinden var ikkje din; seglet var.',
    },
    {
      title: 'Forbruket følgde inntekta ned',
      message:
        'Du brukte {{expensePercent}} % mindre då inntekta fall {{incomePercent}} %. Å tilpasse seg tidleg er den rolege vegen gjennom.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'Nødvende er stabile',
      message:
        'I {{months}} månader har dei nødvendige kostnadene dine nesten ikkje rørt seg. Eit stabilt golv gir deg fridom over det.',
    },
    {
      title: 'Behov haldne i sjakk',
      message:
        'Forbruket på nødvende heldt seg jamt i {{months}} månader. Behov som ikkje veks, er behov du styrer.',
    },
    {
      title: '{{months}} månader med stabile nødvende',
      message: 'Husleige, mat og rekningar vart der dei var. Stilt stabilitet er òg ei prestasjon.',
    },
    {
      title: 'Ingen kryp i nødvende',
      message:
        '{{months}} månader utan drift i det livet krev. Alt anna er lettare å planleggje på den grunnen.',
    },
    {
      title: 'Eit fast golv',
      message:
        'Dei nødvendige utgiftene har vore stabile i {{months}} månader. Du lèt ikkje komfortar gå for behov.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Gåvmild med det du tener',
      message:
        'Over {{months}} månader gjekk {{percent}} % av inntekta di — {{givenAmount}} — til å hjelpe andre. Det er pengar brukte til sitt beste føremål.',
    },
    {
      title: '{{givenAmount}} gitt til andre',
      message:
        'Du delte {{percent}} % av inntekta di på {{months}} månader. Venlegheit som viser seg i tala, er venlegheit praktisert, ikkje berre kjend.',
    },
    {
      title: 'Opne hender',
      message:
        'Velgjerd og gåver tok {{percent}} % av inntekta di den siste tida. Det du gir bort, er den delen av rikdomen din ingen ulukke kan ta.',
    },
    {
      title: 'Gåvmildheit er del av planen din',
      message:
        '{{givenAmount}} til andre over {{months}} månader. Behald det — det gode du gjer for andre, er òg gjort for deg sjølv.',
    },
    {
      title: 'Godt gitt',
      message:
        '{{percent}} % av det du tente, gjekk til å hjelpe andre. Få vanar seier meir om eit menneske.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Ingenting å rette',
      message: 'Forbruket ditt stemmer med det du tenkte. Hald fram som du er.',
    },
    {
      title: 'Hensikt og handling er samde',
      message: 'Månaden ser ut som du planla han. Det samsvaret er heile poenget.',
    },
    {
      title: 'Ein roleg månad',
      message:
        'Inga overdriving, inga forsøming verdt å nemne. Godt gjort — ta med den same merksemda vidare.',
    },
    {
      title: 'Alt i orden',
      message: 'Planen din heldt, og ingenting ber om retting. Nyt roa du har fortent.',
    },
    {
      title: 'Stø hand',
      message: 'Månaden følgde planen din. Gode vanar får gode månader til å sjå vanlege ut.',
    },
  ],
  'stoic.keep_first': [
    {
      title: 'Behald di eiga del først',
      message:
        'På {{months}} månader heldt du att {{savingsPercent}} % av inntekta. Senecas åtvaring: det er for seint å spare når ein er nede i botnfallet i fatet. Legg til side {{tenthAmount}} same dagen inntekta kjem.',
    },
    {
      title: 'Spar medan fatet er fullt',
      message:
        'Berre {{savingsPercent}} % av inntekta vart verande hos deg. Sparsemd som ventar på det som blir til overs, kjem for seint; {{tenthAmount}} i månaden, lagt til side først, byrjar no.',
    },
    {
      title: 'Det som er ditt, behald det',
      message:
        'Seneca rår oss til å behalde det som verkeleg er vårt, og til å byrje tidleg. Det siste har {{savingsPercent}} % av inntekta vorte verande hos deg; byrj med {{tenthAmount}} på lønsdagen og la forbruket rette seg etter resten.',
    },
    {
      title: 'Byrj før botnfallet',
      message:
        'Du heldt att {{savingsPercent}} % over {{months}} månader. Å spare står berre i di makt så lenge det enno er noko å spare: legg {{tenthAmount}} til side før alt anna.',
    },
    {
      title: '{{savingsPercent}} % behalde, og fatet blir tomt',
      message:
        '{{tenthAmount}} i månaden, ein tidel av inntekta, lagt til side før kvar rekning. Det du behold først, er ikkje avhengig av kva månaden let att.',
    },
  ],
  'stoic.prepare_beforehand': [
    {
      title: 'Førebu deg medan det er roleg',
      message:
        'Reserven din dekkjer omtrent {{cushionDays}} dagars forbruk. Seneca: sjela bør herde seg i tider fri for uro. Tre månaders forbruk er {{targetAmount}}.',
    },
    {
      title: 'Ein reserve på {{cushionDays}} dagar',
      message:
        'Lagnaden varslar ikkje komsten sin. Bygg opp mot {{targetAmount}}, tre månaders forbruk, medan ingenting pressar på: då er det lett.',
    },
    {
      title: '«Var det denne tilstanden eg frykta?»',
      message:
        'Seneca lét Lucilius øve seg på fattigdom slik at ho mista skrekken sin. Med {{cushionDays}} dagars reserve ville ein hard månad ikkje vore nokon øving. Sikt mot {{targetAmount}}.',
    },
    {
      title: 'Sjå den harde månaden i førevegen',
      message:
        'Sparepengane dine ville rukke i omtrent {{cushionDays}} dagar. Det ein har sett komme, råkar mildare; {{targetAmount}} ville bore deg i tre månader.',
    },
    {
      title: 'Bygg muren før stormen',
      message:
        'Omtrent {{cushionDays}} dagar er dekte. At inntekta fell bort, står ikkje i di makt; reserven gjer det. Tre månaders forbruk blir {{targetAmount}}.',
    },
  ],
  'stoic.wants_outrun_income': [
    {
      title: 'Begjæret spring frå inntekta',
      message:
        'Forbruket steig med {{expenseGrowth}} % det siste kvartalet medan inntekta endra seg med {{incomeGrowth}} %. Det er ikkje den som har for lite, skriv Seneca, men den som begjærer meir, som er fattig.',
    },
    {
      title: 'Å leve høgare, ikkje betre',
      message:
        'Forbruket auka med {{expenseGrowth}} %, inntekta med {{incomeGrowth}} %. Naturens behov er små; innbilinga sine krav er uendelege. Spør kven av dei auken tener.',
    },
    {
      title: 'Behova har vakse: +{{expenseGrowth}} %',
      message:
        'Utgiftene steig raskare enn inntekta ({{incomeGrowth}} %). Ein ny bekvemmelegheit kjennest snart som eit behov: legg merke til han medan du enno kan seie nei.',
    },
    {
      title: 'Målstreken flyttar seg',
      message:
        'Forbruket er opp {{expenseGrowth}} % frå førre kvartal, inntekta {{incomeGrowth}} %. Nok blir berre nok viss du sjølv avgjer kva det er.',
    },
    {
      title: 'Meir er ikkje kuren',
      message:
        'Det siste kvartalet auka forbruket med {{expenseGrowth}} % og inntekta med {{incomeGrowth}} %. Rikdom som veks med begjæret, kjem aldri fram; set grensa før dette blir det nye normale.',
    },
  ],
  'stoic.price_in_life': [
    {
      title: '{{merchant}} kosta {{hours}} timar av livet ditt',
      message:
        'Seneca minner oss om at berre tida verkeleg er vår. {{totalAmount}} hos {{merchant}} er omtrent {{hours}} timars arbeid. Var det verdt det?',
    },
    {
      title: '{{hours}} timar hos {{merchant}}',
      message:
        'Vi vaktar pengane våre og gir tida vår bort. Med den gjennomsnittlege timeinntekta di er {{totalAmount}} der omtrent {{hours}} arbeidstimar.',
    },
    {
      title: 'Rekn om til timar',
      message:
        '{{totalAmount}} hos {{merchant}} er omtrent {{hours}} timars arbeid. Timar er det einaste du ikkje kan tene inn att.',
    },
    {
      title: 'Kva {{merchant}} verkeleg kosta',
      message:
        'Du byter dagane dine mot pengar, og pengane mot ting. {{merchant}} tok omtrent {{hours}} timar av dine ({{totalAmount}}). Svarer gleda til timane?',
    },
    {
      title: 'Vei timane',
      message:
        'Rekna om til den gjennomsnittlege timeinntekta di er {{totalAmount}} hos {{merchant}} omtrent {{hours}} timar. Vi mistar mykje av tida vår, skriv Seneca. Valde du dette?',
    },
  ],
  'stoic.rule_broken': [
    {
      title: 'Regelen «{{rule}}» har mista vegen',
      message:
        'Han peikar på noko som ikkje finst lenger, og har difor stilt slutta å verke. Reparer han eller fjern han: ei orden som ikkje gjer noko, liknar berre på orden.',
    },
    {
      title: '«{{rule}}» verkar ikkje lenger',
      message:
        'Kategorien, kontoen eller mottakaren er borte, og regelen blir no hoppa over ved kvar transaksjon. Sjå tinga som dei er, og rett dei så.',
    },
    {
      title: 'Ein regel som sikter mot ingenting',
      message:
        '«{{rule}}» sender transaksjonar til ein stad som er fjerna. Du bestemte noko ein gong; bestem på nytt no som tinga har endra seg.',
    },
    {
      title: '«{{rule}}» treng dømekrafta di',
      message:
        'Det han viser til, er sletta, og transaksjonane han plar sortere, ventar no på deg. Gi han eit nytt mål eller la han gå.',
    },
    {
      title: 'Ein øydelagd regel, i stilla',
      message:
        '«{{rule}}» gjer ingenting og seier ikkje noko om det. Rett det som står i di makt: det tek eitt minutt.',
    },
  ],
  'stoic.rule_contradicted': [
    {
      title: 'Handa di er usamd med «{{rule}}»',
      message:
        '{{count}} gonger sorterte du for hand annleis enn denne regelen gjer. Anten tek regelen feil, eller handa gjer det: avgjer kven.',
    },
    {
      title: '«{{rule}}» vart overstyrd {{count}} gonger',
      message:
        'Ein regel du stadig rettar, er ikkje lenger ei avgjerd, berre ein vane med å krangle med seg sjølv. Endre han, eller stol på han.',
    },
    {
      title: 'Sei kva du gjer, gjer kva du sa',
      message:
        'Regelen «{{rule}}» seier eitt; dei siste {{count}} rettingane dine seier noko anna. Få dei to til å stemme overeins.',
    },
    {
      title: 'Ei avgjerd i strid',
      message:
        'Du sette «{{rule}}» med klart hovud, og sidan har {{count}} transaksjonar gått ei anna vei. Sjå roleg etter att kven av dykk som hadde rett.',
    },
    {
      title: '{{count}} rettingar mot «{{rule}}»',
      message: 'Gjentaking er informasjon. La henne endre regelen, eller la regelen endre vana.',
    },
  ],
  'stoic.rule_worth_writing': [
    {
      title: 'Bestem éin gong om {{payee}}',
      message:
        'Du har sortert {{payee}} for hand {{decided}} gonger, alltid på same måte. Det du bestemmer att og att, bestem det éin gong, med klart hovud.',
    },
    {
      title: 'Ei avgjerd teken {{decided}} gonger',
      message:
        '{{payee}} stiller det same spørsmålet, og du gir det same svaret. Ein regel sparer merksemda di til det som verkeleg treng ho.',
    },
    {
      title: 'Mottakarar som er klare for ein regel: {{count}}',
      message:
        'Dei same mottakarane får den same kategorien av deg, {{payee}} mest av alle. Spar dømekrafta di til det som er nytt.',
    },
    {
      title: 'Vana di er klar til å bli eit prinsipp',
      message:
        'Du sorterer {{payee}} likt kvar gong (til no {{decided}} gonger). Skriv det ned som ein regel, så held det utan strev.',
    },
    {
      title: 'La ein regel bere dette',
      message:
        'Mottakarar du sorterer likt kvar gong: {{count}}, mellom dei {{payee}} med {{decided}} transaksjonar. Eit prinsipp som er avgjort éin gong, treng ikkje drøftast på nytt.',
    },
  ],
  'stoic.rule_idle': [
    {
      title: '«{{rule}}» har ikkje treft noko på {{months}} månader',
      message:
        'Anten er verda han vart laga for, borte, eller så bommar vilkåra på målet. Hald reglane dine sanne: reparer han eller fjern han.',
    },
    {
      title: 'Ein regel i kvile: «{{rule}}»',
      message:
        'Han har ikkje rørt ein einaste transaksjon på {{months}} månader. Kast bort det overflødige; det som blir att, er lettare å stole på.',
    },
    {
      title: '«{{rule}}» står stille',
      message:
        '{{months}} månader utan treff medan nye transaksjonar stadig kjem. Prøv han på dei siste transaksjonane dine, og bestem så.',
    },
    {
      title: 'Trengst «{{rule}}» framleis?',
      message:
        'Ingenting har passa til han på {{months}} månader. Ein regel ein held på av vane, er enda ein ting å passe på.',
    },
    {
      title: 'Ei avgjerd utan noko å avgjere',
      message:
        '«{{rule}}» har vore taus i {{months}} månader. Orden vil seie å ha det ein treng, og berre det.',
    },
  ],
  'stoic.praise_rules_hold': [
    {
      title: 'Avgjerdene dine held',
      message:
        'Reglar sorterte {{percent}} % av transaksjonane i månaden, og du trong ikkje overstyre nokon. Ei avgjerd som blir teken éin gong og halden, frigjer sinnet.',
    },
    {
      title: '{{percent}} % avgjort på førehand',
      message:
        'Dei fleste transaksjonane i månaden vart sorterte etter det du hadde bestemt tidlegare. Det er merksemd spart til det som tyder noko.',
    },
    {
      title: 'Prinsipp i arbeid',
      message:
        'Reglane dine handterte {{percent}} % av transaksjonane utan strid. Avgjorde prinsipp gir rolege dagar.',
    },
    {
      title: 'Mindre å avgjere',
      message:
        '{{percent}} % av transaksjonane kravde inga ny avgjerd. Du dømde éin gong, godt, og dommen står enno.',
    },
    {
      title: 'Orden halden',
      message:
        'Reglar sorterte {{percent}} % av månaden, og ingen vart motsagd. God orden ser ut som om ingenting skjer.',
    },
  ],
  'stoic.goal_no_date': [
    {
      title: '«{{goal}}» har inga dato',
      message:
        'Det står på {{percent}} %, og ingenting går inn. Når ein ikkje veit kva hamn ein styrer mot, er ingen vind den rette: nemn dagen du vil nå fram.',
    },
    {
      title: 'Eit ønske eller eit mål?',
      message:
        '«{{goal}}» har inga frist og ingen takt. Eit mål er ei avgjerd med ei dato; gi det ei, eller la det gå.',
    },
    {
      title: 'Nemn dagen for «{{goal}}»',
      message:
        'Det er {{percent}} % av vegen og rører seg ikkje. Det som kan gjerast når som helst, blir sjeldan gjort.',
    },
    {
      title: '«{{goal}}» ventar på «ein dag»',
      message:
        'Ingenting har gått inn den siste tida, og inga dato krev noko. «Ein dag» står ikkje i kalenderen din; vel ein dag som gjer det.',
    },
    {
      title: '«{{goal}}» har inga hamn',
      message:
        'På {{percent}} %, utan frist. Veit du kvar du seglar, følgjer det månadlege steget av seg sjølv.',
    },
  ],
};
