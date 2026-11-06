import type { StoicTextMap } from './types';

export const nb: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'Måneden vokste ut over planen sin',
      message:
        'Du planla {{plannedAmount}} og har brukt {{spentAmount}} — {{percent}} % mer. Planen ble lagt med klart hode; la den tale høyere enn øyeblikket.',
    },
    {
      title: '{{percent}} % over det du ville bruke',
      message:
        'Forbruket står på {{spentAmount}} mot en plan på {{plannedAmount}}. Se på hvilken grense som ga etter først — der ligger lærdommen.',
    },
    {
      title: 'Planen din og måneden din er uenige',
      message:
        '{{spentAmount}} brukt, {{plannedAmount}} tiltenkt. Enten krevde planen for lite av virkeligheten, eller virkeligheten krevde for mye av deg — avgjør rolig hvilket.',
    },
    {
      title: 'Mer gikk ut enn du tillot',
      message:
        'Måneden er {{percent}} % over de {{plannedAmount}} du satte. Ingenting er tapt ved å stoppe nå; mye er tapt ved å late som det ikke skjedde.',
    },
    {
      title: 'En grense du satte, en grense du krysset',
      message:
        'Du ville bruke {{plannedAmount}}; det er {{spentAmount}}. Selvkontroll er ikke å aldri skli — det er å merke det tidlig og vende tilbake til stien.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Fritid tar mer enn du planla',
      message:
        'Du ville at fritiden skulle være {{planned}} % av forbruket; den ble {{actual}} %. Nytelse er velkommen som gjest, ikke som husets herre.',
    },
    {
      title: 'Fritid på {{actual}} %, planlagt {{planned}} %',
      message:
        'Hvile fortjener sin plass når den gir deg krefter igjen. Spør hvilke av månedens gleder som gjorde det, og la resten gå uten anger.',
    },
    {
      title: 'Komfort bruker mer enn hensikten',
      message:
        'Fritiden holder {{actual}} % av forbruket mot de {{planned}} % du valgte. Måtehold er ikke å avvise nytelse — det er å holde den i den størrelsen du bestemte.',
    },
    {
      title: 'Det behagelige fortrenger det planlagte',
      message:
        'Du ga fritiden {{planned}} % av planen, og den tok {{actual}} %. Det du nyter uten anstrengelse, er verdt et nytt blikk før det blir det du trenger.',
    },
    {
      title: 'Fritiden har gått over streken',
      message:
        '{{actual}} % av måneden gikk til fritid, {{planned}} % var hensikten. Streken var din å tegne, og den er din å holde.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Fritid over plan igjen',
      message:
        'Fritiden gikk ut over planen din i {{months}} av de siste {{window}} månedene. En gjentakelse er ikke lenger et uhell — det er en vane verdt å undersøke.',
    },
    {
      title: '{{months}} av {{window}} måneder over fritidsplanen',
      message:
        'Det som skjer én gang, er omstendigheter; det som skjer {{months}} ganger, er karakter i støpeskjeen. Velg karakteren med vilje.',
    },
    {
      title: 'Samme feiltrinn, måned etter måned',
      message:
        'Fritiden løp fra planen i {{months}} av {{window}} måneder. Hev planen ærlig eller endre vanen — å leve mellom de to koster mest.',
    },
    {
      title: 'Et mønster, ikke et unntak',
      message:
        'I {{months}} av de siste {{window}} månedene tok fritiden mer enn du ga den. Legg merke til øyeblikket avgjørelsen tas, ikke bare regningen etterpå.',
    },
    {
      title: 'Vanen stemmer mot planen din',
      message:
        'Fritiden slo planen {{months}} ganger på {{window}} måneder. Vaner bygges ett valg om gangen; slik avvikles de også.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'Dyd får mindre enn du tiltenkte',
      message:
        'Du satte av {{planned}} % av budsjettet til helse, læring og annet; det ble {{actual}} %. En hensikt teller først når den er gjennomført.',
    },
    {
      title: 'Dyd på {{actual}} % av planlagte {{planned}} %',
      message:
        'Pengene du hadde tenkt til det som gjør deg bedre, venter fortsatt. Det finnes ikke noe bedre tidspunkt å bruke dem godt på enn nå.',
    },
    {
      title: 'Det gode du planla, er ubrukt',
      message:
        'Helse, læring og gavmildhet skulle få {{planned}} % av forbruket; de fikk {{actual}} %. Gjør én av dem denne uken, bevisst.',
    },
    {
      title: 'Hensikt uten handling',
      message:
        'Dyd holder {{actual}} % av forbruket mot de {{planned}} % du valgte. Det vi verdsetter, viser seg i det vi faktisk betaler for.',
    },
    {
      title: 'Det er rom igjen til det som betyr noe',
      message:
        'Bare {{actual}} % gikk til dyd, selv om du planla {{planned}} %. En bok, en helsesjekk, en gave til noen som trenger det — planen har alt sagt ja.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'Dyd blir stadig utsatt',
      message:
        'Forbruket på helse, læring og andre har ligget under planen din {{months}} måneder på rad. Det du stadig utsetter, har du i realiteten bestemt deg mot.',
    },
    {
      title: '{{months}} måneder med utsatt dyd',
      message:
        'Hver måned ga planen rom til det som gjør deg bedre, og hver måned ble det ubrukt. Tid er det ene du ikke kan budsjettere to ganger.',
    },
    {
      title: 'Det bedre selvet venter fortsatt',
      message:
        'Dyd har ligget under plan {{months}} måneder på rad. Begynn lite og sikkert framfor stort og senere.',
    },
    {
      title: 'Gode hensikter eldes',
      message:
        'I {{months}} måneder fikk helse, læring og gavmildhet mindre enn du planla. Velg én og finansier den først neste måned, før noe annet.',
    },
    {
      title: 'Dyd taper stadig for «senere»',
      message:
        '{{months}} måneder på rad under plan. Senere er der gode hensikter går for å bli glemt — gi denne en dato.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'Planen din har ikke rom for dyd',
      message:
        'Ingen av budsjettene dine tjener helse, læring eller andre. En plan viser hva vi verdsetter — vurder å gi dyd sin egen linje.',
    },
    {
      title: 'Alle budsjetter, men ingen til det gode',
      message:
        'Nødvendighet, arbeid og fritid har alle grenser; dyd har ingen. Det som aldri planlegges, har en tendens til aldri å skje.',
    },
    {
      title: 'Planlegg det som gjør deg bedre',
      message:
        'Det finnes ennå ikke noe budsjett i dydsklassen. Selv et lite — bøker, sport, en donasjon — gjør et ønske til en forpliktelse.',
    },
    {
      title: 'Planen er taus om dyd',
      message:
        'Du budsjetterer for det du må og det du nyter, ennå ikke for den du vil bli. Ett beskjedent dydsbudsjett ville endre det.',
    },
    {
      title: 'Dyd har ingen budsjett',
      message:
        'Forbruk på helse, læring eller andre er ikke planlagt noe sted. Velg én og gi den en grense du ville være glad for å nå.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'Nødvendigheter koster mer enn planlagt',
      message:
        'Du planla {{planned}} % av forbruket til nødvendigheter; de tar {{actual}} %. Sjekk om hver av dem fortsatt er et behov eller stille har blitt en komfort.',
    },
    {
      title: 'Nødvendighet på {{actual}} %, planlagt {{planned}} %',
      message:
        'Det livet krever, er vanligvis mindre enn det vi venner oss til. Gå gjennom den største nødvendigheten med friske øyne.',
    },
    {
      title: 'Det nødvendige svulmer',
      message:
        'Nødvendigheter holder {{actual}} % av måneden mot de {{planned}} % du ventet. Et behov som fortsetter å vokse, fortjener et spørsmål.',
    },
    {
      title: 'Behovene vokser ut over planen',
      message:
        'Planlagt {{planned}} %, faktisk {{actual}} %. Enten undervurderte planen de reelle kostnadene, eller noen ønsker reiser under navnet behov.',
    },
    {
      title: 'Mer brukt på «må» enn ment',
      message:
        'Nødvendigheter tok {{actual}} % av forbruket i stedet for {{planned}} %. Skill det som virkelig må være, fra det som bare alltid har vært.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'Nødvendigheter kryper oppover',
      message:
        'Forbruket på nødvendigheter har steget {{months}} måneder på rad, {{percent}} % totalt. Behov vokser stille når ingen ber dem rettferdiggjøre seg.',
    },
    {
      title: '+{{percent}} % på nødvendigheter i {{months}} måneder',
      message:
        'Hvert steg virket lite; til sammen er de ikke det. Ta den største gjentakende nødvendigheten og spør om den fortsatt må koste så mye.',
    },
    {
      title: 'Gulvet i forbruket ditt stiger',
      message:
        'Nødvendigheter vokste {{months}} måneder på rad (+{{percent}} %). Et stigende gulv gir mindre rom for alt du velger fritt.',
    },
    {
      title: 'Behovene utvider seg',
      message:
        '{{months}} måneder med vekst, {{percent}} % totalt. Den stoiske prøven er enkel: ville du valgt dette igjen i dag, med prisen kjent?',
    },
    {
      title: 'Små økninger, stabil retning',
      message:
        'Nødvendigheter er opp {{percent}} % over {{months}} måneder. Retningen betyr mer enn noen enkelt måned — denne er verdt å rette tidlig.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'Arbeid koster mer enn planlagt',
      message:
        'Du planla {{planned}} % av forbruket til arbeid; det tar {{actual}} %. Verktøy og tjenester må gjøre seg fortjent — sjekk hvilke som gjør det.',
    },
    {
      title: 'Arbeidsforbruk på {{actual}} %, planlagt {{planned}} %',
      message:
        'Investering i arbeidet ditt er god når den gir noe tilbake. Gå gjennom hva du betaler for men ikke lenger bruker.',
    },
    {
      title: 'Arbeidsbudsjettet er strukket',
      message:
        'Arbeid tok {{actual}} % i stedet for {{planned}} %. Flid er å gjøre arbeidet godt, ikke å kjøpe hvert verktøy til det.',
    },
    {
      title: 'Verktøy bruker mer enn planen',
      message:
        'Planlagt {{planned}} %, brukt {{actual}} % på arbeid. Spør om hver utgift: hjelper den meg å gjøre arbeidet, eller føles den bare som framgang?',
    },
    {
      title: 'Arbeidskostnadene har glidd',
      message:
        'Arbeid holder {{actual}} % av forbruket mot {{planned}} % tiltenkt. En rask gjennomgang nå sparer en større senere.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '«{{category}}» bryter grensen sin stadig',
      message:
        '«{{category}}» gikk over budsjett i {{months}} av de siste {{window}} månedene. Enten er grensen feil, eller lysten er — avgjør hvilket.',
    },
    {
      title: '«{{category}}»: over budsjett {{months}} av {{window}} måneder',
      message:
        'En grense som alltid krysses, er ingen grense, bare et ønske. Gjør den ærlig — hev den med vilje eller hold den med vilje.',
    },
    {
      title: 'Samme budsjett gir etter igjen',
      message:
        '«{{category}}» har overskredet grensen sin {{months}} ganger på {{window}} måneder. Gjentakelsen er informasjon; bruk den.',
    },
    {
      title: '«{{category}}» ber om oppmerksomheten din',
      message:
        'Over budsjett i {{months}} av {{window}} måneder. Følg med på øyeblikket før kjøpet — det er det eneste stedet vanen kan endres.',
    },
    {
      title: 'Et mønster i «{{category}}»',
      message:
        '{{months}} overskridelser på {{window}} måneder. Det vi gjentar, blir vi; bestem hva du vil at denne kategorien skal si om deg.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '«{{category}}» går tom rundt dag {{day}}',
      message:
        'Du har brukt {{spentAmount}} av {{limitAmount}}, og i dette tempoet tar grensen slutt rundt dag {{day}}. Å senke farten nå er lettere enn å stoppe senere.',
    },
    {
      title: '«{{category}}» er foran måneden',
      message:
        '{{spentAmount}} er alt borte av en grense på {{limitAmount}}. I dette tempoet er den oppbrukt rundt dag {{day}} — resten av måneden er fortsatt din å forme.',
    },
    {
      title: 'Tempokontroll: «{{category}}»',
      message:
        'Budsjettet på {{limitAmount}} holder til rundt dag {{day}} i dagens tempo. Forutseenhet er den billigste formen for disiplin.',
    },
    {
      title: '«{{category}}» bruker framtiden',
      message:
        '{{spentAmount}} av {{limitAmount}} brukt; grensen tar slutt nær dag {{day}}. Det du gjør denne uken, avgjør om det skjer.',
    },
    {
      title: 'Tidlig varsel for «{{category}}»',
      message:
        'I dagens tempo rekker ikke grensen på {{limitAmount}} til månedsslutt — den går tom rundt dag {{day}}. Juster mens det koster lite.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '«{{category}}» har stått ubrukt',
      message:
        'Budsjettet for «{{category}}» har ikke hatt forbruk på {{months}} måneder. Enten har du vokst ut av det, eller det er en hensikt som fortsatt venter — avgjør hvilket.',
    },
    {
      title: 'Et tomt budsjett: «{{category}}»',
      message:
        '{{months}} måneder uten en eneste utgift. En plan bør beskrive livet du lever eller det du bygger — hvilket er dette?',
    },
    {
      title: '«{{category}}» står stille',
      message:
        'Ingenting brukt her på {{months}} måneder. Var det tilbakeholdenhet, godt gjort; var det forsømmelse, gjør noe med det.',
    },
    {
      title: 'Planlagt, men ikke levd',
      message:
        '«{{category}}» har hatt en grense og ingen forbruk i {{months}} måneder. Hold planen sannferdig: fjern den eller bruk den.',
    },
    {
      title: '«{{category}}»: {{months}} stille måneder',
      message:
        'Et budsjett som aldri røres, tar fortsatt plass i planen din. Frigjør plassen eller ær hensikten.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}} % av forbruket har ingen grense',
      message:
        '{{unbudgetedAmount}} av måneden gikk til kategorier som ingen budsjett våker over. Det du ikke har sett på, kan du ikke dømme om.',
    },
    {
      title: 'Mye av måneden er uplanlagt',
      message:
        '{{percent}} % av forbruket — {{unbudgetedAmount}} — ligger utenfor hvert budsjett. Gi den største delen en grense, og planen vil se mer av livet ditt.',
    },
    {
      title: 'Forbruk utenfor planen',
      message:
        'Budsjettene dekker bare en del av det du bruker; {{unbudgetedAmount}} ({{percent}} %) blir umålt. Utvid planen dit pengene faktisk går.',
    },
    {
      title: 'Planen ser bare en del av bildet',
      message:
        '{{percent}} % av månedens forbruk har ikke budsjett. Klart syn kommer før god dømmekraft.',
    },
    {
      title: '{{unbudgetedAmount}} brukt uten grense',
      message:
        'Det er {{percent}} % av måneden. Du trenger ikke begrense det — bare avgjøre hvor mye av det du faktisk vil.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '«{{category}}» er mesteparten av fritiden din',
      message:
        '{{percent}} % av fritidsforbruket gikk til «{{category}}». Nyt det, men sjekk at du kunne gått fra det.',
    },
    {
      title: 'Én nytelse dominerer',
      message:
        '«{{category}}» tar {{percent}} % av alt du brukte på fritid. Spør om den fortsatt gleder deg eller har blitt rutine.',
    },
    {
      title: 'Fritiden lener seg på «{{category}}»',
      message:
        '{{percent}} % av fritiden på ett sted. Det vi ikke klarer oss uten, har tak i oss — sjekk at taket fortsatt er lett.',
    },
    {
      title: '«{{category}}»: {{percent}} % av fritiden',
      message:
        'Én enkelt kilde til glede tar nesten alt. Vær uten den en stund og se hva den egentlig gir deg.',
    },
    {
      title: 'Hvilen din har én adresse',
      message:
        'Mesteparten av fritidspengene, {{percent}} %, går til «{{category}}». Du er bare fri fra en nytelse hvis du kunne klart deg uten den.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Noe forbruk er ennå ikke vurdert',
      message:
        '{{count}} kategorier har ingen klasse. Avgjør i Budsjetter hva som er nødvendighet, arbeid, dyd eller fritid.',
    },
    {
      title: '{{count}} kategorier venter på vurderingen din',
      message:
        'De har forbruk men ingen klasse, så rådene kan ikke vekte dem. Et minutt i Budsjetter avgjør det.',
    },
    {
      title: 'Gi navn til det pengene dine tjener',
      message:
        '{{count}} kategorier er fortsatt uklassifiserte. Dømmekraft begynner med å kalle ting ved sine rette navn.',
    },
    {
      title: 'Uvurdert forbruk: {{count}} kategorier',
      message:
        'Er det et behov, arbeidet ditt, en dyd eller en nytelse? Bare du kan si det — og planen blir klarere når du gjør det.',
    },
    {
      title: 'Noen kategorier har ingen klasse',
      message:
        '{{count}} kategorier står utenfor de fire klassene. Klassifiser dem i Budsjetter, så hver utgift blir sett for det den er.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: '{{count}} små kjøp hos {{merchant}}',
      message:
        'Hvert enkelt virket uvesentlig; til sammen ble det {{totalAmount}} over måneden. Små, uprøvde vaner er der de fleste pengene stille forsvinner.',
    },
    {
      title: '{{merchant}}: {{count}} ganger på en måned',
      message:
        '{{totalAmount}} i små beløp. Spør om hvert besøk var et valg eller en refleks: bare det første er frihet.',
    },
    {
      title: 'Litt om litt: {{totalAmount}}',
      message:
        '{{count}} kjøp hos {{merchant}}. Ingen enkelt betyr noe; vanen gjør. Bestem hvor ofte du faktisk vil ha det.',
    },
    {
      title: 'En vane hos {{merchant}}',
      message:
        '{{count}} kjøp, {{totalAmount}} til sammen. Hopp over hvert tredje og se om du savner det.',
    },
    {
      title: 'De små tingene summerer seg',
      message:
        '{{merchant}} så deg {{count}} ganger, for {{totalAmount}}. Herredømme over store avgjørelser bygges på små som disse.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Helgene bærer {{percent}} % av fritiden',
      message:
        'Mesteparten av fritidsforbruket ditt skjer lørdag og søndag. Hvile er godt; sjekk at det er hvile og ikke kompensasjon for uken.',
    },
    {
      title: 'Fritiden lever i helgen',
      message:
        '{{percent}} % av fritidsforbruket faller i helgen. Planlegg helgen litt, og den vil koste mindre og gi mer.',
    },
    {
      title: 'Helgen betaler for uken',
      message:
        'Helgene tar {{percent}} % av det du bruker på fritid. Hvis uken må repareres hver lørdag, se på uken.',
    },
    {
      title: 'Lørdag og søndag: {{percent}} % av fritiden',
      message:
        'Frie dager inviterer til fritt forbruk. Avgjør før helgen hva den er til, og la pengene følge.',
    },
    {
      title: 'Et helgemønster',
      message:
        '{{percent}} % av fritidsforbruket skjer i helgen. Lettere hverdager gjør ofte helger billigere.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} tok {{percent}} % av måneden',
      message:
        '{{totalAmount}} gikk til én forretning til fritid. Når ett sted har så mye av pengene dine, spør hvor mye av oppmerksomheten din det også har.',
    },
    {
      title: 'Ett sted, {{totalAmount}}',
      message:
        '{{merchant}} er {{percent}} % av månedens forbruk. Er det verdt så stor del av livets arbeid ditt?',
    },
    {
      title: '{{merchant}} leder forbruket ditt',
      message:
        '{{percent}} % av måneden — {{totalAmount}} — gikk dit. Ingenting galt i å nyte det, så lenge du ville valgt det igjen.',
    },
    {
      title: 'En stor andel hos {{merchant}}',
      message:
        '{{totalAmount}}, eller {{percent}} % av forbruket, på ett fritidssted. Vei nytelsen mot prisen, rolig.',
    },
    {
      title: '{{percent}} % hos {{merchant}}',
      message:
        'Denne ene forretningen tok {{totalAmount}}. Frihet er å kunne gå forbi når du velger det.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Inntekten falt, forbruket ikke',
      message:
        'Inntekten falt {{percent}} % til {{incomeAmount}}, men forbruket ble på {{expenseAmount}}. Skjebnen skiftet mening; forbruket ditt har ikke merket det ennå.',
    },
    {
      title: 'Inntekten ned {{percent}} %',
      message:
        '{{incomeAmount}} kom inn mot {{expenseAmount}} ut. Det skjebnen gir, kan den ta tilbake — tilpass forbruket til det som er, ikke det som var.',
    },
    {
      title: 'En slankere måned, de samme vanene',
      message:
        'Inntekten er {{percent}} % lavere ({{incomeAmount}}), mens forbruket holdt seg på {{expenseAmount}}. Inntekten er ikke i din makt; responsen er.',
    },
    {
      title: 'Skjebnen flyttet seg',
      message:
        'Du tjente {{percent}} % mindre enn vanlig, men brukte {{expenseAmount}} som før. Kutt nå, mens det er et valg og ikke en nødvendighet.',
    },
    {
      title: 'Forbruket har ikke fulgt inntekten',
      message:
        'Inntekten falt til {{incomeAmount}} ({{percent}} % ned); forbruket er {{expenseAmount}}. Sett seilet etter den vinden du faktisk har.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Abonnementer: {{monthlyAmount}} i måneden',
      message:
        '{{count}} abonnementer tar {{percent}} % av det månedlige forbruket ditt. Hvert fornyes uten å spørre deg — spør selv om hvert.',
    },
    {
      title: '{{percent}} % av forbruket fornyer seg selv',
      message:
        '{{count}} abonnementer, {{monthlyAmount}} i måneden. Behold dem du ville meldt deg på igjen i dag.',
    },
    {
      title: 'Stille, gjentakende, {{monthlyAmount}}',
      message:
        '{{count}} abonnementer koster {{percent}} % av måneden din. Bekvemmelighet er en god tjener og en kostbar herre.',
    },
    {
      title: '{{count}} abonnementer å gå gjennom',
      message:
        'Til sammen er de {{monthlyAmount}} i måneden, {{percent}} % av forbruket. Si opp ett du nesten ikke bruker, og merk hvor lite du savner det.',
    },
    {
      title: 'Det som fornyer seg selv',
      message:
        '{{monthlyAmount}} i måneden fordelt på {{count}} abonnementer. Automatisk forbruk fortjener en bevisst gjennomgang.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Suksessen din kunne rekke litt lenger',
      message:
        'Over {{months}} måneder beholdt du {{savingsPercent}} % av inntekten, men nesten ingenting av det gikk til andre. Rikdom sitter best i åpne hender — kanskje en gave eller donasjon denne måneden?',
    },
    {
      title: 'Tjener godt, gir lite',
      message:
        '{{incomeAmount}} kom inn over {{months}} måneder, og {{givenAmount}} gikk til andre. Hjelper du på måter denne appen ikke ser, så se bort fra dette; hvis ikke, har planen rom for det.',
    },
    {
      title: 'Et godt år for å være gavmild',
      message:
        'Du sparte {{savingsPercent}} % av inntekten — tegn på en stø hånd. En liten del av det, gitt til noen som trenger det, ville gjøre støheten mer verdt.',
    },
    {
      title: 'Ingen andre med på bildet ennå',
      message:
        'De siste {{months}} månedene viser nøye inntjening og sparing, men ingen veldedighet eller gaver. Vi er laget for hverandre; en beskjeden gave er nok til å begynne.',
    },
    {
      title: 'Rom for vennlighet',
      message:
        'Bare {{givenAmount}} av {{incomeAmount}} gikk til å hjelpe andre. Vurder en liten, fast donasjon — gavmildhet blir lettere med vane, som enhver dyd.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '«{{goal}}» faller bak',
      message:
        'Det krever {{requiredAmount}} i måneden, og du legger inn omtrent {{paceAmount}}. Med denne takten kommer det fram {{monthsLate}} måneder for sent. Takten står i din makt.',
    },
    {
      title: '«{{goal}}»: {{monthsLate}} måneder sent i dette tempoet',
      message:
        'Krevd {{requiredAmount}} i måneden, faktisk omtrent {{paceAmount}}. Flytt datoen ærlig eller flytt mer penger bevisst.',
    },
    {
      title: 'Målet og tempoet er uenige',
      message:
        '«{{goal}}» ber om {{requiredAmount}} i måneden; det får {{paceAmount}}. Et mål er bare så virkelig som det månedlige steget mot det.',
    },
    {
      title: '«{{goal}}» trenger et fastere steg',
      message:
        '{{paceAmount}} i måneden mot de {{requiredAmount}} det trenger. Betal målet først neste måned, før noe valgfritt.',
    },
    {
      title: 'Bak på «{{goal}}»',
      message:
        'Dagens takt ({{paceAmount}}/måned) gjør at det kommer {{monthsLate}} måneder for sent. Det som står i din makt, er neste steg, ikke hele veien.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '«{{goal}}» passer ikke i planen',
      message:
        'Det trenger {{requiredAmount}} i måneden, men etter budsjettene dine er bare {{freeAmount}} fritt. Endre datoen, målet eller budsjettene — å håpe er ingen plan.',
    },
    {
      title: '«{{goal}}» ber om mer enn du har fritt',
      message:
        '{{requiredAmount}} kreves hver måned, {{freeAmount}} tilgjengelig. Å ville alt på en gang er slik ingenting blir gjort; velg.',
    },
    {
      title: 'Tallene sier nei — for nå',
      message:
        '«{{goal}}» trenger {{requiredAmount}} i måneden; de frie midlene dine er {{freeAmount}}. Juster det som er i din makt: frist eller de andre grensene.',
    },
    {
      title: '«{{goal}}» krever en avgjørelse',
      message:
        'Med {{requiredAmount}} i måneden overstiger det de {{freeAmount}} som er igjen etter budsjettene. Et mål valgt med åpne øyne er bedre enn et som holdes av ønsketenkning.',
    },
    {
      title: 'Et umulig tempo for «{{goal}}»',
      message:
        'Krevd {{requiredAmount}} månedlig, fritt {{freeAmount}}. Ærlig regning nå sparer skuffelse senere.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Saldoen din går under null {{date}}',
      message:
        'Hvis inntekt og forbruk fortsetter som nå, synker den beregnede saldoen til {{lowestAmount}}. Forbered deg nå, mens det bare er en prognose.',
    },
    {
      title: 'Et underskudd kommer: {{date}}',
      message:
        'Betalinger og hverdagsforbruk overstiger det som kommer inn, med et bunnpunkt på {{lowestAmount}}. Å forutse motgang er slik den mister sin makt.',
    },
    {
      title: 'Planlegg for {{date}}',
      message:
        'Den dagen når den anslåtte saldoen {{lowestAmount}}. Flytt en betaling, hold tilbake et ønske, eller sett av kontanter — hver av disse er i din makt i dag.',
    },
    {
      title: 'Prognosen faller under null',
      message:
        'Saldoen synker til {{lowestAmount}} omkring {{date}}. Det rolige svaret er det tidlige.',
    },
    {
      title: 'Forutse gapet {{date}}',
      message:
        'Anslått lavest saldo: {{lowestAmount}}. Det som er forutsett, kan møtes med fatning; det som overrasker oss, sjelden.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Du holdt ord til deg selv',
      message:
        'I {{months}} måneder på rad holdt forbruket ditt seg innenfor planen du satte. Slik ser selvkontroll ut.',
    },
    {
      title: '{{months}} måneder innenfor plan',
      message:
        'Måned etter måned stemmer det du tiltenkte og det du gjorde. Jevnhet er stillere enn viljestyrke og varer lenger.',
    },
    {
      title: 'Plan og liv er enige',
      message:
        '{{months}} måneder på rad innenfor grensene dine. En plan som holdes så godt, er ikke lenger en begrensning — det er måten du lever.',
    },
    {
      title: 'Stabil i {{months}} måneder',
      message:
        'Budsjettene dine har holdt {{months}} måneder på rad. Behold samme oppmerksomhet; det fungerer.',
    },
    {
      title: 'Disiplin, opprettholdt',
      message:
        '{{months}} måneder uten å bryte planen din. Få ting er så frigjørende som å stole på sine egne avgjørelser.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Pengene dine følger verdiene dine',
      message:
        'Penger i dydens tjeneste utgjorde {{actual}} % av forbruket ditt, ikke mindre enn de {{planned}} % du planla. Godt brukt.',
    },
    {
      title: 'Dyd fikk sin fulle andel',
      message:
        '{{actual}} % på helse, læring og andre, mot {{planned}} % planlagt. Det du verdsetter, betalte du for.',
    },
    {
      title: 'Brukt på å bli bedre',
      message:
        'Helse, læring og annet fikk {{actual}} % av månedens forbruk (planlagt {{planned}} %). Dyd kan ikke kjøpes, men den kan tjenes.',
    },
    {
      title: 'Hensikt gjennomført',
      message:
        'Du planla {{planned}} % til dyd og brukte {{actual}} %. Gode hensikter overlever sjelden en måned — dine gjorde.',
    },
    {
      title: 'Den beste bruken av penger',
      message: '{{actual}} % gikk til det som gjør deg og andre bedre. Fortsett å velge det.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Fritid på sin plass',
      message:
        'Fritid er {{actual}} % av forbruket, under de {{planned}} % du tillot den. Du nyter ting uten å bli styrt av dem.',
    },
    {
      title: 'Nytelse, holdt i størrelse',
      message:
        'Fritid tok {{actual}} % mot {{planned}} % planlagt. Måtehold er ikke å gå glipp av noe — det er å velge.',
    },
    {
      title: 'Hvile uten overdrivelse',
      message:
        '{{actual}} % på fritid, under grensen din på {{planned}} %. Glede smaker bedre når den ikke bestemmer.',
    },
    {
      title: 'Måtehold, stillferdig',
      message:
        'Du ga fritiden {{planned}} % og den brukte bare {{actual}} %. Den marginen er frihet du beholdt.',
    },
    {
      title: 'Fritid under plan',
      message:
        'Med {{actual}} % av forbruket holdt fritiden seg under de {{planned}} % du satte. Godt holdt.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '{{percent}} % under plan',
      message:
        'Du brukte {{savedAmount}} mindre enn du hadde tillatt deg for måneden. Å ikke trenge alt man kunne hatt, er en slags rikdom.',
    },
    {
      title: '{{savedAmount}} ubrukt',
      message:
        'Måneden landet {{percent}} % under plan. Det du ikke brukte, er fortsatt ditt å styre.',
    },
    {
      title: 'Mindre enn du tillot',
      message:
        'Forbruket er {{percent}} % under planen — {{savedAmount}} beholdt. Gi den marginen et formål før vanen krever den.',
    },
    {
      title: 'Planen hadde rom til overs',
      message:
        '{{savedAmount}} under grensene dine for måneden. Måtehold som føles lett, er det som varer.',
    },
    {
      title: 'Lettere enn planlagt',
      message:
        'Du trengte {{percent}} % mindre enn du budsjetterte. Vurder å sende de {{savedAmount}} mot et mål.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '«{{goal}}» er i rute',
      message:
        'Du er {{percent}} % av veien, i det tempoet målet trenger. Stø steg, tatt månedlig, rekker langt.',
    },
    {
      title: 'I rute mot «{{goal}}»',
      message:
        '{{percent}} % ferdig og tempoet holder. Fortsett å betale målet først; det fungerer.',
    },
    {
      title: '«{{goal}}»: {{percent}} % og stødig',
      message: 'Målet får det det trenger hver måned. Tålmodigheten gjør sitt arbeid.',
    },
    {
      title: 'Målet beveger seg som planlagt',
      message:
        '«{{goal}}» er {{percent}} % finansiert og i tid. Det som gjøres litt hver måned, kan ikke stoppes av én dårlig uke.',
    },
    {
      title: 'Framgang du kan stole på',
      message:
        '«{{goal}}» står på {{percent}} %, i tempo. Du bygger det på den eneste måten som virker — gradvis.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: 'Færre impulskjøp hos {{merchant}}',
      message:
        'Fra {{before}} kjøp i måneden til omtrent {{after}}. En løsnet vane er vunnet frihet.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'Du besøker mindre enn du gjorde. Hver hoppet refleks er en liten seier for valg over vane.',
    },
    {
      title: 'Den lille vanen krymper',
      message:
        'Kjøp hos {{merchant}} falt fra {{before}} til omtrent {{after}}. Fortsett — det blir lettere.',
    },
    {
      title: 'Valg over refleks',
      message:
        'Hos {{merchant}} gikk du fra {{before}} kjøp til omtrent {{after}}. Det er mestring bygd én avgjørelse om gangen.',
    },
    {
      title: 'Mindre av de små tingene',
      message:
        '{{merchant}} så deg omtrent {{after}} ganger i stedet for {{before}}. Små seire vokser sammen.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Du tilpasset deg en slankere måned',
      message:
        'Inntekten falt {{incomePercent}} %, og du kuttet forbruket {{expensePercent}} %. Du møtte et skifte i skjebnen med et skifte i kurs.',
    },
    {
      title: 'Fatning da inntekten dippet',
      message:
        'Inntekten ned {{incomePercent}} %, forbruket ned {{expensePercent}} %. Du tilpasset deg det som er, ikke det som var.',
    },
    {
      title: 'Skjebnen endret seg; det gjorde du også',
      message:
        'Et fall i inntekten på {{incomePercent}} % møtte et fall i forbruket på {{expensePercent}} %. Det er sinnsro i tall.',
    },
    {
      title: 'Godt styrt',
      message:
        'Da inntekten falt {{incomePercent}} %, fulgte forbruket ({{expensePercent}} % mindre). Vinden var ikke din; seilet var.',
    },
    {
      title: 'Forbruket fulgte inntekten ned',
      message:
        'Du brukte {{expensePercent}} % mindre da inntekten falt {{incomePercent}} %. Å tilpasse seg tidlig er den rolige veien gjennom.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'Nødvendigheter er stabile',
      message:
        'I {{months}} måneder har de nødvendige kostnadene dine nesten ikke rørt seg. Et stabilt gulv gir deg frihet over det.',
    },
    {
      title: 'Behov holdt i sjakk',
      message:
        'Forbruket på nødvendigheter holdt seg jevnt i {{months}} måneder. Behov som ikke vokser, er behov du styrer.',
    },
    {
      title: '{{months}} måneder med stabile nødvendigheter',
      message:
        'Husleie, mat og regninger ble der de var. Stillferdig stabilitet er også en prestasjon.',
    },
    {
      title: 'Ingen kryp i nødvendigheter',
      message:
        '{{months}} måneder uten drift i det livet krever. Alt annet er lettere å planlegge på den grunnen.',
    },
    {
      title: 'Et fast gulv',
      message:
        'De nødvendige utgiftene har vært stabile i {{months}} måneder. Du lar ikke komforter gå for behov.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Gavmild med det du tjener',
      message:
        'Over {{months}} måneder gikk {{percent}} % av inntekten din — {{givenAmount}} — til å hjelpe andre. Det er penge brukt til sitt beste formål.',
    },
    {
      title: '{{givenAmount}} gitt til andre',
      message:
        'Du delte {{percent}} % av inntekten din på {{months}} måneder. Vennlighet som viser seg i tallene, er vennlighet praktisert, ikke bare følt.',
    },
    {
      title: 'Åpne hender',
      message:
        'Veldedighet og gaver tok {{percent}} % av inntekten din den siste tiden. Det du gir bort, er den delen av rikdommen din ingen ulykke kan ta.',
    },
    {
      title: 'Gavmildhet er del av planen din',
      message:
        '{{givenAmount}} til andre over {{months}} måneder. Behold det — det gode du gjør for andre, er også gjort for deg selv.',
    },
    {
      title: 'Godt gitt',
      message:
        '{{percent}} % av det du tjente, gikk til å hjelpe andre. Få vaner sier mer om et menneske.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Ingenting å rette',
      message: 'Forbruket ditt stemmer med det du tiltenkte. Fortsett som du er.',
    },
    {
      title: 'Hensikt og handling er enige',
      message: 'Måneden ser ut som du planla den. Den samsvaret er hele poenget.',
    },
    {
      title: 'En rolig måned',
      message:
        'Ingen overdrivelse, ingen forsømmelse verdt å nevne. Godt gjort — ta med den samme oppmerksomheten videre.',
    },
    {
      title: 'Alt i orden',
      message: 'Planen din holdt, og ingenting ber om retting. Nyt roen du har fortjent.',
    },
    {
      title: 'Stø hånd',
      message: 'Måneden fulgte planen din. Gode vaner får gode måneder til å se vanlige ut.',
    },
  ],
  'stoic.keep_first': [
    {
      title: 'Behold din del først',
      message:
        'På {{months}} måneder beholdt du {{savingsPercent}} % av inntekten. Senecas advarsel: det er for sent å spare når man er nede i bunnfallet i fatet. Legg til side {{tenthAmount}} samme dag som inntekten kommer.',
    },
    {
      title: 'Spar mens fatet er fullt',
      message:
        'Bare {{savingsPercent}} % av inntekten ble igjen hos deg. Sparsomhet som venter på det som blir til overs, kommer for sent; {{tenthAmount}} i måneden, lagt til side først, begynner nå.',
    },
    {
      title: 'Det som er ditt, behold det',
      message:
        'Seneca råder oss til å beholde det som virkelig er vårt, og til å begynne tidlig. Det siste har {{savingsPercent}} % av inntekten blitt igjen hos deg; begynn med {{tenthAmount}} på lønningsdagen og la forbruket innrette seg etter resten.',
    },
    {
      title: 'Begynn før bunnfallet',
      message:
        'Du beholdt {{savingsPercent}} % over {{months}} måneder. Å spare står bare i din makt så lenge det ennå er noe å spare: legg {{tenthAmount}} til side før alt annet.',
    },
    {
      title: '{{savingsPercent}} % beholdt, og fatet tømmes',
      message:
        '{{tenthAmount}} i måneden, en tidel av inntekten, lagt til side før enhver regning. Det du beholder først, avhenger ikke av hva måneden etterlater.',
    },
  ],
  'stoic.prepare_beforehand': [
    {
      title: 'Forbered deg mens det er rolig',
      message:
        'Reserven din dekker omtrent {{cushionDays}} dagers forbruk. Seneca: sjelen bør herde seg i tider fri for bekymring. Tre måneders forbruk er {{targetAmount}}.',
    },
    {
      title: 'En reserve på {{cushionDays}} dager',
      message:
        'Skjebnen varsler ikke sin komme. Bygg opp mot {{targetAmount}}, tre måneders forbruk, mens ingenting presser på: da er det lett.',
    },
    {
      title: '«Var det denne tilstanden jeg fryktet?»',
      message:
        'Seneca lot Lucilius øve seg på fattigdom slik at den mistet sin skrekk. Med {{cushionDays}} dagers reserve ville en hard måned ikke vært noen øvelse. Sikt mot {{targetAmount}}.',
    },
    {
      title: 'Forutse den harde måneden',
      message:
        'Sparepengene dine ville rukket i omtrent {{cushionDays}} dager. Det man har sett komme, rammer mildere; {{targetAmount}} ville båret deg i tre måneder.',
    },
    {
      title: 'Bygg muren før stormen',
      message:
        'Omtrent {{cushionDays}} dager er dekket. At inntekten faller bort, står ikke i din makt; reserven gjør. Tre måneders forbruk blir {{targetAmount}}.',
    },
  ],
  'stoic.wants_outrun_income': [
    {
      title: 'Begjæret løper fra inntekten',
      message:
        'Forbruket steg med {{expenseGrowth}} % det siste kvartalet mens inntekten endret seg med {{incomeGrowth}} %. Det er ikke den som har for lite, skriver Seneca, men den som begjærer mer, som er fattig.',
    },
    {
      title: 'Å leve høyere, ikke bedre',
      message:
        'Forbruket vokste med {{expenseGrowth}} %, inntekten med {{incomeGrowth}} %. Naturens behov er små; innbilningens krav er uendelige. Spør hvem av dem økningen tjener.',
    },
    {
      title: 'Behovene har vokst: +{{expenseGrowth}} %',
      message:
        'Utgiftene steg raskere enn inntekten ({{incomeGrowth}} %). En ny bekvemmelighet føles snart som et behov: legg merke til den mens du ennå kan si nei.',
    },
    {
      title: 'Målstreken flytter seg',
      message:
        'Forbruket er opp {{expenseGrowth}} % fra forrige kvartal, inntekten {{incomeGrowth}} %. Nok forblir bare nok hvis du selv avgjør hva det er.',
    },
    {
      title: 'Mer er ikke kuren',
      message:
        'Det siste kvartalet vokste forbruket med {{expenseGrowth}} % og inntekten med {{incomeGrowth}} %. Rikdom som vokser med begjæret, kommer aldri frem; sett grensen før dette blir det nye normale.',
    },
  ],
  'stoic.price_in_life': [
    {
      title: '{{merchant}} kostet {{hours}} timer av livet ditt',
      message:
        'Seneca minner oss om at bare tiden virkelig er vår. {{totalAmount}} hos {{merchant}} er omtrent {{hours}} timers arbeid. Var det verdt det?',
    },
    {
      title: '{{hours}} timer hos {{merchant}}',
      message:
        'Vi vokter pengene våre og gir tiden vår bort. Med din gjennomsnittlige timeinntekt er {{totalAmount}} der omtrent {{hours}} arbeidstimer.',
    },
    {
      title: 'Regn om til timer',
      message:
        '{{totalAmount}} hos {{merchant}} er omtrent {{hours}} timers arbeid. Timer er det eneste du ikke kan tjene inn igjen.',
    },
    {
      title: 'Hva {{merchant}} virkelig kostet',
      message:
        'Du bytter dagene dine mot penger, og pengene mot ting. {{merchant}} tok omtrent {{hours}} timer av dine ({{totalAmount}}). Svarer gleden til timene?',
    },
    {
      title: 'Vei timene',
      message:
        'Regnet om til din gjennomsnittlige timeinntekt er {{totalAmount}} hos {{merchant}} omtrent {{hours}} timer. Vi mister mye av tiden vår, skriver Seneca. Valgte du dette?',
    },
  ],
  'stoic.rule_broken': [
    {
      title: 'Regelen «{{rule}}» har mistet veien',
      message:
        'Den peker på noe som ikke finnes lenger, og har derfor stille sluttet å virke. Reparer den eller fjern den: en orden som ikke gjør noe, ligner bare på orden.',
    },
    {
      title: '«{{rule}}» virker ikke lenger',
      message:
        'Kategorien, kontoen eller mottakeren er borte, og regelen blir nå hoppet over ved hver transaksjon. Se tingene som de er, og rett dem så.',
    },
    {
      title: 'En regel som sikter mot ingenting',
      message:
        '«{{rule}}» sender transaksjoner til et sted som er fjernet. Du bestemte noe en gang; bestem på nytt nå som tingene har endret seg.',
    },
    {
      title: '«{{rule}}» trenger din dømmekraft',
      message:
        'Det den viser til, er slettet, og transaksjonene den pleide å sortere, venter nå på deg. Gi den et nytt mål eller la den gå.',
    },
    {
      title: 'En ødelagt regel, i stillhet',
      message:
        '«{{rule}}» gjør ingenting og sier ikke noe om det. Rett det som står i din makt: det tar ett minutt.',
    },
  ],
  'stoic.rule_contradicted': [
    {
      title: 'Hånden din er uenig med «{{rule}}»',
      message:
        '{{count}} ganger sorterte du for hånd annerledes enn denne regelen gjør. Enten tar regelen feil, eller hånden gjør det: avgjør hvem.',
    },
    {
      title: '«{{rule}}» ble overstyrt {{count}} ganger',
      message:
        'En regel du stadig retter, er ikke lenger en beslutning, bare en vane med å krangle med seg selv. Endre den, eller stol på den.',
    },
    {
      title: 'Si hva du gjør, gjør hva du sa',
      message:
        'Regelen «{{rule}}» sier ett; de siste {{count}} rettelsene dine sier noe annet. Få de to til å stemme overens.',
    },
    {
      title: 'En beslutning i strid',
      message:
        'Du satte «{{rule}}» med klart hode, og siden har {{count}} transaksjoner gått en annen vei. Se rolig etter igjen hvem av dere som hadde rett.',
    },
    {
      title: '{{count}} rettelser mot «{{rule}}»',
      message: 'Gjentakelse er informasjon. La den endre regelen, eller la regelen endre vanen.',
    },
  ],
  'stoic.rule_worth_writing': [
    {
      title: 'Bestem én gang om {{payee}}',
      message:
        'Du har sortert {{payee}} for hånd {{decided}} ganger, alltid på samme måte. Det du bestemmer igjen og igjen, bestem det én gang, med klart hode.',
    },
    {
      title: 'En beslutning tatt {{decided}} ganger',
      message:
        '{{payee}} stiller det samme spørsmålet, og du gir det samme svaret. En regel sparer oppmerksomheten din til det som virkelig trenger den.',
    },
    {
      title: 'Mottakere som er klare for en regel: {{count}}',
      message:
        'De samme mottakerne får den samme kategorien av deg, {{payee}} mest av alle. Spar dømmekraften din til det som er nytt.',
    },
    {
      title: 'Vanen din er klar til å bli et prinsipp',
      message:
        'Du sorterer {{payee}} likt hver gang (hittil {{decided}} ganger). Skriv det ned som en regel, så holder det uten anstrengelse.',
    },
    {
      title: 'La en regel bære dette',
      message:
        'Mottakere du sorterer likt hver gang: {{count}}, blant dem {{payee}} med {{decided}} transaksjoner. Et prinsipp som er avgjort én gang, trenger ikke diskuteres på nytt.',
    },
  ],
  'stoic.rule_idle': [
    {
      title: '«{{rule}}» har ikke truffet noe på {{months}} måneder',
      message:
        'Enten er verdenen den ble laget for, borte, eller så bommer vilkårene på målet. Hold reglene dine sanne: reparer den eller fjern den.',
    },
    {
      title: 'En regel i hvile: «{{rule}}»',
      message:
        'Den har ikke rørt en eneste transaksjon på {{months}} måneder. Kast bort det overflødige; det som blir igjen, er lettere å stole på.',
    },
    {
      title: '«{{rule}}» står stille',
      message:
        '{{months}} måneder uten treff mens nye transaksjoner stadig kommer. Prøv den på de siste transaksjonene dine, og bestem så.',
    },
    {
      title: 'Trengs «{{rule}}» fortsatt?',
      message:
        'Ingenting har passet til den på {{months}} måneder. En regel man beholder av vane, er enda en ting å passe på.',
    },
    {
      title: 'En beslutning uten noe å bestemme',
      message:
        '«{{rule}}» har vært taus i {{months}} måneder. Orden betyr å ha det man trenger, og bare det.',
    },
  ],
  'stoic.praise_rules_hold': [
    {
      title: 'Beslutningene dine holder',
      message:
        'Regler sorterte {{percent}} % av månedens transaksjoner, og du trengte ikke overstyre noen. En beslutning som tas én gang og holdes, frigjør sinnet.',
    },
    {
      title: '{{percent}} % avgjort på forhånd',
      message:
        'De fleste av månedens transaksjoner ble sortert etter det du hadde bestemt tidligere. Det er oppmerksomhet spart til det som betyr noe.',
    },
    {
      title: 'Prinsipper i arbeid',
      message:
        'Reglene dine håndterte {{percent}} % av transaksjonene uten strid. Avgjorte prinsipper gir rolige dager.',
    },
    {
      title: 'Mindre å avgjøre',
      message:
        '{{percent}} % av transaksjonene krevde ingen ny beslutning. Du dømte én gang, godt, og dommen står ennå.',
    },
    {
      title: 'Orden bevart',
      message:
        'Regler sorterte {{percent}} % av måneden, og ingen ble motsagt. God orden ser ut som om ingenting skjer.',
    },
  ],
  'stoic.goal_no_date': [
    {
      title: '«{{goal}}» har ingen dato',
      message:
        'Det står på {{percent}} %, og ingenting går inn. Når man ikke vet hvilken havn man styrer mot, er ingen vind den rette: nevn dagen du vil nå fram.',
    },
    {
      title: 'Et ønske eller et mål?',
      message:
        '«{{goal}}» har ingen frist og ingen takt. Et mål er en beslutning med en dato; gi det en, eller la det gå.',
    },
    {
      title: 'Nevn dagen for «{{goal}}»',
      message:
        'Det er {{percent}} % av veien og rører seg ikke. Det som kan gjøres når som helst, blir sjelden gjort.',
    },
    {
      title: '«{{goal}}» venter på «en dag»',
      message:
        'Ingenting har gått inn den siste tiden, og ingen dato krever noe. «En dag» står ikke i kalenderen din; velg en dag som gjør det.',
    },
    {
      title: '«{{goal}}» har ingen havn',
      message:
        'På {{percent}} %, uten frist. Vet du hvor du seiler, følger det månedlige steget av seg selv.',
    },
  ],
};
