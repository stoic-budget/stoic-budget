import type { StoicTextMap } from './types';

export const nl: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'De maand is boven haar plan uitgegroeid',
      message:
        'Je plande {{plannedAmount}} en hebt {{spentAmount}} uitgegeven — {{percent}}% meer. Het plan maakte je met een helder hoofd; laat het luider spreken dan het moment.',
    },
    {
      title: '{{percent}}% boven wat je wilde uitgeven',
      message:
        'De uitgaven staan op {{spentAmount}} tegenover een plan van {{plannedAmount}}. Kijk welke grens als eerste bezweek — daar zit de les.',
    },
    {
      title: 'Je plan en je maand zijn het oneens',
      message:
        '{{spentAmount}} uitgegeven, {{plannedAmount}} bedoeld. Of het plan vroeg te weinig van de werkelijkheid, of de werkelijkheid te veel van jou — bepaal rustig welke van de twee.',
    },
    {
      title: 'Er ging meer uit dan je toestond',
      message:
        'De maand zit {{percent}}% boven de {{plannedAmount}} die je had vastgesteld. Nu stoppen kost niets; doen alsof het niet gebeurde kost veel.',
    },
    {
      title: 'Een grens gesteld, een grens overschreden',
      message:
        'Je wilde {{plannedAmount}} uitgeven; het werd {{spentAmount}}. Zelfbeheersing is niet nooit uitglijden — het is het vroeg merken en terugkeren naar het pad.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Vrije tijd neemt meer dan gepland',
      message:
        'Je wilde {{planned}}% van je uitgaven aan vrije tijd besteden; het werd {{actual}}%. Plezier is welkom als gast, niet als heer des huizes.',
    },
    {
      title: 'Vrije tijd op {{actual}}%, gepland {{planned}}%',
      message:
        'Rust verdient haar plaats wanneer ze je herstelt. Vraag je af welke genoegens van de maand dat deden, en laat de rest zonder spijt gaan.',
    },
    {
      title: 'Comfort geeft meer uit dan je voornemen',
      message:
        'Vrije tijd neemt {{actual}}% van de uitgaven in tegenover de {{planned}}% die je koos. Matigheid is geen plezier weigeren — het is plezier op de maat houden die je zelf bepaalde.',
    },
    {
      title: 'Het aangename verdringt het geplande',
      message:
        'Je gaf vrije tijd {{planned}}% van het plan en het nam {{actual}}%. Wat je makkelijk geniet, verdient een tweede blik voordat het iets wordt wat je nodig hebt.',
    },
    {
      title: 'Vrije tijd is over haar lijn gestapt',
      message:
        '{{actual}}% van de maand ging naar vrije tijd, {{planned}}% was het voornemen. Jij trok die lijn, en het is aan jou om haar vast te houden.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Vrije tijd weer boven plan',
      message:
        'Vrije tijd ging in {{months}} van de laatste {{window}} maanden over je plan. Een herhaling is geen toeval meer — het is een gewoonte die het onderzoeken waard is.',
    },
    {
      title: '{{months}} van {{window}} maanden boven het vrijetijdsplan',
      message:
        'Wat één keer gebeurt, is omstandigheid; wat {{months}} keer gebeurt, is karakter in wording. Kies dat karakter bewust.',
    },
    {
      title: 'Dezelfde misstap, maand na maand',
      message:
        'Vrije tijd ging in {{months}} van de {{window}} maanden over het plan. Verhoog het plan eerlijk of verander de gewoonte — ertussenin leven kost het meest.',
    },
    {
      title: 'Een patroon, geen uitglijder',
      message:
        'In {{months}} van de laatste {{window}} maanden nam vrije tijd meer dan je het gaf. Let op het moment waarop de beslissing valt, niet alleen op de rekening achteraf.',
    },
    {
      title: 'De gewoonte stemt tegen je plan',
      message:
        'Vrije tijd versloeg het plan {{months}} keer in {{window}} maanden. Gewoonten bouw je één keuze tegelijk op; zo breek je ze ook af.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'Deugd krijgt minder dan bedoeld',
      message:
        'Je had {{planned}}% van je budget bestemd voor gezondheid, leren en meer; het werd {{actual}}%. Een voornemen telt pas als het is uitgevoerd.',
    },
    {
      title: 'Deugd op {{actual}}% van geplande {{planned}}%',
      message:
        'Het geld dat je bestemde voor wat je beter maakt, wacht nog steeds. Er is geen beter moment om het goed uit te geven dan nu.',
    },
    {
      title: 'Het goede dat je plande, is niet besteed',
      message:
        'Gezondheid, leren en vrijgevigheid zouden {{planned}}% van de uitgaven krijgen; ze kregen {{actual}}%. Doe er deze week bewust één van.',
    },
    {
      title: 'Voornemen zonder daad',
      message:
        'Deugd neemt {{actual}}% van de uitgaven in tegenover de {{planned}}% die je koos. Wat we waarderen, zie je aan waar we werkelijk voor betalen.',
    },
    {
      title: 'Ruimte over voor wat ertoe doet',
      message:
        'Slechts {{actual}}% ging naar deugd, terwijl je {{planned}}% plande. Een boek, een controle bij de dokter, een gift aan iemand in nood — het plan zei al ja.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'Deugd wordt steeds uitgesteld',
      message:
        'Uitgaven aan gezondheid, leren en anderen blijven al {{months}} maanden op rij onder je plan. Wat je steeds uitstelt, heb je in feite al afgewezen.',
    },
    {
      title: '{{months}} maanden uitgestelde deugd',
      message:
        'Elke maand maakte het plan ruimte voor wat je beter maakt, en elke maand bleef die ruimte onbenut. Tijd is het enige dat je niet twee keer kunt budgetteren.',
    },
    {
      title: 'Je betere zelf wacht nog steeds',
      message:
        'Deugd zit al {{months}} maanden op rij onder plan. Begin liever klein en zeker dan groots en later.',
    },
    {
      title: 'Goede voornemens worden oud',
      message:
        'Al {{months}} maanden kregen gezondheid, leren en vrijgevigheid minder dan gepland. Kies er één en financier die volgende maand als eerste, vóór al het andere.',
    },
    {
      title: 'Deugd verliest steeds van “later”',
      message:
        '{{months}} maanden op rij onder plan. “Later” is waar goede voornemens heen gaan om vergeten te worden — geef dit voornemen een datum.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'Je plan heeft geen ruimte voor deugd',
      message:
        'Geen van je budgetten dient gezondheid, leren of anderen. Een plan laat zien wat we waarderen — overweeg deugd een eigen regel te geven.',
    },
    {
      title: 'Overal een budget, behalve voor het goede',
      message:
        'Noodzaak, werk en vrije tijd hebben allemaal grenzen; deugd heeft er geen. Waar nooit voor gepland wordt, gebeurt meestal ook nooit.',
    },
    {
      title: 'Plan voor wat je beter maakt',
      message:
        'Er is nog geen budget in de klasse deugd. Zelfs een klein budget — boeken, sport, een donatie — maakt van een wens een verplichting.',
    },
    {
      title: 'Het plan zwijgt over deugd',
      message:
        'Je budgetteert voor wat moet en wat je leuk vindt, nog niet voor wie je wilt worden. Eén bescheiden deugdbudget zou dat veranderen.',
    },
    {
      title: 'Deugd heeft geen budget',
      message:
        'Uitgaven aan gezondheid, leren of anderen zijn nergens gepland. Kies er één en geef het een grens die je graag zou bereiken.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'Noodzaak kost meer dan gepland',
      message:
        'Je plande {{planned}}% van de uitgaven voor noodzaak; het is {{actual}}%. Ga na of elke post nog een behoefte is of ongemerkt een gemak is geworden.',
    },
    {
      title: 'Noodzaak op {{actual}}%, gepland {{planned}}%',
      message:
        'Wat het leven vraagt, is meestal minder dan waar we aan gewend raken. Bekijk je grootste noodzakelijke uitgave met frisse ogen.',
    },
    {
      title: 'Het noodzakelijke zwelt op',
      message:
        'Noodzaak neemt {{actual}}% van de maand in tegenover de {{planned}}% die je verwachtte. Een behoefte die blijft groeien, verdient een vraag.',
    },
    {
      title: 'Behoeften groeien het plan voorbij',
      message:
        'Gepland {{planned}}%, werkelijk {{actual}}%. Of het plan onderschatte de echte kosten, of sommige wensen reizen onder de naam van behoeften.',
    },
    {
      title: 'Meer aan “moeten” dan bedoeld',
      message:
        'Noodzaak nam {{actual}}% van de uitgaven in plaats van {{planned}}%. Scheid wat echt moet van wat alleen altijd al zo was.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'Noodzaak kruipt omhoog',
      message:
        'De uitgaven aan noodzaak stijgen al {{months}} maanden op rij, in totaal {{percent}}%. Behoeften groeien stil wanneer niemand ze vraagt zich te verantwoorden.',
    },
    {
      title: '+{{percent}}% aan noodzaak in {{months}} maanden',
      message:
        'Elke stap leek klein; samen zijn ze dat niet. Neem de grootste terugkerende noodzakelijke uitgave en vraag of die nog zoveel moet kosten.',
    },
    {
      title: 'De bodem van je uitgaven stijgt',
      message:
        'Noodzaak groeide {{months}} maanden achter elkaar (+{{percent}}%). Een stijgende bodem laat minder ruimte voor alles wat je vrij kiest.',
    },
    {
      title: 'Behoeften dijen uit',
      message:
        '{{months}} maanden groei, {{percent}}% in totaal. De stoïcijnse toets is eenvoudig: zou je dit vandaag opnieuw kiezen, met de prijs voor ogen?',
    },
    {
      title: 'Kleine stijgingen, vaste richting',
      message:
        'Noodzaak is {{percent}}% gestegen in {{months}} maanden. De richting telt meer dan één maand — deze is het waard om vroeg bij te sturen.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'Werk kost meer dan gepland',
      message:
        'Je plande {{planned}}% van de uitgaven voor werk; het is {{actual}}%. Gereedschap en diensten moeten hun plek verdienen — ga na welke dat doen.',
    },
    {
      title: 'Werkuitgaven op {{actual}}%, gepland {{planned}}%',
      message:
        'Investeren in je werk is goed wanneer het iets oplevert. Bekijk waar je voor betaalt maar wat je niet meer gebruikt.',
    },
    {
      title: 'Het werkbudget staat onder druk',
      message:
        'Werk nam {{actual}}% in plaats van {{planned}}%. Toewijding is het werk goed doen, niet elk gereedschap ervoor kopen.',
    },
    {
      title: 'Gereedschap geeft meer uit dan het plan',
      message:
        'Gepland {{planned}}%, uitgegeven {{actual}}% aan werk. Vraag bij elke uitgave: helpt dit me het werk te doen, of voelt het alleen als vooruitgang?',
    },
    {
      title: 'Werkkosten zijn verschoven',
      message:
        'Werk neemt {{actual}}% van de uitgaven in tegenover {{planned}}% bedoeld. Een korte controle nu bespaart later een grotere.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '“{{category}}” gaat weer over de grens',
      message:
        '“{{category}}” ging in {{months}} van de laatste {{window}} maanden over budget. Of de grens klopt niet, of het verlangen — beslis welke.',
    },
    {
      title: '“{{category}}”: {{months}} van {{window}} maanden over budget',
      message:
        'Een grens die altijd wordt overschreden, is geen grens maar een wens. Maak haar eerlijk — verhoog haar bewust of houd je er bewust aan.',
    },
    {
      title: 'Hetzelfde budget bezwijkt opnieuw',
      message:
        '“{{category}}” ging {{months}} keer in {{window}} maanden over de grens. De herhaling is informatie; gebruik haar.',
    },
    {
      title: '“{{category}}” vraagt je aandacht',
      message:
        'Over budget in {{months}} van {{window}} maanden. Let op het moment vóór de aankoop — alleen daar kan de gewoonte veranderen.',
    },
    {
      title: 'Een patroon in “{{category}}”',
      message:
        '{{months}} overschrijdingen in {{window}} maanden. Wat we herhalen, worden we; bepaal wat je wilt dat deze categorie over je zegt.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '“{{category}}” is op rond dag {{day}}',
      message:
        'Je hebt {{spentAmount}} van {{limitAmount}} uitgegeven, en in dit tempo is de grens rond dag {{day}} bereikt. Nu afremmen is makkelijker dan later stoppen.',
    },
    {
      title: '“{{category}}” loopt voor op de maand',
      message:
        'Al {{spentAmount}} weg van een grens van {{limitAmount}}. In dit tempo is die op rond dag {{day}} — de rest van de maand kun je nog zelf vormgeven.',
    },
    {
      title: 'Tempocheck: “{{category}}”',
      message:
        'In het huidige tempo houdt het budget van {{limitAmount}} het tot ongeveer dag {{day}}. Vooruitzien is de goedkoopste vorm van discipline.',
    },
    {
      title: '“{{category}}” geeft de toekomst uit',
      message:
        '{{spentAmount}} van {{limitAmount}} uitgegeven; de grens is rond dag {{day}} bereikt. Wat je deze week doet, beslist of dat gebeurt.',
    },
    {
      title: 'Vroege waarschuwing voor “{{category}}”',
      message:
        'In het huidige tempo haalt de grens van {{limitAmount}} het einde van de maand niet — die is rond dag {{day}} op. Stuur bij zolang het weinig kost.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '“{{category}}” wordt niet gebruikt',
      message:
        'Het budget voor “{{category}}” heeft al {{months}} maanden geen uitgaven gezien. Of je bent het ontgroeid, of het is een voornemen dat nog wacht — beslis welke.',
    },
    {
      title: 'Een leeg budget: “{{category}}”',
      message:
        '{{months}} maanden zonder één uitgave. Een plan hoort het leven te beschrijven dat je leidt of het leven dat je opbouwt — welke is dit?',
    },
    {
      title: '“{{category}}” ligt stil',
      message:
        'Hier is {{months}} maanden niets uitgegeven. Was het matigheid, goed gedaan; was het verwaarlozing, kom in actie.',
    },
    {
      title: 'Gepland, maar niet geleefd',
      message:
        '“{{category}}” heeft al {{months}} maanden een grens en geen uitgaven. Houd het plan waarheidsgetrouw: schrap het of gebruik het.',
    },
    {
      title: '“{{category}}”: {{months}} stille maanden',
      message:
        'Een budget dat nooit wordt aangeraakt, neemt toch een plaats in je plan in. Maak die plaats vrij of eer het voornemen.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}}% van de uitgaven heeft geen grens',
      message:
        '{{unbudgetedAmount}} van de maand ging naar categorieën waar geen budget over waakt. Wat je niet hebt bekeken, kun je niet beoordelen.',
    },
    {
      title: 'Een groot deel van de maand is ongepland',
      message:
        '{{percent}}% van de uitgaven — {{unbudgetedAmount}} — valt buiten elk budget. Geef het grootste deel ervan een grens, en het plan ziet meer van je leven.',
    },
    {
      title: 'Uitgaven buiten het plan',
      message:
        'Budgetten dekken maar een deel van wat je uitgeeft; {{unbudgetedAmount}} ({{percent}}%) blijft ongemeten. Breid het plan uit naar waar het geld echt heen gaat.',
    },
    {
      title: 'Het plan ziet maar een deel van het geheel',
      message:
        '{{percent}}% van de uitgaven van de maand heeft geen budget. Helder zien komt vóór goed oordelen.',
    },
    {
      title: '{{unbudgetedAmount}} uitgegeven zonder grens',
      message:
        'Dat is {{percent}}% van de maand. Je hoeft het niet te beperken — beslis alleen hoeveel je er werkelijk van wilt.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '“{{category}}” is het grootste deel van je vrije tijd',
      message:
        '{{percent}}% van de vrijetijdsuitgaven ging naar “{{category}}”. Geniet ervan, maar ga na of je er afstand van zou kunnen doen.',
    },
    {
      title: 'Eén genoegen overheerst',
      message:
        '“{{category}}” neemt {{percent}}% van alles wat je aan vrije tijd uitgaf. Vraag je af of het je nog vreugde geeft of routine is geworden.',
    },
    {
      title: 'Vrije tijd leunt op “{{category}}”',
      message:
        '{{percent}}% van de vrije tijd op één plek. Waar we niet zonder kunnen, heeft vat op ons — kijk of de greep nog licht is.',
    },
    {
      title: '“{{category}}”: {{percent}}% van de vrije tijd',
      message:
        'Eén enkele bron van plezier neemt bijna alles in beslag. Doe er een tijdje zonder en kijk wat het je werkelijk geeft.',
    },
    {
      title: 'Je ontspanning heeft één adres',
      message:
        'Het meeste vrijetijdsgeld, {{percent}}%, gaat naar “{{category}}”. Van een genoegen ben je alleen vrij als je het zou kunnen missen.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Een deel van de uitgaven is nog niet beoordeeld',
      message:
        'Categorieën zonder klasse: {{count}}. Bepaal bij Budgetten wat noodzaak, werk, deugd of vrije tijd is.',
    },
    {
      title: 'Categorieën die op je oordeel wachten: {{count}}',
      message:
        'Ze hebben uitgaven maar geen klasse, dus het advies kan ze niet wegen. Eén minuut bij Budgetten lost het op.',
    },
    {
      title: 'Benoem wat je geld dient',
      message:
        'Nog niet ingedeelde categorieën: {{count}}. Oordelen begint bij de dingen bij hun juiste naam noemen.',
    },
    {
      title: 'Onbeoordeelde categorieën: {{count}}',
      message:
        'Is het een behoefte, je werk, een deugd of een genoegen? Alleen jij kunt het zeggen — en het plan wordt helderder zodra je dat doet.',
    },
    {
      title: 'Enkele categorieën hebben geen klasse',
      message:
        'Categorieën buiten de vier klassen: {{count}}. Deel ze in bij Budgetten, zodat elke uitgave wordt gezien voor wat ze is.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: 'Kleine aankopen bij {{merchant}}: {{count}}',
      message:
        'Elke aankoop leek onbeduidend; samen kwamen ze in de maand op {{totalAmount}}. Kleine, niet onderzochte gewoonten zijn waar het meeste geld ongemerkt blijft hangen.',
    },
    {
      title: '{{merchant}}: {{count}} keer in een maand',
      message:
        '{{totalAmount}} in kleine bedragen. Vraag je af of elk bezoek een keuze was of een reflex: alleen het eerste is vrijheid.',
    },
    {
      title: 'Beetje bij beetje: {{totalAmount}}',
      message:
        'Aankopen bij {{merchant}}: {{count}}. Geen enkele doet ertoe; de gewoonte wel. Beslis hoe vaak je die werkelijk wilt.',
    },
    {
      title: 'Een gewoonte bij {{merchant}}',
      message:
        '{{count}} aankopen, samen {{totalAmount}}. Sla er eens één op de drie over en kijk of je hem mist.',
    },
    {
      title: 'De kleine dingen tellen op',
      message:
        'Bezoeken aan {{merchant}}: {{count}}, voor {{totalAmount}}. Beheersing over grote beslissingen rust op kleine zoals deze.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Het weekend draagt {{percent}}% van de vrije tijd',
      message:
        'Het meeste van je vrijetijdsuitgaven valt op zaterdag en zondag. Rust is goed; kijk of het rust is en geen compensatie voor de week.',
    },
    {
      title: 'Vrije tijd leeft in het weekend',
      message:
        '{{percent}}% van de vrijetijdsuitgaven valt in het weekend. Plan het weekend een beetje, en het kost minder en geeft meer.',
    },
    {
      title: 'Het weekend betaalt voor de week',
      message:
        'Weekenden nemen {{percent}}% van wat je aan vrije tijd uitgeeft. Als de week elke zaterdag gerepareerd moet worden, kijk dan naar de week.',
    },
    {
      title: 'Zaterdag en zondag: {{percent}}% van de vrije tijd',
      message:
        'Vrije dagen nodigen uit tot vrij uitgeven. Bepaal vóór het weekend waar het voor is, en laat het geld volgen.',
    },
    {
      title: 'Een weekendpatroon',
      message:
        '{{percent}}% van de vrijetijdsuitgaven gebeurt in het weekend. Wat meer lucht op doordeweekse dagen maakt het weekend vaak goedkoper.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} nam {{percent}}% van de maand',
      message:
        '{{totalAmount}} ging voor vrije tijd naar één enkele winkel. Als één plek zoveel van je geld heeft, vraag je dan af hoeveel van je aandacht het ook heeft.',
    },
    {
      title: 'Eén plek, {{totalAmount}}',
      message:
        '{{merchant}} is {{percent}}% van de uitgaven van de maand. Is het dat aandeel van het werk van je leven waard?',
    },
    {
      title: '{{merchant}} voert je uitgaven aan',
      message:
        '{{percent}}% van de maand — {{totalAmount}} — ging daarheen. Niets mis met ervan genieten, zolang je het opnieuw zou kiezen.',
    },
    {
      title: 'Een groot aandeel bij {{merchant}}',
      message:
        '{{totalAmount}}, of {{percent}}% van de uitgaven, op één plek voor vrije tijd. Weeg het plezier rustig af tegen de prijs.',
    },
    {
      title: '{{percent}}% bij {{merchant}}',
      message:
        'Deze ene winkel nam {{totalAmount}}. Vrijheid is er voorbij kunnen lopen wanneer je dat kiest.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Inkomen daalde, uitgaven niet',
      message:
        'Het inkomen daalde {{percent}}% naar {{incomeAmount}}, maar de uitgaven bleven op {{expenseAmount}}. Het lot veranderde van gedachten; je uitgaven hebben het nog niet gemerkt.',
    },
    {
      title: 'Inkomen {{percent}}% lager',
      message:
        '{{incomeAmount}} kwam binnen tegenover {{expenseAmount}} dat uitging. Wat het lot geeft, kan het terugnemen — stem de uitgaven af op wat is, niet op wat was.',
    },
    {
      title: 'Een schralere maand, dezelfde gewoonten',
      message:
        'Het inkomen is {{percent}}% lager ({{incomeAmount}}), terwijl de uitgaven op {{expenseAmount}} bleven. Het inkomen ligt niet in je macht; je reactie wel.',
    },
    {
      title: 'Het lot is gekeerd',
      message:
        'Je verdiende {{percent}}% minder dan gewoonlijk, maar gaf {{expenseAmount}} uit zoals altijd. Snoei nu, zolang het nog een keuze is en geen noodzaak.',
    },
    {
      title: 'De uitgaven volgden het inkomen niet',
      message:
        'Het inkomen zakte naar {{incomeAmount}} ({{percent}}% lager); de uitgaven zijn {{expenseAmount}}. Zet het zeil naar de wind die je werkelijk hebt.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Abonnementen: {{monthlyAmount}} per maand',
      message:
        'Abonnementen: {{count}}, samen {{percent}}% van je maandelijkse uitgaven. Elk verlengt zichzelf zonder het je te vragen — vraag het jezelf dan bij elk ervan.',
    },
    {
      title: '{{percent}}% van de uitgaven verlengt zichzelf',
      message:
        'Abonnementen: {{count}}, {{monthlyAmount}} per maand. Houd de abonnementen die je vandaag opnieuw zou afsluiten.',
    },
    {
      title: 'Stil, terugkerend, {{monthlyAmount}}',
      message:
        'Abonnementen: {{count}}, goed voor {{percent}}% van je maand. Gemak is een goede dienaar en een dure meester.',
    },
    {
      title: 'Abonnementen om na te lopen: {{count}}',
      message:
        'Samen zijn ze {{monthlyAmount}} per maand, {{percent}}% van de uitgaven. Zeg er één op die je nauwelijks gebruikt en merk hoe weinig je het mist.',
    },
    {
      title: 'Wat zichzelf verlengt',
      message:
        '{{monthlyAmount}} per maand over je abonnementen ({{count}}). Automatische uitgaven verdienen een bewuste herziening.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Je succes kan nog iets verder reiken',
      message:
        'In {{months}} maanden hield je {{savingsPercent}}% van je inkomen over, maar bijna niets ging naar anderen. Rijkdom ligt het best in open handen — misschien één cadeau of gift deze maand?',
    },
    {
      title: 'Goed verdienen, weinig geven',
      message:
        'In {{months}} maanden kwam er {{incomeAmount}} binnen en ging {{givenAmount}} naar anderen. Help je op manieren die deze app niet ziet, negeer dit dan; zo niet, dan is er ruimte voor in je plan.',
    },
    {
      title: 'Een goede tijd om vrijgevig te zijn',
      message:
        'Je spaarde {{savingsPercent}}% van je inkomen — teken van een vaste hand. Een klein deel daarvan, gegeven aan iemand die het nodig heeft, zou die vastheid meer betekenis geven.',
    },
    {
      title: 'Nog niemand anders in beeld',
      message:
        'De afgelopen {{months}} maanden tonen zorgvuldig verdienen en sparen, maar geen giften of cadeaus. We zijn er voor elkaar; een bescheiden gift is genoeg om te beginnen.',
    },
    {
      title: 'Ruimte voor vriendelijkheid',
      message:
        'Slechts {{givenAmount}} van {{incomeAmount}} ging naar het helpen van anderen. Overweeg een kleine, vaste gift — vrijgevigheid wordt, zoals elke deugd, makkelijker met gewoonte.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '“{{goal}}” raakt achter',
      message:
        'Het vraagt {{requiredAmount}} per maand, en jij legt er ongeveer {{paceAmount}} in. In dit tempo komt het {{monthsLate}} maanden te laat aan. Het tempo staat in jouw macht.',
    },
    {
      title: '“{{goal}}”: {{monthsLate}} maanden te laat in dit tempo',
      message:
        'Nodig {{requiredAmount}} per maand, werkelijk ongeveer {{paceAmount}}. Verschuif de datum eerlijk of verschuif bewust meer geld.',
    },
    {
      title: 'Het doel en het tempo zijn het oneens',
      message:
        '“{{goal}}” vraagt {{requiredAmount}} per maand; het krijgt {{paceAmount}}. Een doel is zo echt als de maandelijkse stap ernaartoe.',
    },
    {
      title: '“{{goal}}” vraagt een stevigere stap',
      message:
        '{{paceAmount}} per maand tegenover de {{requiredAmount}} die nodig is. Betaal volgende maand eerst het doel, vóór alles wat optioneel is.',
    },
    {
      title: 'Achter op “{{goal}}”',
      message:
        'Het huidige tempo ({{paceAmount}}/maand) laat het {{monthsLate}} maanden te laat aankomen. In jouw macht ligt de volgende stap, niet de hele weg.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '“{{goal}}” past niet in het plan',
      message:
        'Het vraagt {{requiredAmount}} per maand, maar na je budgetten is er maar {{freeAmount}} vrij. Verander de datum, het doelbedrag of de budgetten — hopen is geen plan.',
    },
    {
      title: '“{{goal}}” vraagt meer dan je vrij hebt',
      message:
        '{{requiredAmount}} nodig per maand, {{freeAmount}} beschikbaar. Alles tegelijk willen is de manier om niets gedaan te krijgen; kies.',
    },
    {
      title: 'De cijfers zeggen nee — voorlopig',
      message:
        '“{{goal}}” vraagt {{requiredAmount}} per maand; je vrije ruimte is {{freeAmount}}. Pas aan wat in je macht ligt: de deadline of de andere grenzen.',
    },
    {
      title: '“{{goal}}” vraagt een beslissing',
      message:
        'Met {{requiredAmount}} per maand gaat het boven de {{freeAmount}} die na de budgetten overblijft. Een doel dat je met open ogen kiest, is beter dan een doel dat op wensdenken leeft.',
    },
    {
      title: 'Een onmogelijk tempo voor “{{goal}}”',
      message:
        'Nodig {{requiredAmount}} per maand, vrij {{freeAmount}}. Eerlijk rekenen nu bespaart later teleurstelling.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Je saldo zakt onder nul op {{date}}',
      message:
        'Als inkomen en uitgaven blijven zoals ze nu lopen, zakt het verwachte saldo naar {{lowestAmount}}. Bereid je nu voor, zolang het nog maar een prognose is.',
    },
    {
      title: 'Er komt een tekort aan: {{date}}',
      message:
        'Betalingen en dagelijkse uitgaven overtreffen wat er binnenkomt, met een dieptepunt van {{lowestAmount}}. Wie tegenspoed voorziet, ontneemt haar de macht.',
    },
    {
      title: 'Plan vooruit voor {{date}}',
      message:
        'Op die dag bereikt het verwachte saldo {{lowestAmount}}. Verschuif een betaling, stel een wens uit of zet geld opzij — elk daarvan ligt vandaag in je macht.',
    },
    {
      title: 'De prognose zakt onder nul',
      message:
        'Het saldo daalt rond {{date}} naar {{lowestAmount}}. Het kalme antwoord is het vroege.',
    },
    {
      title: 'Zie het gat op {{date}} aankomen',
      message:
        'Laagste verwachte saldo: {{lowestAmount}}. Wat voorzien is, kun je met kalmte tegemoet treden; wat ons verrast, zelden.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Je hield je woord aan jezelf',
      message:
        'Al {{months}} maanden op rij blijven je uitgaven binnen het plan dat je zelf hebt gemaakt. Zo ziet zelfbeheersing eruit.',
    },
    {
      title: '{{months}} maanden binnen het plan',
      message:
        'Maand na maand komen wat je van plan was en wat je deed overeen. Bestendigheid is stiller dan wilskracht en houdt het langer vol.',
    },
    {
      title: 'Plan en leven zijn het eens',
      message:
        '{{months}} maanden achter elkaar binnen je grenzen. Een plan dat zo goed wordt nageleefd, is geen beperking meer — het is hoe je leeft.',
    },
    {
      title: 'Al {{months}} maanden stabiel',
      message:
        'Je budgetten houden al {{months}} maanden stand. Houd dezelfde aandacht vast; het werkt.',
    },
    {
      title: 'Discipline, volgehouden',
      message:
        '{{months}} maanden zonder je plan te breken. Weinig dingen geven zoveel vrijheid als vertrouwen op je eigen beslissingen.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Je geld volgt je waarden',
      message:
        'Geld in dienst van de deugd was {{actual}}% van je uitgaven, niet minder dan de {{planned}}% die je plande. Goed besteed.',
    },
    {
      title: 'Deugd kreeg haar volle deel',
      message:
        '{{actual}}% aan gezondheid, leren en anderen, tegenover {{planned}}% gepland. Waar je waarde aan hecht, heb je voor betaald.',
    },
    {
      title: 'Besteed aan beter worden',
      message:
        'Gezondheid, leren en meer kregen {{actual}}% van de uitgaven van de maand (gepland {{planned}}%). Deugd kun je niet kopen, maar wel dienen.',
    },
    {
      title: 'Voornemen uitgevoerd',
      message:
        'Je plande {{planned}}% voor deugd en besteedde {{actual}}%. Goede voornemens overleven zelden een maand — de jouwe wel.',
    },
    {
      title: 'Het beste gebruik van geld',
      message: '{{actual}}% ging naar wat jou en anderen beter maakt. Blijf daarvoor kiezen.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Vrije tijd op zijn plaats',
      message:
        'Vrije tijd is {{actual}}% van de uitgaven, onder de {{planned}}% die je ervoor had. Je geniet van dingen zonder erdoor beheerst te worden.',
    },
    {
      title: 'Plezier, op maat gehouden',
      message:
        'Vrije tijd nam {{actual}}% tegenover {{planned}}% gepland. Matigheid is niets missen — het is kiezen.',
    },
    {
      title: 'Ontspanning zonder overdaad',
      message:
        '{{actual}}% aan vrije tijd, onder je grens van {{planned}}%. Genieten smaakt beter wanneer het niet de baas is.',
    },
    {
      title: 'Matigheid, in stilte',
      message:
        'Je gaf vrije tijd {{planned}}% en het gebruikte maar {{actual}}%. Die marge is vrijheid die je hebt behouden.',
    },
    {
      title: 'Vrije tijd onder plan',
      message:
        'Met {{actual}}% van de uitgaven bleef vrije tijd onder de {{planned}}% die je had vastgesteld. Goed volgehouden.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '{{percent}}% onder plan',
      message:
        'Je gaf {{savedAmount}} minder uit dan je jezelf voor de maand had toegestaan. Niet alles nodig hebben wat je zou kunnen hebben, is een soort rijkdom.',
    },
    {
      title: '{{savedAmount}} niet uitgegeven',
      message:
        'De maand eindigde {{percent}}% onder plan. Wat je niet uitgaf, kun je nog steeds zelf een richting geven.',
    },
    {
      title: 'Minder dan je toestond',
      message:
        'De uitgaven liggen {{percent}}% onder plan — {{savedAmount}} behouden. Geef die marge een doel voordat de gewoonte haar opeist.',
    },
    {
      title: 'Het plan had ruimte over',
      message:
        '{{savedAmount}} onder je grenzen voor de maand. Matiging die gemakkelijk voelt, is die welke blijft.',
    },
    {
      title: 'Lichter dan gepland',
      message:
        'Je had {{percent}}% minder nodig dan je had gebudgetteerd. Overweeg de {{savedAmount}} naar een doel te sturen.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '“{{goal}}” ligt op schema',
      message:
        'Je bent {{percent}}% op weg, in het tempo dat het doel nodig heeft. Gestage stappen, elke maand gezet, brengen je ver.',
    },
    {
      title: 'Op koers voor “{{goal}}”',
      message:
        '{{percent}}% gedaan en het tempo houdt stand. Blijf het doel eerst betalen; het werkt.',
    },
    {
      title: '“{{goal}}”: {{percent}}% en gestaag',
      message: 'Het doel krijgt elke maand wat het nodig heeft. Geduld doet zijn werk.',
    },
    {
      title: 'Het doel vordert zoals gepland',
      message:
        '“{{goal}}” is voor {{percent}}% gevuld en ligt op tijd. Wat je elke maand een beetje doet, laat zich niet tegenhouden door één slechte week.',
    },
    {
      title: 'Vooruitgang om op te vertrouwen',
      message:
        '“{{goal}}” staat op {{percent}}%, op schema. Je bouwt het op de enige manier die werkt — geleidelijk.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: 'Minder impulsaankopen bij {{merchant}}',
      message:
        'Van {{before}} aankopen in een maand naar ongeveer {{after}}. Een losgelaten gewoonte is gewonnen vrijheid.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'Je komt er minder dan vroeger. Elke overgeslagen reflex is een kleine overwinning van keuze op gewoonte.',
    },
    {
      title: 'De kleine gewoonte krimpt',
      message:
        'Aankopen bij {{merchant}} daalden van {{before}} naar ongeveer {{after}}. Ga zo door — het wordt makkelijker.',
    },
    {
      title: 'Keuze boven reflex',
      message:
        'Bij {{merchant}} ging je van {{before}} aankopen naar ongeveer {{after}}. Dat is beheersing, opgebouwd met één beslissing tegelijk.',
    },
    {
      title: 'Minder van het kleine spul',
      message:
        'Bij {{merchant}} ongeveer {{after}} keer in plaats van {{before}}. Kleine overwinningen stapelen zich op.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Je paste je aan een schralere maand aan',
      message:
        'Het inkomen daalde {{incomePercent}}%, en jij verlaagde de uitgaven met {{expensePercent}}%. Je beantwoordde een wending van het lot met een koerswijziging.',
    },
    {
      title: 'Kalmte toen het inkomen daalde',
      message:
        'Inkomen {{incomePercent}}% lager, uitgaven {{expensePercent}}% lager. Je paste je aan wat is, niet aan wat was.',
    },
    {
      title: 'Het lot veranderde; jij ook',
      message:
        'Een daling van het inkomen met {{incomePercent}}% ging samen met {{expensePercent}}% minder uitgaven. Dat is gelijkmoedigheid in cijfers.',
    },
    {
      title: 'Goed gestuurd',
      message:
        'Toen het inkomen {{incomePercent}}% daalde, volgden de uitgaven ({{expensePercent}}% minder). De wind was niet van jou; het zeil wel.',
    },
    {
      title: 'Uitgaven volgden het inkomen omlaag',
      message:
        'Je gaf {{expensePercent}}% minder uit terwijl het inkomen {{incomePercent}}% daalde. Vroeg bijsturen is de kalme weg erdoorheen.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'Noodzaak blijft stabiel',
      message:
        'Al {{months}} maanden zijn je noodzakelijke kosten nauwelijks veranderd. Een stabiele bodem geeft je vrijheid daarboven.',
    },
    {
      title: 'Behoeften in de hand',
      message:
        'Uitgaven aan noodzaak bleven {{months}} maanden gelijk. Behoeften die niet groeien, zijn behoeften die jij beheerst.',
    },
    {
      title: '{{months}} maanden stabiele basis',
      message:
        'Huur, eten en rekeningen bleven waar ze waren. Stille stabiliteit is ook een prestatie.',
    },
    {
      title: 'Geen sluipende groei in noodzaak',
      message:
        '{{months}} maanden zonder verschuiving in wat het leven vraagt. Op die grond is al het andere makkelijker te plannen.',
    },
    {
      title: 'Een stevige bodem',
      message:
        'De noodzakelijke uitgaven zijn al {{months}} maanden stabiel. Je laat gemakken niet doorgaan voor behoeften.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Vrijgevig met wat je verdient',
      message:
        'In {{months}} maanden ging {{percent}}% van je inkomen — {{givenAmount}} — naar het helpen van anderen. Beter kan geld nauwelijks besteed worden.',
    },
    {
      title: '{{givenAmount}} gegeven aan anderen',
      message:
        'Je deelde {{percent}}% van je inkomen in {{months}} maanden. Vriendelijkheid die in de cijfers zichtbaar is, is beoefende vriendelijkheid, niet alleen gevoelde.',
    },
    {
      title: 'Open handen',
      message:
        'Giften en cadeaus namen de laatste tijd {{percent}}% van je inkomen in beslag. Wat je weggeeft, is het deel van je rijkdom dat geen tegenslag kan afnemen.',
    },
    {
      title: 'Vrijgevigheid hoort bij je plan',
      message:
        '{{givenAmount}} aan anderen in {{months}} maanden. Houd dat vast — het goede dat je anderen doet, doe je ook jezelf.',
    },
    {
      title: 'Goed gegeven',
      message:
        '{{percent}}% van wat je verdiende ging naar het helpen van anderen. Weinig gewoonten zeggen meer over een mens.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Niets te corrigeren',
      message: 'Je uitgaven komen overeen met wat je van plan was. Ga zo door.',
    },
    {
      title: 'Voornemen en daad zijn het eens',
      message: 'De maand ziet eruit zoals je haar plande. Die overeenstemming is het hele punt.',
    },
    {
      title: 'Een kalme maand',
      message:
        'Geen overdaad, geen verwaarlozing die het noemen waard is. Goed gedaan — neem dezelfde aandacht mee.',
    },
    {
      title: 'Alles in orde',
      message:
        'Je plan hield stand en niets vraagt om correctie. Geniet van de rust die je hebt verdiend.',
    },
    {
      title: 'Vaste hand',
      message: 'De maand volgde je plan. Goede gewoonten laten goede maanden gewoon lijken.',
    },
  ],
  'stoic.keep_first': [
    {
      title: 'Houd eerst je deel achter',
      message:
        'In {{months}} maanden hield je {{savingsPercent}}% van je inkomen over. Seneca waarschuwt: het is te laat om zuinig te zijn bij de droesem van het vat. Zet {{tenthAmount}} opzij op de dag dat je inkomen binnenkomt.',
    },
    {
      title: 'Spaar vanaf de bovenkant van het vat',
      message:
        'Slechts {{savingsPercent}}% van je inkomen bleef bij je. Zuinigheid die wacht op wat er overblijft, komt te laat; {{tenthAmount}} per maand, eerst opzijgezet, begint nu.',
    },
    {
      title: 'Wat van jou is, bewaar het',
      message:
        'Seneca raadt aan te bewaren wat werkelijk van jou is en vroeg te beginnen. Onlangs bleef {{savingsPercent}}% van je inkomen bij je; begin met {{tenthAmount}} op de dag dat je betaald wordt en laat je uitgaven zich naar de rest schikken.',
    },
    {
      title: 'Begin vóór de droesem',
      message:
        'Je hield {{savingsPercent}}% over in {{months}} maanden. Sparen staat alleen in jouw macht zolang er nog iets te sparen valt: zet {{tenthAmount}} opzij vóór al het andere.',
    },
    {
      title: '{{savingsPercent}}% bewaard, en het vat loopt leeg',
      message:
        '{{tenthAmount}} per maand, een tiende van je inkomen, opzijgezet vóór elke rekening. Wat je als eerste bewaart, hangt niet af van wat de maand overlaat.',
    },
  ],
  'stoic.prepare_beforehand': [
    {
      title: 'Bereid je voor zolang het rustig is',
      message:
        'Je reserve dekt ongeveer {{cushionDays}} dagen aan uitgaven. Seneca: de ziel moet zich harden in tijden zonder zorgen. Drie maanden aan uitgaven is {{targetAmount}}.',
    },
    {
      title: 'Een reserve van {{cushionDays}} dagen',
      message:
        'Het lot kondigt zich niet aan. Bouw toe naar {{targetAmount}}, drie maanden aan uitgaven, zolang niets dringt: dan is het gemakkelijk.',
    },
    {
      title: '“Is dit de toestand waarvoor ik bang was?”',
      message:
        'Seneca liet Lucilius de armoede oefenen, zodat ze haar schrik zou verliezen. Met {{cushionDays}} dagen reserve zou één zware maand geen oefening zijn. Streef naar {{targetAmount}}.',
    },
    {
      title: 'Voorzie de zware maand',
      message:
        'Je spaargeld zou ongeveer {{cushionDays}} dagen meegaan. Wat voorzien is, komt zachter aan; {{targetAmount}} zou je drie maanden dragen.',
    },
    {
      title: 'Bouw de muur vóór de storm',
      message:
        'Ongeveer {{cushionDays}} dagen zijn gedekt. Het verlies van inkomen staat niet in jouw macht, de reserve wel. Drie maanden aan uitgaven komt neer op {{targetAmount}}.',
    },
  ],
  'stoic.wants_outrun_income': [
    {
      title: 'De wensen rennen het inkomen voorbij',
      message:
        'De uitgaven stegen het afgelopen kwartaal met {{expenseGrowth}}%, terwijl het inkomen {{incomeGrowth}}% veranderde. Niet wie te weinig heeft, schrijft Seneca, maar wie meer begeert, is arm.',
    },
    {
      title: 'Hoger leven, niet beter',
      message:
        'De uitgaven groeiden met {{expenseGrowth}}%, het inkomen met {{incomeGrowth}}%. De behoeften van de natuur zijn gering; de eisen van de opinie zijn grenzeloos. Vraag je af welke van de twee de stijging dient.',
    },
    {
      title: 'De wensen zijn gegroeid: +{{expenseGrowth}}%',
      message:
        'De uitgaven stegen sneller dan het inkomen ({{incomeGrowth}}%). Een nieuw gemak voelt snel als een behoefte: merk het op zolang je het nog kunt weigeren.',
    },
    {
      title: 'De lat ligt steeds hoger',
      message:
        'De uitgaven zijn {{expenseGrowth}}% hoger dan het kwartaal ervoor, het inkomen {{incomeGrowth}}%. Genoeg blijft alleen genoeg als jij bepaalt wat het is.',
    },
    {
      title: 'Meer is niet het geneesmiddel',
      message:
        'Het afgelopen kwartaal groeiden de uitgaven met {{expenseGrowth}}% en het inkomen met {{incomeGrowth}}%. Rijkdom die meegroeit met het verlangen komt nooit aan; stel de grens vast voordat dit de nieuwe gewoonte wordt.',
    },
  ],
  'stoic.price_in_life': [
    {
      title: '{{merchant}} kostte {{hours}} uur van je leven',
      message:
        'Seneca herinnert ons eraan dat alleen onze tijd werkelijk van ons is. {{totalAmount}} bij {{merchant}} is ongeveer {{hours}} uur van je werk. Was het dat waard?',
    },
    {
      title: '{{hours}} uur bij {{merchant}}',
      message:
        'We bewaken ons geld en geven onze tijd weg. Tegen je gemiddelde uurloon is {{totalAmount}} daar ongeveer {{hours}} werkuren.',
    },
    {
      title: 'Reken het uit in uren',
      message:
        '{{totalAmount}} bij {{merchant}} is ongeveer {{hours}} uur werk. Uren zijn het enige wat je niet kunt terugverdienen.',
    },
    {
      title: 'Wat {{merchant}} werkelijk kostte',
      message:
        'Je ruilt je dagen voor geld, en geld voor dingen. {{merchant}} nam ongeveer {{hours}} uur van je ({{totalAmount}}). Weegt het plezier op tegen die uren?',
    },
    {
      title: 'Weeg de uren',
      message:
        'Omgerekend tegen je gemiddelde uurloon is {{totalAmount}} bij {{merchant}} ongeveer {{hours}} uur. We verliezen een groot deel van onze tijd, schrijft Seneca. Heb je dit gekozen?',
    },
  ],
  'stoic.rule_broken': [
    {
      title: 'De regel “{{rule}}” is de weg kwijt',
      message:
        'Hij wijst naar iets wat niet meer bestaat en werkt daarom stilletjes niet meer. Herstel hem of verwijder hem: orde die niets doet, lijkt alleen maar op orde.',
    },
    {
      title: '“{{rule}}” werkt niet meer',
      message:
        'Zijn categorie, rekening of begunstigde is verdwenen, en de regel wordt nu bij elke transactie overgeslagen. Zie de dingen zoals ze zijn, en herstel ze dan.',
    },
    {
      title: 'Een regel zonder doel',
      message:
        '“{{rule}}” stuurt transacties naar een plek die is verwijderd. Je hebt ooit iets besloten; besluit opnieuw, nu de dingen veranderd zijn.',
    },
    {
      title: '“{{rule}}” heeft je oordeel nodig',
      message:
        'Waar hij naar verwijst is verwijderd, en de transacties die hij vroeger indeelde wachten nu op jou. Geef hem een nieuw doel of laat hem los.',
    },
    {
      title: 'Een kapotte regel, in stilte',
      message:
        '“{{rule}}” doet niets en zegt er niets over. Herstel wat in jouw macht ligt: het kost een minuut.',
    },
  ],
  'stoic.rule_contradicted': [
    {
      title: 'Je hand spreekt “{{rule}}” tegen',
      message:
        '{{count}} keer deelde je met de hand anders in dan deze regel doet. Of de regel heeft ongelijk, of de hand: beslis welke.',
    },
    {
      title: '“{{rule}}” werd {{count}} keer overruled',
      message:
        'Een regel die je steeds corrigeert, is geen besluit meer, alleen een gewoonte om met jezelf te redetwisten. Pas hem aan of vertrouw hem.',
    },
    {
      title: 'Zeg wat je doet, doe wat je zei',
      message:
        'De regel “{{rule}}” zegt het ene; je laatste {{count}} correcties zeggen het andere. Breng beide met elkaar in overeenstemming.',
    },
    {
      title: 'Een betwist besluit',
      message:
        'Je stelde “{{rule}}” op met een heldere kop, en sindsdien zijn {{count}} transacties een andere kant op gegaan. Kijk rustig nog eens wie van jullie tweeën gelijk had.',
    },
    {
      title: '{{count}} correcties tegen “{{rule}}”',
      message:
        'Herhaling is informatie. Laat haar de regel veranderen, of laat de regel de gewoonte veranderen.',
    },
  ],
  'stoic.rule_worth_writing': [
    {
      title: 'Besluit één keer over {{payee}}',
      message:
        'Je hebt {{payee}} {{decided}} keer met de hand ingedeeld, steeds op dezelfde manier. Wat je steeds opnieuw beslist, beslis het één keer, met een heldere kop.',
    },
    {
      title: 'Een besluit dat {{decided}} keer is genomen',
      message:
        '{{payee}} stelt steeds dezelfde vraag en jij geeft steeds hetzelfde antwoord. Een regel bewaart je aandacht voor wat die echt nodig heeft.',
    },
    {
      title: 'Begunstigden die een regel verdienen: {{count}}',
      message:
        'Dezelfde begunstigden krijgen van jou steeds dezelfde categorie, {{payee}} voorop. Bewaar je oordeel voor wat nieuw is.',
    },
    {
      title: 'Je gewoonte is rijp voor een principe',
      message:
        'Je deelt {{payee}} elke keer hetzelfde in (tot nu toe {{decided}} keer). Schrijf het op als regel en het blijft zonder moeite staan.',
    },
    {
      title: 'Laat een regel dit dragen',
      message:
        'Begunstigden die je steeds hetzelfde indeelt: {{count}}, waaronder {{payee}} met {{decided}} transacties. Een principe dat eenmaal vaststaat, hoeft niet steeds opnieuw bepleit te worden.',
    },
  ],
  'stoic.rule_idle': [
    {
      title: '“{{rule}}” heeft {{months}} maanden niets ontmoet',
      message:
        'Of de wereld waarvoor hij gemaakt is, is verdwenen, of zijn voorwaarden missen het doel. Houd je regels waar: herstel hem of verwijder hem.',
    },
    {
      title: 'Een rustende regel: “{{rule}}”',
      message:
        'Hij heeft al {{months}} maanden geen transactie aangeraakt. Werp het overbodige weg; wat overblijft, is gemakkelijker te vertrouwen.',
    },
    {
      title: '“{{rule}}” staat stil',
      message:
        '{{months}} maanden zonder treffer, terwijl er steeds nieuwe transacties binnenkomen. Probeer hem uit op je recente transacties en besluit dan.',
    },
    {
      title: 'Is “{{rule}}” nog nodig?',
      message:
        'Al {{months}} maanden past er niets op. Een regel die je uit gewoonte houdt, is weer iets extra om voor te zorgen.',
    },
    {
      title: 'Een besluit zonder iets te besluiten',
      message:
        '“{{rule}}” zwijgt al {{months}} maanden. Orde betekent hebben wat je nodig hebt, en alleen dat.',
    },
  ],
  'stoic.praise_rules_hold': [
    {
      title: 'Je besluiten houden stand',
      message:
        'Regels deelden {{percent}}% van de transacties van de maand in, en je hoefde er geen te overrulen. Een besluit dat je eenmaal neemt en houdt, maakt de geest vrij.',
    },
    {
      title: '{{percent}}% vooraf geregeld',
      message:
        'De meeste transacties van de maand werden ingedeeld volgens wat je eerder besloot. Dat is aandacht die overblijft voor wat ertoe doet.',
    },
    {
      title: 'Principes aan het werk',
      message:
        'Je regels handelden {{percent}}% van de transacties af zonder geschil. Vaststaande principes maken rustige dagen.',
    },
    {
      title: 'Minder te beslissen',
      message:
        '{{percent}}% van de transacties vroeg geen nieuw besluit. Je oordeelde één keer, goed, en dat oordeel staat nog.',
    },
    {
      title: 'Orde bewaard',
      message:
        'Regels deelden {{percent}}% van de maand in, en geen enkele werd tegengesproken. Goede orde ziet eruit alsof er niets gebeurt.',
    },
  ],
  'stoic.goal_no_date': [
    {
      title: '“{{goal}}” heeft geen datum',
      message:
        'Het staat op {{percent}}% en er gaat niets in. Wie niet weet welke haven hij aandoet, voor hem is geen wind de goede: noem de dag waarop je wilt aankomen.',
    },
    {
      title: 'Een wens of een doel?',
      message:
        '“{{goal}}” heeft geen deadline en geen tempo. Een doel is een besluit met een datum; geef het er een of laat het los.',
    },
    {
      title: 'Noem de dag voor “{{goal}}”',
      message:
        'Het is voor {{percent}}% bereikt en beweegt niet. Wat op elk moment kan, gebeurt zelden.',
    },
    {
      title: '“{{goal}}” wacht op “ooit”',
      message:
        'De laatste tijd is er niets in gegaan en geen datum vraagt iets. Ooit staat in geen enkele agenda; kies een dag die er wel in staat.',
    },
    {
      title: '“{{goal}}” heeft geen haven',
      message:
        'Op {{percent}}%, zonder deadline. Weet waarheen je vaart, dan volgt de maandelijkse stap vanzelf.',
    },
  ],
};
