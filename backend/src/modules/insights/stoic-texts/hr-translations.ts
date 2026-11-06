import type { StoicTextMap } from './types';

export const hr: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'Mjesec je prerastao svoj plan',
      message:
        'Planirali ste {{plannedAmount}} a potrošili {{spentAmount}} — {{percent}} % više. Plan je nastao hladne glave; pustite ga da govori glasnije od trenutka.',
    },
    {
      title: '{{percent}} % iznad onoga što ste namjeravali potrošiti',
      message:
        'Troškovi stoje na {{spentAmount}} prema planu od {{plannedAmount}}. Pogledajte koje je ograničenje prvo popustilo — tu je nauk.',
    },
    {
      title: 'Vaš plan i vaš mjesec se ne slažu',
      message:
        '{{spentAmount}} potrošeno, {{plannedAmount}} namjeravano. Ili je plan od stvarnosti tražio previše malo, ili je stvarnost od vas previše — mirno odlučite što od toga.',
    },
    {
      title: 'Izašlo je više nego ste dopustili',
      message:
        'Mjesec je {{percent}} % iznad {{plannedAmount}} koje ste postavili. Ako sada stanete, ništa nije izgubljeno; ako se pravite da se nije dogodilo, izgubljeno je mnogo.',
    },
    {
      title: 'Granica koju ste postavili, granica koju ste prešli',
      message:
        'Namjeravali ste potrošiti {{plannedAmount}}; iznos je {{spentAmount}}. Samokontrola nije nikad se ne spotaknuti — to je primijetiti rano i vratiti se na put.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Slobodno vrijeme uzima više nego ste planirali',
      message:
        'Htjeli ste da slobodno vrijeme bude {{planned}} % potrošnje; dosegnulo je {{actual}} %. Užitak je dobrodošao kao gost, ne kao gospodar kuće.',
    },
    {
      title: 'Slobodno vrijeme na {{actual}} %, planirano {{planned}} %',
      message:
        'Odmor zaslužuje svoje mjesto kad vas obnovi. Pitajte se koji su užici mjeseca to učinili, a ostale pustite bez žaljenja.',
    },
    {
      title: 'Udobnost troši više od namjere',
      message:
        'Slobodno vrijeme drži {{actual}} % troškova prema {{planned}} % koje ste odabrali. Umjerenost nije odbijanje užitka — to je držanje njegove odabrane mjere.',
    },
    {
      title: 'Prijatno istiskuje planirano',
      message:
        'Slobodnom ste vremenu dali {{planned}} % plana, a ono je uzelo {{actual}} %. Ono što uživate bez truda vrijedi drugog pogleda prije nego postane ono što vam treba.',
    },
    {
      title: 'Slobodno vrijeme prešlo je svoju crtu',
      message:
        '{{actual}} % mjeseca otišlo je na slobodno vrijeme, {{planned}} % bila je namjera. Crta je bila vaša da je nacrtate i vaša je da je držite.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Slobodno vrijeme opet nad planom',
      message:
        'Slobodno vrijeme prešlo je vaš plan u {{months}} od posljednjih {{window}} mjeseci. Ponavljanje više nije nezgoda — to je navika koju vrijedi pregledati.',
    },
    {
      title: '{{months}} od {{window}} mjeseci nad planom slobodnog vremena',
      message:
        'Ono što se dogodi jednom su okolnosti; ono što se dogodi {{months}} puta jest karakter u nastajanju. Odaberite karakter namjerno.',
    },
    {
      title: 'Isti posrtaj, mjesec za mjesecom',
      message:
        'Slobodno vrijeme prešlo je plan u {{months}} od {{window}} mjeseci. Podignite plan iskreno ili promijenite naviku — živjeti između toga najviše košta.',
    },
    {
      title: 'Uzorak, ne izuzetak',
      message:
        'U {{months}} od posljednjih {{window}} mjeseci slobodno je vrijeme uzelo više nego ste mu dali. Primijetite trenutak kad se odluka donosi, ne samo račun poslije.',
    },
    {
      title: 'Navika glasuje protiv vašeg plana',
      message:
        'Slobodno je vrijeme pobijedilo plan {{months}} puta u {{window}} mjeseci. Navike se grade po jednom izboru; isto se i razgrađuju.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'Krepost dobiva manje nego ste namjeravali',
      message:
        'Odvojili ste {{planned}} % proračuna za zdravlje, učenje i druge; dosegnulo je {{actual}} %. Namjera se računa kad je izvedena.',
    },
    {
      title: 'Krepost na {{actual}} % od planiranih {{planned}} %',
      message:
        'Novac namijenjen onome što vas čini boljima još čeka. Nema boljeg trenutka da ga dobro potrošite nego sada.',
    },
    {
      title: 'Dobro koje ste planirali je nepotrošeno',
      message:
        'Zdravlje, učenje i darežljivost trebali su dobiti {{planned}} % troškova; dobili su {{actual}} %. Učinite jedno od toga ovaj tjedan, namjerno.',
    },
    {
      title: 'Namjera bez djela',
      message:
        'Krepost drži {{actual}} % troškova prema {{planned}} % koje ste odabrali. Ono što cijenimo pokazuje se u onome za što zaista plaćamo.',
    },
    {
      title: 'Ostalo je mjesta za ono što je važno',
      message:
        'Na krepost je otišlo samo {{actual}} %, iako ste planirali {{planned}} %. Knjiga, pregled kod liječnika, dar nekome u potrebi — plan je već rekao da.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'Krepost se stalno odgađa',
      message:
        'Troškovi za zdravlje, učenje i druge ostaju pod vašim planom već {{months}} mjeseci u nizu. Ono što stalno odgađate, u stvarnosti ste odbili.',
    },
    {
      title: '{{months}} mjeseci odgođene kreposti',
      message:
        'Svaki je mjesec plan ostavio mjesta za ono što vas čini boljim i svaki je mjesec ostalo neiskorišteno. Vrijeme je ono jedino što se ne može planirati dvaput.',
    },
    {
      title: 'Bolje ja još čeka',
      message:
        'Krepost je pod planom {{months}} mjeseci zaredom. Počnite malo i sigurno, a ne veliko i kasnije.',
    },
    {
      title: 'Dobre namjere stare',
      message:
        '{{months}} mjeseci su zdravlje, učenje i darežljivost dobivali manje nego ste planirali. Odaberite jedno i idući mjesec ga platite prvo, prije svega drugog.',
    },
    {
      title: 'Krepost stalno gubi od „kasnije“',
      message:
        '{{months}} mjeseci zaredom pod planom. Kasnije je mjesto kamo dobre namjere odlaze da budu zaboravljene — ovoj dajte datum.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'Vaš plan nema mjesta za krepost',
      message:
        'Nijedan od vaših proračuna ne služi zdravlju, učenju ni drugima. Plan pokazuje što cijenimo — razmislite da kreposti date vlastiti red.',
    },
    {
      title: 'Svi proračuni, ali nijedan za dobro',
      message:
        'Nužnost, rad i slobodno vrijeme imaju granice; krepost nema nijednu. Ono što se nikad ne planira obično se nikad i ne dogodi.',
    },
    {
      title: 'Planirajte ono što vas čini boljim',
      message:
        'U razredu kreposti još nema nijednog proračuna. I mali — knjige, sport, donacija — želju pretvara u obvezu.',
    },
    {
      title: 'Plan o kreposti ne govori',
      message:
        'Planirate za ono što morate i za ono što uživate, još ne za onoga kim želite postati. Jedan skroman proračun za krepost to bi promijenio.',
    },
    {
      title: 'Krepost nema proračun',
      message:
        'Trošenje na zdravlje, učenje ili druge nije planirano nigdje. Odaberite jedno i dajte mu granicu koju biste rado dosegnuli.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'Nužnosti koštaju više nego je planirano',
      message:
        'Planirali ste {{planned}} % troškova za nužnosti; uzimaju {{actual}} %. Provjerite je li svaka još potreba ili je tiho postala udobnost.',
    },
    {
      title: 'Nužnost na {{actual}} %, planirano {{planned}} %',
      message:
        'Ono što život zahtijeva obično je manje od onoga na što se naviknemo. Pregledajte najveću nužnost svježim okom.',
    },
    {
      title: 'Nužno se naduva',
      message:
        'Nužnosti drže {{actual}} % mjeseca prema {{planned}} % koje ste očekivali. Potreba koja nastavlja rasti zaslužuje pitanje.',
    },
    {
      title: 'Potrebe prerastaju plan',
      message:
        'Planirano {{planned}} %, stvarno {{actual}} %. Ili je plan podcijenio prave troškove, ili neke želje putuju pod imenom potreba.',
    },
    {
      title: 'Na „moram“ je otišlo više nego je mišljeno',
      message:
        'Nužnosti su uzele {{actual}} % troškova umjesto {{planned}} %. Odvojite ono što zaista mora biti od onoga što je samo uvijek bilo.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'Nužnosti se penju',
      message:
        'Troškovi za nužnosti rastu {{months}} mjeseci u nizu, ukupno {{percent}} %. Potrebe tiho rastu kad ih nitko ne traži da se opravdaju.',
    },
    {
      title: '+{{percent}} % na nužnostima u {{months}} mjeseci',
      message:
        'Svaki je korak izgledao mali; zajedno nisu. Uzmite najveću ponavljajuću nužnost i pitajte mora li još koštati toliko.',
    },
    {
      title: 'Pod vaših troškova se diže',
      message:
        'Nužnosti su rasle {{months}} mjeseci zaredom (+{{percent}} %). Rastući pod ostavlja manje mjesta za sve što slobodno odaberete.',
    },
    {
      title: 'Potrebe se šire',
      message:
        '{{months}} mjeseci rasta, ukupno {{percent}} %. Stoička je proba jednostavna: biste li to danas odabrali ponovno, znajući cijenu?',
    },
    {
      title: 'Mali rastovi, stalan smjer',
      message:
        'Nužnosti su u {{months}} mjeseci više za {{percent}} %. Smjer znači više od pojedinog mjeseca — ovaj vrijedi ispraviti rano.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'Rad košta više nego je planirano',
      message:
        'Planirali ste {{planned}} % troškova za rad; uzima {{actual}} %. Alati i usluge moraju zaslužiti svoje mjesto — provjerite koji ga zaslužuju.',
    },
    {
      title: 'Troškovi rada na {{actual}} %, planirano {{planned}} %',
      message:
        'Ulaganje u rad dobro je kad nešto vraća. Pregledajte za što plaćate, a više ne koristite.',
    },
    {
      title: 'Proračun za rad je napet',
      message:
        'Rad je uzeo {{actual}} % umjesto {{planned}} %. Radišnost je raditi dobro, ne kupiti svaki alat za to.',
    },
    {
      title: 'Alati troše nad planom',
      message:
        'Planirano {{planned}} %, potrošeno {{actual}} % na rad. Za svaki trošak pitajte: pomaže li mi raditi, ili samo izgleda kao napredak?',
    },
    {
      title: 'Troškovi rada su se pomaknuli',
      message:
        'Rad drži {{actual}} % troškova prema namjeravanih {{planned}} %. Brz pregled sada štedi veći kasnije.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '„{{category}}“ stalno lomi svoju granicu',
      message:
        '„{{category}}“ je prešla proračun u {{months}} od posljednjih {{window}} mjeseci. Ili je granica pogrešna, ili je želja — odlučite što od toga.',
    },
    {
      title: '„{{category}}“: nad proračunom {{months}} od {{window}} mjeseci',
      message:
        'Granica koja se uvijek prelazi nije granica, samo želja. Učinite je iskrenom — podignite je namjerno ili je namjerno držite.',
    },
    {
      title: 'Isti proračun opet popušta',
      message:
        '„{{category}}“ je prešla svoju granicu {{months}} puta u {{window}} mjeseci. Ponavljanje je informacija; iskoristite je.',
    },
    {
      title: '„{{category}}“ traži vašu pozornost',
      message:
        'Nad proračunom u {{months}} od {{window}} mjeseci. Gledajte trenutak prije kupnje — to je jedino mjesto gdje se navika može promijeniti.',
    },
    {
      title: 'Uzorak u „{{category}}“',
      message:
        '{{months}} prekoračenja u {{window}} mjeseci. Ono što ponavljamo, to postajemo; odlučite što želite da ova kategorija govori o vama.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '„{{category}}“ se iscrpi oko dana {{day}}',
      message:
        'Potrošili ste {{spentAmount}} od {{limitAmount}} i ovim tempom granica se završava oko dana {{day}}. Usporiti sada lakše je od zaustavljanja kasnije.',
    },
    {
      title: '„{{category}}“ je ispred mjeseca',
      message:
        '{{spentAmount}} je već otišlo od granice {{limitAmount}}. Ovim će tempom biti iscrpljena oko dana {{day}} — ostatak mjeseca ipak je vaš.',
    },
    {
      title: 'Provjera tempa: „{{category}}“',
      message:
        'Proračun od {{limitAmount}} pri sadašnjem tempu traje do oko dana {{day}}. Predviđanje je najjeftinija vrsta discipline.',
    },
    {
      title: '„{{category}}“ troši budućnost',
      message:
        '{{spentAmount}} od {{limitAmount}} potrošeno; granica se završava blizu dana {{day}}. Što učinite ovaj tjedan, odlučuje hoće li se to dogoditi.',
    },
    {
      title: 'Rano upozorenje za „{{category}}“',
      message:
        'Pri sadašnjem tempu granica od {{limitAmount}} neće dosegnuti kraj mjeseca — iscrpi se oko dana {{day}}. Prilagodite dok je jeftino.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '„{{category}}“ je ostala neiskorištena',
      message:
        'Proračun za „{{category}}“ nije zabilježio trošenje već {{months}} mjeseci. Ili ste ga prerasli, ili je namjera koja još čeka — odlučite što od toga.',
    },
    {
      title: 'Prazan proračun: „{{category}}“',
      message:
        '{{months}} mjeseci bez jednog jedinog troška. Plan treba opisivati život koji živite ili onaj koji gradite — koji je ovo?',
    },
    {
      title: '„{{category}}“ stoji neiskorištena',
      message:
        'Tu nije potrošeno ništa {{months}} mjeseci. Ako je to bila suzdržanost, bravo; ako nemar, učinite nešto.',
    },
    {
      title: 'Planirano, ali neproživljeno',
      message:
        '„{{category}}“ ima granicu i nikakvo trošenje već {{months}} mjeseci. Zadržite plan istinitim: uklonite je ili je iskoristite.',
    },
    {
      title: '„{{category}}“: {{months}} tihih mjeseci',
      message:
        'Proračun koji se nikad ne dotiče još zauzima mjesto u vašem planu. Oslobodite mjesto ili namjeru ispunite.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}} % troškova nema granicu',
      message:
        '{{unbudgetedAmount}} mjeseca otišlo je u kategorije koje ne prati nijedan proračun. Što niste promotrili, ne možete prosuditi.',
    },
    {
      title: 'Velik dio mjeseca je neplaniran',
      message:
        '{{percent}} % troškova — {{unbudgetedAmount}} — leži izvan svih proračuna. Dajte najvećem dijelu granicu i plan će vidjeti više vašeg života.',
    },
    {
      title: 'Trošenje izvan plana',
      message:
        'Proračuni pokrivaju samo dio onoga što trošite; {{unbudgetedAmount}} ({{percent}} %) ostaje neizmjereno. Proširite plan tamo kamo novac zaista ide.',
    },
    {
      title: 'Plan vidi samo dio slike',
      message:
        '{{percent}} % potrošnje mjeseca nema proračun. Bistar pogled prethodi dobroj prosudbi.',
    },
    {
      title: '{{unbudgetedAmount}} potrošeno bez granice',
      message:
        'To je {{percent}} % mjeseca. Ne morate to ograničiti — samo odlučiti koliko toga zaista želite.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '„{{category}}“ je većina vašeg slobodnog vremena',
      message:
        '{{percent}} % potrošnje na slobodno vrijeme otišlo je na „{{category}}“. Uživajte u tome, ali provjerite biste li se mogli odreći.',
    },
    {
      title: 'Jedan užitak prevladava',
      message:
        '„{{category}}“ uzima {{percent}} % svega što ste potrošili na slobodno vrijeme. Pitajte se veseli li vas još ili je postala rutina.',
    },
    {
      title: 'Slobodno se vrijeme naslanja na „{{category}}“',
      message:
        '{{percent}} % slobodnog vremena na jednom mjestu. Ono bez čega ne možemo drži nas — provjerite je li hvat još lagan.',
    },
    {
      title: '„{{category}}“: {{percent}} % slobodnog vremena',
      message:
        'Jedan izvor užitka troši gotovo sve. Neko vrijeme budite bez njega i vidite što vam zaista daje.',
    },
    {
      title: 'Vaš odmor ima jednu adresu',
      message:
        'Većina novca za slobodno vrijeme, {{percent}} %, ide na „{{category}}“. Slobodni ste od užitka samo ako biste mogli bez njega.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Dio troškova još nije ocijenjen',
      message:
        '{{count}} kategorija nema razred. U Proračunima odlučite što je nužnost, rad, krepost ili slobodno vrijeme.',
    },
    {
      title: '{{count}} kategorija čeka vašu ocjenu',
      message:
        'Imaju troškove ali nikakav razred, pa ih savjeti ne mogu vagati. Minuta u Proračunima to rješava.',
    },
    {
      title: 'Nazovite ono čemu vaš novac služi',
      message:
        '{{count}} kategorija još je nerazvrstano. Prosudba počinje time da stvari zovemo pravim imenima.',
    },
    {
      title: 'Neocijenjeni troškovi: {{count}} kategorija',
      message:
        'Je li to potreba, vaš rad, krepost ili užitak? Reći možete samo vi — i plan se time razbistri.',
    },
    {
      title: 'Nekoliko kategorija nema razred',
      message:
        '{{count}} kategorija stoji izvan četiri razreda. Razvrstajte ih u Proračunima da svaki trošak bude viđen onim što je.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: '{{count}} malih kupnji kod {{merchant}}',
      message:
        'Svaka je izgledala nevažno; zajedno su tijekom mjeseca iznosile {{totalAmount}}. Male, nepregledane navike mjesto su kamo tiho odlazi većina novca.',
    },
    {
      title: '{{merchant}}: {{count}} puta u mjesecu',
      message:
        '{{totalAmount}} u malim iznosima. Pitajte je li svaki posjet bio izbor ili refleks: samo je prvo sloboda.',
    },
    {
      title: 'Pomalo: {{totalAmount}}',
      message:
        '{{count}} kupnji kod {{merchant}}. Nijedna pojedinačno nije važna; navika jest. Odlučite koliko često to zaista želite.',
    },
    {
      title: 'Navika kod {{merchant}}',
      message:
        '{{count}} kupnji, ukupno {{totalAmount}}. Pokušajte preskočiti svaku treću i vidite hoće li vam nedostajati.',
    },
    {
      title: 'Male se stvari zbrajaju',
      message:
        '{{merchant}} vas je vidio {{count}} puta, za {{totalAmount}}. Vladanje velikim odlukama gradi se na takvim malima.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Vikendi nose {{percent}} % slobodnog vremena',
      message:
        'Većina vaših troškova za slobodno vrijeme pada u subotu i nedjelju. Odmor je dobar; provjerite je li odmor, a ne nadoknada za tjedan.',
    },
    {
      title: 'Slobodno vrijeme živi na vikendu',
      message:
        '{{percent}} % troškova za slobodno vrijeme pada na vikend. Planirajte vikend malo i koštat će manje te dati više.',
    },
    {
      title: 'Vikend plaća za tjedan',
      message:
        'Vikendi uzimaju {{percent}} % onoga što trošite na slobodno vrijeme. Ako tjedan treba popravljati svake subote, pogledajte tjedan.',
    },
    {
      title: 'Subota i nedjelja: {{percent}} % slobodnog vremena',
      message:
        'Slobodni dani zovu na slobodno trošenje. Odlučite prije vikenda čemu je namijenjen i pustite novac da slijedi.',
    },
    {
      title: 'Vikend uzorak',
      message:
        '{{percent}} % troškova za slobodno vrijeme događa se na vikendu. Lakši radni dani često čine vikende jeftinijima.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} je uzeo {{percent}} % mjeseca',
      message:
        '{{totalAmount}} je otišlo jednom trgovcu za slobodno vrijeme. Kad jedno mjesto ima toliko vašeg novca, pitajte koliko ima i vaše pozornosti.',
    },
    {
      title: 'Jedno mjesto, {{totalAmount}}',
      message:
        '{{merchant}} je {{percent}} % potrošnje mjeseca. Vrijedi li tog dijela rada vašeg života?',
    },
    {
      title: '{{merchant}} vodi vaše troškove',
      message:
        '{{percent}} % mjeseca — {{totalAmount}} — otišlo je tamo. Ništa nije pogrešno u uživanju, dok biste to odabrali ponovno.',
    },
    {
      title: 'Velik dio kod {{merchant}}',
      message:
        '{{totalAmount}}, odnosno {{percent}} % troškova, na jednom mjestu slobodnog vremena. Mirno odvagnite užitak prema cijeni.',
    },
    {
      title: '{{percent}} % kod {{merchant}}',
      message:
        'Taj je jedan trgovac uzeo {{totalAmount}}. Sloboda je moći proći pokraj kad tako odlučite.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Prihod je pao, troškovi nisu',
      message:
        'Prihod je pao {{percent}} % na {{incomeAmount}}, ali su troškovi ostali na {{expenseAmount}}. Sreća se predomislila; vaši troškovi to još nisu primijetili.',
    },
    {
      title: 'Prihod niže za {{percent}} %',
      message:
        '{{incomeAmount}} je ušlo prema {{expenseAmount}} izlaza. Što sreća dade, može i uzeti — uskladite troškove s onim što jest, ne s onim što je bilo.',
    },
    {
      title: 'Mršaviji mjesec, iste navike',
      message:
        'Prihod je {{percent}} % niži ({{incomeAmount}}), a troškovi su ostali na {{expenseAmount}}. Prihod nije u vašoj moći; odgovor jest.',
    },
    {
      title: 'Sreća se pomaknula',
      message:
        'Zaradili ste {{percent}} % manje nego obično, ali potrošili {{expenseAmount}} kao i prije. Smanjite sada, dok je to izbor a ne nužda.',
    },
    {
      title: 'Troškovi nisu slijedili prihod',
      message:
        'Prihod je pao na {{incomeAmount}} ({{percent}} % niže); troškovi su {{expenseAmount}}. Postavite jedro prema vjetru koji zaista imate.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Pretplate: {{monthlyAmount}} mjesečno',
      message:
        '{{count}} pretplata uzima {{percent}} % vaših mjesečnih troškova. Svaka se obnavlja bez da vas pita — pitajte se o svakoj sami.',
    },
    {
      title: '{{percent}} % troškova obnavlja se samo',
      message:
        '{{count}} pretplata, {{monthlyAmount}} mjesečno. Zadržite one na koje biste se danas ponovno prijavili.',
    },
    {
      title: 'Tiho, ponavljajuće, {{monthlyAmount}}',
      message:
        '{{count}} pretplata košta {{percent}} % vašeg mjeseca. Udobnost je dobar sluga i skup gospodar.',
    },
    {
      title: '{{count}} pretplata za pregled',
      message:
        'Zajedno su {{monthlyAmount}} mjesečno, {{percent}} % troškova. Otkažite jednu koju gotovo ne koristite i primijetite kako vam malo nedostaje.',
    },
    {
      title: 'Ono što se obnavlja samo',
      message:
        '{{monthlyAmount}} mjesečno kroz {{count}} pretplata. Automatsko trošenje zaslužuje namjeran pregled.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Vaš bi uspjeh mogao dosegnuti malo dalje',
      message:
        'Kroz {{months}} mjeseci zadržali ste {{savingsPercent}} % prihoda, a drugima je od toga otišlo gotovo ništa. Bogatstvo najbolje sjedi u otvorenim rukama — možda jedan dar ili donacija ovaj mjesec?',
    },
    {
      title: 'Dobro zarađuje, malo daje',
      message:
        '{{incomeAmount}} je ušlo kroz {{months}} mjeseci, a {{givenAmount}} je otišlo drugima. Pomažete li na načine koje ova aplikacija ne vidi, zanemarite ovo; ako ne, plan za to ima mjesta.',
    },
    {
      title: 'Dobra godina za darežljivost',
      message:
        'Uštedjeli ste {{savingsPercent}} % prihoda — znak čvrste ruke. Mali dio toga, dan nekomu u potrebi, dao bi toj čvrstoći više značenja.',
    },
    {
      title: 'Na slici još nema nikog drugog',
      message:
        'Posljednjih {{months}} mjeseci pokazuje brižno zarađivanje i štednju, ali nikakvu dobrotvornost ni darove. Stvoreni smo jedan za drugoga; skroman dar dovoljan je za početak.',
    },
    {
      title: 'Mjesto za dobrotu',
      message:
        'Na pomoć drugima otišlo je samo {{givenAmount}} od {{incomeAmount}}. Razmislite o maloj, redovnoj donaciji — darežljivost s navikom postaje lakša, kao i svaka krepost.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '„{{goal}}“ zaostaje',
      message:
        'Treba {{requiredAmount}} mjesečno, a vi ulažete oko {{paceAmount}}. Ovim će tempom stići {{monthsLate}} mjeseci kasnije. Tempo je u vašoj moći.',
    },
    {
      title: '„{{goal}}“: {{monthsLate}} mjeseci kasnije ovim tempom',
      message:
        'Potrebno {{requiredAmount}} mjesečno, stvarno oko {{paceAmount}}. Pomaknite datum iskreno ili namjerno pomaknite više novca.',
    },
    {
      title: 'Cilj i tempo se ne slažu',
      message:
        '„{{goal}}“ traži {{requiredAmount}} mjesečno; dobiva {{paceAmount}}. Cilj je stvaran samo toliko kao mjesečni korak prema njemu.',
    },
    {
      title: '„{{goal}}“ treba čvršći korak',
      message:
        '{{paceAmount}} mjesečno prema {{requiredAmount}} koje treba. Idući mjesec platite cilj prvi, prije svega neobveznog.',
    },
    {
      title: 'Zaostatak kod „{{goal}}“',
      message:
        'Sadašnji tempo ({{paceAmount}}/mjesečno) donosi kašnjenje od {{monthsLate}} mjeseci. U vašoj je moći sljedeći korak, ne cijeli put.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '„{{goal}}“ ne staje u plan',
      message:
        'Treba {{requiredAmount}} mjesečno, ali nakon vaših proračuna slobodno je samo {{freeAmount}}. Promijenite datum, cilj ili proračune — nadati se nije plan.',
    },
    {
      title: '„{{goal}}“ traži više nego imate slobodno',
      message:
        '{{requiredAmount}} potrebno svaki mjesec, {{freeAmount}} dostupno. Htjeti sve odjednom način je da se ne učini ništa; odaberite.',
    },
    {
      title: 'Brojevi kažu ne — za sada',
      message:
        '„{{goal}}“ treba {{requiredAmount}} mjesečno; slobodnog novca imate {{freeAmount}}. Prilagodite ono što je u vašoj moći: rok ili ostale granice.',
    },
    {
      title: '„{{goal}}“ traži odluku',
      message:
        'Pri {{requiredAmount}} mjesečno prelazi {{freeAmount}} koje ostaju nakon proračuna. Cilj odabran otvorenih očiju bolji je od onoga koji drži puko željenje.',
    },
    {
      title: 'Nemoguć tempo za „{{goal}}“',
      message:
        'Potrebno {{requiredAmount}} mjesečno, slobodno {{freeAmount}}. Iskrena aritmetika sada štedi razočaranje kasnije.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Vaše stanje pada pod nulu {{date}}',
      message:
        'Uz prihode i potrošnju kakvi su sada, predviđeno stanje pada na {{lowestAmount}}. Pripremite se sada, dok je to tek prognoza.',
    },
    {
      title: 'Dolazi manjak: {{date}}',
      message:
        'Plaćanja i svakodnevna potrošnja nadmašuju priljev, a stanje dotiče dno na {{lowestAmount}}. Predviđanje teškoće oduzima joj moć.',
    },
    {
      title: 'Računajte na {{date}}',
      message:
        'Tog dana predviđeno stanje dosegne {{lowestAmount}}. Pomaknite plaćanje, zadržite želju ili odvojite novac — svako je od toga danas u vašoj moći.',
    },
    {
      title: 'Prognoza pada ispod nule',
      message: 'Stanje pada na {{lowestAmount}} oko {{date}}. Mirniji je odgovor ranji.',
    },
    {
      title: 'Predvidite prazninu {{date}}',
      message:
        'Predviđeno najniže stanje: {{lowestAmount}}. Ono što je predviđeno može se primiti smireno; ono što nas iznenadi, rijetko.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Održali ste riječ danu sebi',
      message:
        '{{months}} mjeseci zaredom vaši su troškovi ostali u planu koji ste postavili. Tako izgleda samokontrola.',
    },
    {
      title: '{{months}} mjeseci u planu',
      message:
        'Mjesec za mjesecom ono što ste namjeravali i ono što ste učinili slažu se. Dosljednost je tiša od volje i traje dulje.',
    },
    {
      title: 'Plan i život se slažu',
      message:
        '{{months}} uzastopnih mjeseci u vašim granicama. Plan tako dobro držan više nije ograničenje — to je način kako živite.',
    },
    {
      title: 'Stabilno {{months}} mjeseci',
      message: 'Vaši proračuni drže {{months}} mjeseci u nizu. Zadržite istu pozornost; djeluje.',
    },
    {
      title: 'Disciplina, održana',
      message:
        '{{months}} mjeseci bez kršenja vašeg plana. Malo stvari oslobađa kao povjerenje u vlastite odluke.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Vaš novac slijedi vaše vrijednosti',
      message:
        'Novac u službi kreposti iznosio je {{actual}} % vaše potrošnje, ne manje od planiranih {{planned}} %. Dobro potrošeno.',
    },
    {
      title: 'Krepost je dobila svoj puni dio',
      message:
        '{{actual}} % na zdravlje, učenje i druge, prema planiranih {{planned}} %. Za ono što cijenite, platili ste.',
    },
    {
      title: 'Potrošeno na to da budete bolji',
      message:
        'Zdravlje, učenje i drugi dobili su {{actual}} % potrošnje mjeseca (planirano {{planned}} %). Krepost se ne može kupiti, ali joj se može služiti.',
    },
    {
      title: 'Namjera izvedena',
      message:
        'Planirali ste {{planned}} % za krepost i potrošili {{actual}} %. Dobre namjere rijetko prežive mjesec — vaše jesu.',
    },
    {
      title: 'Najbolja upotreba novca',
      message:
        '{{actual}} % otišlo je na ono što vas i druge čini boljima. Nastavite to odabirati.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Slobodno vrijeme na svom mjestu',
      message:
        'Slobodno vrijeme je {{actual}} % troškova, pod {{planned}} % koje ste mu dopustili. Uživate u stvarima bez da vas vode.',
    },
    {
      title: 'Užitak, zadržan u mjeri',
      message:
        'Slobodno vrijeme uzelo je {{actual}} % prema planiranih {{planned}} %. Umjerenost nije propustiti nešto — to je odabrati.',
    },
    {
      title: 'Odmor bez pretjerivanja',
      message:
        '{{actual}} % na slobodno vrijeme, pod vašom granicom od {{planned}} %. Radost je bolja kad ne zapovijeda.',
    },
    {
      title: 'Umjerenost, tiho',
      message:
        'Slobodnom ste vremenu dali {{planned}} %, a ono je iskoristilo samo {{actual}} %. Ta je rezerva sloboda koju ste zadržali.',
    },
    {
      title: 'Slobodno vrijeme pod planom',
      message:
        'S {{actual}} % troškova slobodno je vrijeme ostalo pod {{planned}} % koje ste postavili. Dobro održano.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '{{percent}} % pod planom',
      message:
        'Potrošili ste {{savedAmount}} manje nego što ste si za mjesec dopustili. Ne trebati sve što bi se moglo imati oblik je bogatstva.',
    },
    {
      title: '{{savedAmount}} ostalo nepotrošeno',
      message:
        'Mjesec je završio {{percent}} % pod planom. Ono što niste potrošili još je vaše da time raspolažete.',
    },
    {
      title: 'Manje nego ste dopustili',
      message:
        'Troškovi su {{percent}} % pod planom — {{savedAmount}} je ostalo. Dajte toj rezervi svrhu prije nego ju uzme navika.',
    },
    {
      title: 'Plan je imao rezervu',
      message:
        '{{savedAmount}} ispod vaših ograničenja za mjesec. Uzdržanost koja dolazi lako ona je koja traje.',
    },
    {
      title: 'Lakše nego je planirano',
      message:
        'Trebalo vam je {{percent}} % manje nego ste planirali. Razmislite da {{savedAmount}} usmjerite prema cilju.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '„{{goal}}“ je po planu',
      message:
        'Prešli ste {{percent}} % puta, u tempu koji cilj traži. Čvrsti koraci, činjeni mjesečno, dosežu daleko.',
    },
    {
      title: 'Na putu k „{{goal}}“',
      message: '{{percent}} % gotovo i tempo drži. Nastavite plaćati cilj prvi; djeluje.',
    },
    {
      title: '„{{goal}}“: {{percent}} % i stabilno',
      message: 'Cilj svaki mjesec dobiva ono što treba. Strpljenje čini svoje.',
    },
    {
      title: 'Cilj se kreće po planu',
      message:
        '„{{goal}}“ je {{percent}} % financiran i na vrijeme. Ono što se radi pomalo svaki mjesec ne zaustavlja jedan loš tjedan.',
    },
    {
      title: 'Napredak kojem možete vjerovati',
      message:
        '„{{goal}}“ stoji na {{percent}} %, u tempu. Gradite ga na jedini način koji djeluje — postupno.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: 'Manje impulzivnih kupnji kod {{merchant}}',
      message:
        'Sa {{before}} kupnji u mjesecu na oko {{after}}. Popuštena navika stečena je sloboda.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'Idete tamo manje nego prije. Svaki preskočen refleks mala je pobjeda izbora nad navikom.',
    },
    {
      title: 'Mala se navika smanjuje',
      message:
        'Kupnje kod {{merchant}} pale su s {{before}} na oko {{after}}. Nastavite — postaje lakše.',
    },
    {
      title: 'Izbor nad refleksom',
      message:
        'Kod {{merchant}} ste prešli s {{before}} kupnji na oko {{after}}. To je vladanje građeno po jednoj odluci.',
    },
    {
      title: 'Manje sitnica',
      message:
        '{{merchant}} vas je vidio oko {{after}} puta umjesto {{before}}. Male se pobjede slažu.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Prilagodili ste se mršavijem mjesecu',
      message:
        'Prihod je pao {{incomePercent}} %, a vi ste troškove smanjili {{expensePercent}} %. Na promjenu sreće odgovorili ste promjenom smjera.',
    },
    {
      title: 'Smirenost kad je prihod pao',
      message:
        'Prihod niže {{incomePercent}} %, troškovi niže {{expensePercent}} %. Prilagodili ste se onome što jest, ne onome što je bilo.',
    },
    {
      title: 'Sreća se promijenila; i vi',
      message:
        'Pad prihoda od {{incomePercent}} % susreo je pad troškova od {{expensePercent}} %. To je ravnodušnost u brojevima.',
    },
    {
      title: 'Dobro kormilareno',
      message:
        'Kad je prihod pao {{incomePercent}} %, troškovi su slijedili ({{expensePercent}} % manje). Vjetar nije bio vaš; jedro jest.',
    },
    {
      title: 'Troškovi su slijedili prihod niže',
      message:
        'Potrošili ste {{expensePercent}} % manje kad je prihod pao {{incomePercent}} %. Prilagoditi se rano miran je put kroz.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'Nužnosti su stabilne',
      message:
        '{{months}} mjeseci vaši se nužni troškovi gotovo nisu pomakli. Stabilan pod daje slobodu nad njim.',
    },
    {
      title: 'Potrebe pod nadzorom',
      message:
        'Troškovi za nužnosti ostali su ravni {{months}} mjeseci. Potrebe koje ne rastu potrebe su kojima vladate.',
    },
    {
      title: '{{months}} mjeseci stabilnih nužnosti',
      message:
        'Najam, hrana i računi ostali su gdje su bili. Tiha stabilnost također je postignuće.',
    },
    {
      title: 'Nikakvo penjanje nužnosti',
      message:
        '{{months}} mjeseci bez pomaka u onome što život zahtijeva. Sve je ostalo na toj osnovi lakše planirati.',
    },
    {
      title: 'Čvrst pod',
      message:
        'Nužni troškovi stabilni su {{months}} mjeseci. Ne puštate udobnosti da prođu kao potrebe.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Darežljiv s onim što zaradite',
      message:
        'Kroz {{months}} mjeseci {{percent}} % vašeg prihoda — {{givenAmount}} — otišlo je u pomoć drugima. To je novac u najboljoj upotrebi.',
    },
    {
      title: '{{givenAmount}} dano drugima',
      message:
        'Kroz {{months}} mjeseci podijelili ste {{percent}} % svog prihoda. Dobrota koja se pokaže u brojevima dobrota je prakticirana, ne samo osjećana.',
    },
    {
      title: 'Otvorene ruke',
      message:
        'Dobrotvornost i darovi uzeli su u posljednje vrijeme {{percent}} % vašeg prihoda. Ono što date onaj je dio bogatstva koji nijedna nesreća ne može uzeti.',
    },
    {
      title: 'Darežljivost je dio vašeg plana',
      message:
        '{{givenAmount}} drugima kroz {{months}} mjeseci. Zadržite to — dobro koje činite drugima učinjeno je i vama.',
    },
    {
      title: 'Dobro dano',
      message:
        '{{percent}} % onoga što ste zaradili otišlo je u pomoć drugima. Malo navika govori o čovjeku više.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Ništa za ispravak',
      message: 'Vaši troškovi odgovaraju onome što ste namjeravali. Nastavite kako jeste.',
    },
    {
      title: 'Namjera i djelo se slažu',
      message: 'Mjesec izgleda onako kako ste ga planirali. To je slaganje sva svrha.',
    },
    {
      title: 'Miran mjesec',
      message:
        'Nikakvog pretjerivanja, nikakvog nemara vrijednog spomena. Bravo — ponesite istu pozornost dalje.',
    },
    {
      title: 'Sve je u redu',
      message: 'Vaš je plan izdržao i ništa ne traži ispravak. Uživajte u miru koji ste zaslužili.',
    },
    {
      title: 'Čvrsta ruka',
      message: 'Mjesec je slijedio vaš plan. Dobre navike čine dobre mjesece običnima.',
    },
  ],
  'stoic.keep_first': [
    {
      title: 'Prvo sačuvajte svoj dio',
      message:
        'Kroz {{months}} mjeseci zadržali ste {{savingsPercent}} % prihoda. Senekino upozorenje: prekasno je štedjeti kad se vidi dno bačve. Odvojite {{tenthAmount}} onog dana kad prihod stigne.',
    },
    {
      title: 'Štedite s vrha bačve',
      message:
        'Uz vas je ostalo samo {{savingsPercent}} % prihoda. Štednja koja čeka ostatke dolazi prekasno; {{tenthAmount}} mjesečno, odvojeno prvo, počinje je već sada.',
    },
    {
      title: 'Što je vaše, sačuvajte',
      message:
        'Seneca savjetuje da sačuvamo ono što je zaista naše i da počnemo rano. Nedavno je uz vas ostalo {{savingsPercent}} % prihoda; počnite s {{tenthAmount}} na dan plaće i pustite da se potrošnja prilagodi ostatku.',
    },
    {
      title: 'Počnite prije taloga',
      message:
        'Zadržali ste {{savingsPercent}} % kroz {{months}} mjeseci. Štednja je u vašoj moći samo dok još ima što uštedjeti: odvojite {{tenthAmount}} prije svega drugog.',
    },
    {
      title: 'Zadržano {{savingsPercent}} %, a bačva se prazni',
      message:
        '{{tenthAmount}} mjesečno, desetina prihoda, odvojena prije ijednog računa. Ono što zadržite prvo ne ovisi o tome što mjesec ostavi.',
    },
  ],
  'stoic.prepare_beforehand': [
    {
      title: 'Pripremite se dok je mirno',
      message:
        'Vaša rezerva pokriva otprilike {{cushionDays}} dana potrošnje. Seneca: duša se treba očvrsnuti u vremenima bez briga. Tri mjeseca potrošnje iznose {{targetAmount}}.',
    },
    {
      title: 'Rezerva od {{cushionDays}} dana',
      message:
        'Fortuna se ne najavljuje. Težite prema {{targetAmount}}, tri mjeseca potrošnje, dok ništa ne pritišće: tada je lako.',
    },
    {
      title: '„Je li to stanje kojega sam se bojao?“',
      message:
        'Seneca je tjerao Lucilija da vježba siromaštvo kako bi izgubilo svoju strahotu. S rezervom od {{cushionDays}} dana jedan težak mjesec ne bi bio vježba. Ciljajte na {{targetAmount}}.',
    },
    {
      title: 'Predvidite težak mjesec',
      message:
        'Vaša ušteđevina trajala bi otprilike {{cushionDays}} dana. Ono što je predviđeno dolazi blago; {{targetAmount}} nosilo bi vas tri mjeseca.',
    },
    {
      title: 'Podignite zid prije oluje',
      message:
        'Pokriveno je oko {{cushionDays}} dana. Gubitak prihoda nije u vašoj moći; rezerva jest. Tri mjeseca potrošnje iznose {{targetAmount}}.',
    },
  ],
  'stoic.wants_outrun_income': [
    {
      title: 'Želje trče brže od prihoda',
      message:
        'Potrošnja je u zadnjem tromjesečju porasla {{expenseGrowth}} %, a prihod se promijenio {{incomeGrowth}} %. Siromašan nije onaj tko ima premalo, piše Seneca, nego onaj tko žudi za više.',
    },
    {
      title: 'Živjeti više, ne bolje',
      message:
        'Potrošnja je porasla {{expenseGrowth}} %, prihod {{incomeGrowth}} %. Potrebe prirode su malene, zahtjevi mnijenja bezgranični. Pitajte kojem od njih služi taj rast.',
    },
    {
      title: 'Želje su narasle: +{{expenseGrowth}} %',
      message:
        'Troškovi su rasli brže od prihoda ({{incomeGrowth}} %). Nova udobnost brzo počne djelovati kao potreba: primijetite je dok joj još možete odbiti.',
    },
    {
      title: 'Granica se pomiče',
      message:
        'Potrošnja je porasla {{expenseGrowth}} % iz tromjesečja u tromjesečje, prihod {{incomeGrowth}} %. Dosta ostaje dosta samo ako vi odlučite koliko je to.',
    },
    {
      title: 'Više nije lijek',
      message:
        'U zadnjem tromjesečju potrošnja je porasla {{expenseGrowth}} %, a prihod {{incomeGrowth}} %. Bogatstvo koje raste sa žudnjom nikad ne stiže; odredite granicu prije nego ovo postane novo uobičajeno.',
    },
  ],
  'stoic.price_in_life': [
    {
      title: '{{merchant}} vas je stajao {{hours}} sati života',
      message:
        'Seneca podsjeća da je samo vrijeme zaista naše. {{totalAmount}} kod {{merchant}} otprilike je {{hours}} sati vašeg rada. Je li vrijedilo?',
    },
    {
      title: '{{hours}} sati kod {{merchant}}',
      message:
        'Novac čuvamo, a vrijeme razdajemo. Uz vašu prosječnu satnicu, {{totalAmount}} tamo je otprilike {{hours}} radnih sati.',
    },
    {
      title: 'Izrazite cijenu u satima',
      message:
        '{{totalAmount}} kod {{merchant}} otprilike je {{hours}} sati rada. Sati su jedino što ne možete ponovno zaraditi.',
    },
    {
      title: 'Što je {{merchant}} zaista koštao',
      message:
        'Svoje dane mijenjate za novac, a novac za stvari. {{merchant}} je uzeo oko {{hours}} vaših sati ({{totalAmount}}). Odgovara li užitak tim satima?',
    },
    {
      title: 'Odvagnite sate',
      message:
        'Preračunato prema vašoj prosječnoj satnici, {{totalAmount}} kod {{merchant}} iznosi oko {{hours}} sati. Gubimo vrlo mnogo svog vremena, piše Seneca. Jeste li ovo izabrali?',
    },
  ],
  'stoic.rule_broken': [
    {
      title: 'Pravilo „{{rule}}“ je izgubilo put',
      message:
        'Upire u nešto što više ne postoji, pa je tiho prestalo raditi. Popravite ga ili uklonite: red koji ništa ne radi samo izgleda kao red.',
    },
    {
      title: '„{{rule}}“ više ne djeluje',
      message:
        'Njegove kategorije, računa ili primatelja više nema, a pravilo se sada preskače kod svake transakcije. Vidite stvari kakve jesu, pa ih popravite.',
    },
    {
      title: 'Pravilo upereno u ništa',
      message:
        '„{{rule}}“ šalje transakcije na mjesto koje je uklonjeno. Jednom ste nešto odlučili; odlučite ponovno, sada kad su se stvari promijenile.',
    },
    {
      title: '„{{rule}}“ traži vašu prosudbu',
      message:
        'Ono na što se odnosi izbrisano je, a transakcije koje je nekad razvrstavalo sada čekaju vas. Dajte mu novi cilj ili ga pustite.',
    },
    {
      title: 'Pokvareno pravilo, u tišini',
      message:
        '„{{rule}}“ ne radi ništa i ništa o tome ne govori. Popravite ono što je u vašoj moći: treba vam minuta.',
    },
  ],
  'stoic.rule_contradicted': [
    {
      title: 'Vaša se ruka ne slaže s pravilom „{{rule}}“',
      message:
        '{{count}} puta ručno ste razvrstali drugdje ono što ovo pravilo razvrstava drukčije. Ili je pogrešno pravilo ili ruka: odlučite što od to dvoje.',
    },
    {
      title: '„{{rule}}“ je nadjačano {{count}} puta',
      message:
        'Pravilo koje stalno ispravljate više nije odluka, nego navika prepiranja sa sobom. Promijenite ga ili mu vjerujte.',
    },
    {
      title: 'Govorite što činite, činite što govorite',
      message:
        'Pravilo „{{rule}}“ kaže jedno, vaših posljednjih {{count}} ispravaka kaže drugo. Uskladite jedno s drugim.',
    },
    {
      title: 'Sporna odluka',
      message:
        '„{{rule}}“ ste postavili hladne glave, a {{count}} transakcija otada je otišlo drugim putem. Pogledajte ponovno, mirno, tko je bio u pravu: pravilo ili vi.',
    },
    {
      title: '{{count}} ispravaka protiv pravila „{{rule}}“',
      message:
        'Ponavljanje je podatak. Pustite da promijeni pravilo, ili pustite da pravilo promijeni naviku.',
    },
  ],
  'stoic.rule_worth_writing': [
    {
      title: 'Odlučite jednom o primatelju {{payee}}',
      message:
        'Primatelja {{payee}} ručno ste razvrstali {{decided}} puta, uvijek isto. Što odlučujete iznova i iznova, odlučite jednom, hladne glave.',
    },
    {
      title: 'Odluka donesena {{decided}} puta',
      message:
        '{{payee}} stalno postavlja isto pitanje, a vi stalno dajete isti odgovor. Pravilo bi sačuvalo vašu pozornost za ono što je zaista traži.',
    },
    {
      title: 'Primatelji spremni za pravilo: {{count}}',
      message:
        'Isti primatelji stalno od vas dobivaju istu kategoriju, najviše {{payee}}. Sačuvajte prosudbu za ono što je novo.',
    },
    {
      title: 'Vaša navika spremna je postati načelo',
      message:
        'Primatelja {{payee}} svaki put razvrstavate isto (dosad {{decided}} puta). Zapišite to kao pravilo i držat će se bez napora.',
    },
    {
      title: 'Neka to nosi pravilo',
      message:
        'Primatelji koje svaki put razvrstavate isto: {{count}}, među njima {{payee}} s {{decided}} transakcija. Načelo riješeno jednom ne mora se iznova braniti.',
    },
  ],
  'stoic.rule_idle': [
    {
      title: '„{{rule}}“ već {{months}} mjeseci nije ništa srelo',
      message:
        'Ili je svijet za koji je napravljeno nestao, ili njegovi uvjeti promašuju cilj. Držite pravila istinitima: popravite ga ili uklonite.',
    },
    {
      title: 'Pravilo u mirovanju: „{{rule}}“',
      message:
        '{{months}} mjeseci nije dotaklo nijednu transakciju. Odbacite suvišno; onome što ostane lakše je vjerovati.',
    },
    {
      title: '„{{rule}}“ stoji besposleno',
      message:
        '{{months}} mjeseci bez podudaranja, a nove transakcije stalno stižu. Isprobajte ga na nedavnima, pa odlučite.',
    },
    {
      title: 'Treba li „{{rule}}“ još?',
      message:
        '{{months}} mjeseci ništa mu nije odgovaralo. Pravilo zadržano iz navike još je jedna stvar o kojoj treba voditi brigu.',
    },
    {
      title: 'Odluka bez ičega za odlučiti',
      message:
        '„{{rule}}“ šuti već {{months}} mjeseci. Red znači imati ono što vam treba, i samo to.',
    },
  ],
  'stoic.praise_rules_hold': [
    {
      title: 'Vaše odluke drže',
      message:
        'Pravila su razvrstala {{percent}} % transakcija mjeseca, a nijedno nije trebalo nadjačati. Odluka donesena jednom i održana oslobađa um.',
    },
    {
      title: '{{percent}} % riješeno unaprijed',
      message:
        'Većina transakcija mjeseca razvrstana je prema onome što ste ranije odlučili. To je pozornost sačuvana za ono što je važno.',
    },
    {
      title: 'Načela na djelu',
      message:
        'Vaša su pravila obradila {{percent}} % transakcija bez prijepora. Utvrđena načela daju tihe dane.',
    },
    {
      title: 'Manje za odlučivanje',
      message:
        '{{percent}} % transakcija nije tražilo novu odluku. Prosudili ste jednom, dobro, i ta prosudba još stoji.',
    },
    {
      title: 'Red održan',
      message:
        'Pravila su razvrstala {{percent}} % mjeseca i nijedno nije osporeno. Dobar red izgleda kao da se ništa ne događa.',
    },
  ],
  'stoic.goal_no_date': [
    {
      title: '„{{goal}}“ nema datum',
      message:
        'Stoji na {{percent}} %, a ništa ne ulazi. Tko ne zna u koju luku plovi, tom nijedan vjetar nije povoljan: odredite dan kad namjeravate stići.',
    },
    {
      title: 'Želja ili cilj?',
      message:
        '„{{goal}}“ nema rok ni tempo. Cilj je odluka s datumom; dajte mu ga ili ga pustite.',
    },
    {
      title: 'Odredite dan za „{{goal}}“',
      message:
        'Na {{percent}} je puta i ne miče se. Ono što se može učiniti bilo kada rijetko se uopće učini.',
    },
    {
      title: '„{{goal}}“ čeka „jednom“',
      message:
        'Nedavno ništa nije ušlo, a nijedan datum ništa ne traži. „Jednom“ nije u vašem kalendaru; odaberite dan koji jest.',
    },
    {
      title: '„{{goal}}“ nema luku',
      message: '{{percent}} % i bez roka. Znajte kamo plovite, a mjesečni korak slijedi sam.',
    },
  ],
};
