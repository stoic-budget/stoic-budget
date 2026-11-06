import type { StoicTextMap } from './types';

export const pl: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'Miesiąc przerósł swój plan',
      message:
        'Plan wynosił {{plannedAmount}}, a wydano {{spentAmount}} — o {{percent}}% więcej. Plan powstał na chłodno; niech mówi głośniej niż chwilowy impuls.',
    },
    {
      title: 'O {{percent}}% więcej, niż zakładał plan',
      message:
        'Wydatki: {{spentAmount}} przy planie {{plannedAmount}}. Sprawdź, który limit puścił pierwszy — tam jest lekcja.',
    },
    {
      title: 'Plan i miesiąc się rozminęły',
      message:
        'Wydano {{spentAmount}}, zamierzano {{plannedAmount}}. Albo plan wymagał od życia za mało, albo życie wymagało od Ciebie za dużo — spokojnie rozstrzygnij, które z nich.',
    },
    {
      title: 'Wyszło więcej, niż pozwalał plan',
      message:
        'Miesiąc przekroczył ustalone {{plannedAmount}} o {{percent}}%. Zatrzymując się teraz, nic nie tracisz; udając, że nic się nie stało, tracisz wiele.',
    },
    {
      title: 'Własna granica, własne przekroczenie',
      message:
        'Miało być {{plannedAmount}}, jest {{spentAmount}}. Panowanie nad sobą to nie brak potknięć, lecz wczesne ich zauważenie i powrót na drogę.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Rozrywka bierze więcej, niż planowano',
      message:
        'Rozrywka miała stanowić {{planned}}% wydatków, wyszło {{actual}}%. Przyjemność jest mile widziana jako gość, nie jako pan domu.',
    },
    {
      title: 'Rozrywka: {{actual}}% przy planie {{planned}}%',
      message:
        'Odpoczynek zasługuje na swoje miejsce, gdy regeneruje. Zapytaj, które przyjemności miesiąca to zrobiły, a resztę puść bez żalu.',
    },
    {
      title: 'Wygoda wydaje więcej niż zamiar',
      message:
        'Rozrywka zajmuje {{actual}}% wydatków wobec wybranych przez Ciebie {{planned}}%. Umiar to nie odmawianie sobie przyjemności, lecz utrzymanie jej w ustalonych granicach.',
    },
    {
      title: 'Przyjemne wypiera zaplanowane',
      message:
        'Plan dawał rozrywce {{planned}}%, a wzięła {{actual}}%. To, co przychodzi łatwo, warto obejrzeć uważniej, zanim stanie się potrzebą.',
    },
    {
      title: 'Rozrywka przekroczyła swoją linię',
      message:
        'Na rozrywkę poszło {{actual}}% miesiąca, zamiarem było {{planned}}%. Linia jest Twoja — i Ty ją trzymasz.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Rozrywka znów ponad plan',
      message:
        'Rozrywka przekroczyła plan w {{months}} z ostatnich {{window}} mies. Powtórka to już nie przypadek, lecz nawyk wart przyjrzenia się.',
    },
    {
      title: '{{months}} z {{window}} mies. ponad plan na rozrywkę',
      message:
        'Raz — to okoliczność; powtórka miesiąc po miesiącu (już {{months}}) — to kształtujący się charakter. Wybieraj go świadomie.',
    },
    {
      title: 'To samo potknięcie co miesiąc',
      message:
        'Rozrywka wychodziła poza plan w {{months}} z {{window}} mies. Albo uczciwie podnieś plan, albo zmień nawyk — życie pomiędzy kosztuje najwięcej.',
    },
    {
      title: 'To wzorzec, nie wpadka',
      message:
        'W ostatnich {{window}} mies. rozrywka brała więcej, niż jej dano, w {{months}} z nich. Zauważaj chwilę, w której zapada decyzja, a nie tylko rachunek po fakcie.',
    },
    {
      title: 'Nawyk głosuje przeciw planowi',
      message:
        'Rozrywka wyprzedziła plan w {{months}} z {{window}} mies. Nawyki buduje się po jednym wyborze — i tak samo się je rozbiera.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'Cnota dostaje mniej, niż zamierzano',
      message:
        'Odłożono {{planned}}% budżetu na zdrowie, naukę i innych; wyszło {{actual}}%. Zamiar liczy się dopiero wtedy, gdy zostanie wykonany.',
    },
    {
      title: 'Cnota: {{actual}}% z zamierzonych {{planned}}%',
      message:
        'Pieniądze przeznaczone na to, co czyni Cię lepszym, wciąż czekają. Nie ma lepszej chwili, by wydać je dobrze, niż teraz.',
    },
    {
      title: 'Zaplanowane dobro nie zostało opłacone',
      message:
        'Zdrowie, nauka i hojność miały dostać {{planned}}% wydatków, dostały {{actual}}%. W tym tygodniu zrób świadomie jedną z tych rzeczy.',
    },
    {
      title: 'Zamiar bez czynu',
      message:
        'Cnota to {{actual}}% wydatków wobec wybranych {{planned}}%. To, co cenimy, widać po tym, za co naprawdę płacimy.',
    },
    {
      title: 'Wciąż jest miejsce na to, co ważne',
      message:
        'Na cnotę poszło tylko {{actual}}%, choć w planie było {{planned}}%. Książka, badanie kontrolne, pomoc potrzebującemu — plan już powiedział „tak”.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'Cnota wciąż odkładana',
      message:
        'Wydatki na zdrowie, naukę i innych są poniżej planu już {{months}} mies. z rzędu. To, co ciągle odkładasz, w istocie już odrzucasz.',
    },
    {
      title: 'Cnota odłożona: {{months}} mies.',
      message:
        'Co miesiąc plan robił miejsce na Twój rozwój, i co miesiąc to miejsce stało puste. Czasu nie da się zaplanować dwa razy.',
    },
    {
      title: 'Lepsza wersja Ciebie wciąż czeka',
      message:
        'Cnota jest poniżej planu już {{months}} mies. z rzędu. Zacznij od czegoś małego i pewnego, a nie wielkiego i kiedyś.',
    },
    {
      title: 'Dobre zamiary się starzeją',
      message:
        'Od {{months}} mies. zdrowie, nauka i hojność dostają mniej, niż zamierzono. Wybierz jedno i w przyszłym miesiącu opłać je jako pierwsze, przed wszystkim innym.',
    },
    {
      title: 'Cnota znów przegrywa z „później”',
      message:
        'Poniżej planu — {{months}} mies. z rzędu. „Później” to miejsce, gdzie dobre zamiary idą w zapomnienie; wyznacz temu datę.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'W Twoim planie nie ma miejsca na cnotę',
      message:
        'Żaden budżet nie służy zdrowiu, nauce ani innym ludziom. Plan pokazuje, co cenimy — rozważ osobną pozycję dla cnoty.',
    },
    {
      title: 'Budżet na wszystko, tylko nie na dobro',
      message:
        'Konieczność, praca i rozrywka mają limity, cnota — nie. To, czego nigdy się nie planuje, zwykle się nie wydarza.',
    },
    {
      title: 'Zaplanuj swój rozwój',
      message:
        'W klasie „Cnota” nie ma jeszcze budżetu. Nawet niewielki — na książki, sport, darowiznę — zamienia życzenie w zobowiązanie.',
    },
    {
      title: 'Plan milczy o cnocie',
      message:
        'Planujesz to, co musisz, i to, co lubisz, ale jeszcze nie to, kim chcesz się stać. Jeden skromny budżet na cnotę by to zmienił.',
    },
    {
      title: 'Cnota nie ma budżetu',
      message:
        'Wydatki na zdrowie, naukę czy innych nigdzie nie są zaplanowane. Wybierz jedno i daj mu limit, którego osiągnięcie by Cię ucieszyło.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'Konieczność kosztuje więcej, niż planowano',
      message:
        'Na konieczność zaplanowano {{planned}}% wydatków, a zajmuje {{actual}}%. Sprawdź, czy każdy taki wydatek jest wciąż potrzebą, czy po cichu stał się wygodą.',
    },
    {
      title: 'Konieczność: {{actual}}% przy planie {{planned}}%',
      message:
        'Życie zwykle wymaga mniej, niż to, do czego przywykliśmy. Spójrz świeżym okiem na największy obowiązkowy wydatek.',
    },
    {
      title: 'Podstawy się rozrastają',
      message:
        'Konieczność zajmuje {{actual}}% miesiąca wobec oczekiwanych {{planned}}%. Potrzeba, która wciąż rośnie, zasługuje na pytanie.',
    },
    {
      title: 'Potrzeby przerastają plan',
      message:
        'Plan — {{planned}}%, rzeczywistość — {{actual}}%. Albo plan nie docenił realnych kosztów, albo niektóre zachcianki podróżują pod nazwą potrzeb.',
    },
    {
      title: 'Na „muszę” poszło więcej, niż zamierzano',
      message:
        'Konieczność wzięła {{actual}}% wydatków zamiast {{planned}}%. Oddziel to, co naprawdę musi być, od tego, co po prostu zawsze było.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'Konieczność pełznie w górę',
      message:
        'Wydatki na konieczność rosną już {{months}} mies. z rzędu, łącznie o {{percent}}%. Potrzeby rosną po cichu, gdy nikt nie każe im się tłumaczyć.',
    },
    {
      title: '+{{percent}}% na konieczność w {{months}} mies.',
      message:
        'Każdy krok wydawał się mały; razem już nie są. Weź największy stały wydatek i zapytaj, czy wciąż musi tyle kosztować.',
    },
    {
      title: 'Podłoga Twoich wydatków się podnosi',
      message:
        'Konieczność rosła przez {{months}} mies. z rzędu (+{{percent}}%). Podnosząca się podłoga zostawia mniej miejsca na wszystko, co wybierasz swobodnie.',
    },
    {
      title: 'Potrzeby się rozszerzają',
      message:
        'Wzrost trwa już {{months}} mies., łącznie {{percent}}%. Test jest prosty: czy to nadal byłby Twój wybór, przy znanej dziś cenie?',
    },
    {
      title: 'Małe wzrosty, stały kierunek',
      message:
        'Konieczność wzrosła o {{percent}}% w ciągu {{months}} mies. Kierunek znaczy więcej niż pojedynczy miesiąc — ten warto skorygować wcześnie.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'Praca kosztuje więcej, niż planowano',
      message:
        'Na pracę zaplanowano {{planned}}% wydatków, a zajmuje {{actual}}%. Narzędzia i usługi powinny na siebie zarabiać — sprawdź, które to robią.',
    },
    {
      title: 'Wydatki na pracę: {{actual}}% przy planie {{planned}}%',
      message:
        'Inwestycja w pracę jest dobra, gdy coś zwraca. Przejrzyj to, za co płacisz, a czego już nie używasz.',
    },
    {
      title: 'Budżet na pracę jest napięty',
      message:
        'Praca wzięła {{actual}}% zamiast {{planned}}%. Pracowitość to dobrze wykonana praca, a nie kupowanie do niej każdego narzędzia.',
    },
    {
      title: 'Narzędzia wyprzedzają plan',
      message:
        'Plan — {{planned}}%, na pracę poszło {{actual}}%. Zapytaj o każdy wydatek: czy pomaga mi pracować, czy tylko daje poczucie postępu?',
    },
    {
      title: 'Koszty pracy się przesunęły',
      message:
        'Praca zajmuje {{actual}}% wydatków wobec zamierzonych {{planned}}%. Mały przegląd teraz oszczędzi dużego później.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '„{{category}}” znów przekracza limit',
      message:
        'Kategoria „{{category}}” przekroczyła budżet w {{months}} z ostatnich {{window}} mies. Błędny jest albo limit, albo pragnienie — zdecyduj, które.',
    },
    {
      title: '„{{category}}”: ponad budżet w {{months}} z {{window}} mies.',
      message:
        'Limit, który zawsze się przekracza, nie jest limitem, tylko życzeniem. Uczyń go uczciwym: świadomie go podnieś albo świadomie go trzymaj.',
    },
    {
      title: 'Ten sam budżet znów nie wytrzymał',
      message:
        'Kategoria „{{category}}” przekroczyła limit w {{months}} z {{window}} mies. Powtórzenie to informacja; wykorzystaj ją.',
    },
    {
      title: '„{{category}}” prosi o uwagę',
      message:
        'Ponad budżet w {{months}} z {{window}} mies. Obserwuj chwilę przed zakupem — tylko tam można zmienić nawyk.',
    },
    {
      title: 'Wzorzec w kategorii „{{category}}”',
      message:
        'Przekroczenia: {{months}} na {{window}} mies. Stajemy się tym, co powtarzamy; zdecyduj, co ta kategoria ma mówić o Tobie.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: 'Limit „{{category}}” skończy się do {{day}}. dnia miesiąca',
      message:
        'Wydano {{spentAmount}} z {{limitAmount}}, a w tym tempie limit wyczerpie się około {{day}}. dnia. Zwolnić teraz jest łatwiej, niż zatrzymywać się później.',
    },
    {
      title: '„{{category}}” wyprzedza miesiąc',
      message:
        'Z limitu {{limitAmount}} ubyło już {{spentAmount}}. W tym tempie wyczerpie się do {{day}}. dnia — reszta miesiąca wciąż jest w Twoich rękach.',
    },
    {
      title: 'Kontrola tempa: „{{category}}”',
      message:
        'Przy obecnym tempie budżet {{limitAmount}} wystarczy mniej więcej do {{day}}. dnia miesiąca. Przezorność to najtańszy rodzaj dyscypliny.',
    },
    {
      title: '„{{category}}” wydaje przyszłość',
      message:
        'Wydano {{spentAmount}} z {{limitAmount}}; limit skończy się około {{day}}. dnia. To, co zrobisz w tym tygodniu, zdecyduje, czy tak się stanie.',
    },
    {
      title: 'Wczesne ostrzeżenie: „{{category}}”',
      message:
        'Przy obecnym tempie limit {{limitAmount}} nie wystarczy do końca miesiąca — wyczerpie się około {{day}}. dnia. Skoryguj, póki kosztuje to niewiele.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '„{{category}}” leży nieużywany',
      message:
        'W budżecie „{{category}}” od {{months}} mies. nie było żadnych wydatków. Albo przestał być potrzebny, albo to zamiar, który wciąż czeka — zdecyduj, które.',
    },
    {
      title: 'Pusty budżet: „{{category}}”',
      message:
        'Ani jednego wydatku od {{months}} mies. Plan powinien opisywać życie, którym żyjesz, albo to, które budujesz — które to jest?',
    },
    {
      title: '„{{category}}” stoi bezczynnie',
      message:
        'Nic tu nie wydano od {{months}} mies. Jeśli to powściągliwość — dobrze; jeśli zaniedbanie — działaj.',
    },
    {
      title: 'Zaplanowane, ale nie przeżyte',
      message:
        'Kategoria „{{category}}” ma limit, a od {{months}} mies. żadnych wydatków. Utrzymuj plan w prawdzie: usuń go albo z niego korzystaj.',
    },
    {
      title: '„{{category}}”: cichych miesięcy — {{months}}',
      message:
        'Budżet, którego nikt nie dotyka, i tak zajmuje miejsce w planie. Zwolnij to miejsce albo spełnij zamiar.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}}% wydatków bez limitu',
      message:
        '{{unbudgetedAmount}} z miesiąca poszło na kategorie, których nie pilnuje żaden budżet. Czego nie obejrzano, tego nie osądzisz.',
    },
    {
      title: 'Duża część miesiąca jest nieplanowana',
      message:
        '{{percent}}% wydatków — {{unbudgetedAmount}} — leży poza wszystkimi budżetami. Daj limit największej części, a plan zobaczy więcej z Twojego życia.',
    },
    {
      title: 'Wydatki poza planem',
      message:
        'Budżety obejmują tylko część wydatków; {{unbudgetedAmount}} ({{percent}}%) pozostaje niezmierzone. Rozszerz plan tam, dokąd naprawdę płyną pieniądze.',
    },
    {
      title: 'Plan widzi tylko część obrazu',
      message: '{{percent}}% wydatków miesiąca nie ma budżetu. Jasny wzrok poprzedza dobry osąd.',
    },
    {
      title: 'Wydano bez limitu: {{unbudgetedAmount}}',
      message:
        'To {{percent}}% miesiąca. Nie musisz tego ograniczać — wystarczy zdecydować, ile z tego naprawdę chcesz.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '„{{category}}” to większość rozrywki',
      message:
        '{{percent}}% wydatków na rozrywkę poszło na „{{category}}”. Ciesz się tym, ale sprawdź, czy potrafisz się z tego wycofać.',
    },
    {
      title: 'Jedna przyjemność dominuje',
      message:
        'Kategoria „{{category}}” bierze {{percent}}% wszystkich wydatków na rozrywkę. Zapytaj, czy wciąż cieszy, czy stała się rutyną.',
    },
    {
      title: 'Rozrywka opiera się na „{{category}}”',
      message:
        '{{percent}}% rozrywki w jednym miejscu. To, bez czego nie możemy się obejść, trzyma nas w uścisku; sprawdź, czy ten uścisk jest wciąż lekki.',
    },
    {
      title: '„{{category}}”: {{percent}}% rozrywki',
      message:
        'Jedno źródło przyjemności zabiera prawie wszystko. Obejdź się bez niego przez jakiś czas i zobacz, co naprawdę Ci daje.',
    },
    {
      title: 'Twój odpoczynek ma jeden adres',
      message:
        'Większość pieniędzy na rozrywkę, {{percent}}%, idzie na „{{category}}”. Wolność od przyjemności jest wtedy, gdy potrafisz się bez niej obejść.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Część wydatków nie została oceniona',
      message:
        'Kategorie bez klasy: {{count}}. Zdecyduj w Budżetach, co jest koniecznością, pracą, cnotą, a co rozrywką.',
    },
    {
      title: 'Kategorie czekające na Twoją ocenę: {{count}}',
      message:
        'Mają wydatki, ale nie mają klasy, więc porada nie może ich zważyć. Minuta w sekcji „Budżety” to załatwi.',
    },
    {
      title: 'Nazwij, czemu służą Twoje pieniądze',
      message:
        'Kategorie bez klasyfikacji: {{count}}. Osąd zaczyna się od nazywania rzeczy po imieniu.',
    },
    {
      title: 'Nieocenione wydatki — kategorie: {{count}}',
      message:
        'Czy to potrzeba, Twoja praca, cnota czy przyjemność? Tylko Ty możesz to rozstrzygnąć — a plan stanie się jaśniejszy, gdy to zrobisz.',
    },
    {
      title: 'Kilka kategorii nie ma klasy',
      message:
        'Kategorie poza czterema klasami: {{count}}. Sklasyfikuj je w sekcji „Budżety”, by każdy wydatek był widziany takim, jaki jest.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: '{{merchant}}: drobne zakupy — {{count}}',
      message:
        'Każdy z nich wydawał się błahostką; razem wyszło {{totalAmount}} w ciągu miesiąca. Drobne, nieprzemyślane nawyki to miejsce, gdzie po cichu znika najwięcej pieniędzy.',
    },
    {
      title: '{{merchant}}: {{count}} razy w miesiącu',
      message:
        '{{totalAmount}} w drobnych kwotach. Zapytaj, czy każda wizyta była wyborem, czy odruchem: tylko pierwsze jest wolnością.',
    },
    {
      title: 'Po trochu uzbierało się {{totalAmount}}',
      message:
        '{{merchant}}: zakupy — {{count}}. Żaden z osobna się nie liczy; liczy się nawyk. Zdecyduj, jak często naprawdę tego chcesz.',
    },
    {
      title: 'Nawyk: {{merchant}}',
      message:
        '{{count}} zakupów, razem {{totalAmount}}. Spróbuj pominąć co trzeci i zobacz, czy go brakuje.',
    },
    {
      title: 'Drobiazgi się sumują',
      message:
        '{{merchant}}: wizyty — {{count}}, na kwotę {{totalAmount}}. Panowanie nad dużymi decyzjami buduje się na takich małych.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Weekendy to {{percent}}% rozrywki',
      message:
        'Większość wydatków na rozrywkę przypada na soboty i niedziele. Odpoczynek jest dobry; sprawdź, czy to odpoczynek, a nie rekompensata za tydzień.',
    },
    {
      title: 'Rozrywka żyje w weekendy',
      message:
        '{{percent}}% wydatków na rozrywkę przypada na weekendy. Zaplanuj weekend choć trochę, a będzie kosztował mniej i dał więcej.',
    },
    {
      title: 'Weekend płaci za cały tydzień',
      message:
        'Weekendy zabierają {{percent}}% tego, co wydajesz na rozrywkę. Jeśli tydzień trzeba naprawiać w każdą sobotę, przyjrzyj się samemu tygodniowi.',
    },
    {
      title: 'Sobota i niedziela: {{percent}}% rozrywki',
      message:
        'Wolne dni zachęcają do swobodnych wydatków. Przed weekendem zdecyduj, czemu ma służyć, a pieniądze niech pójdą za decyzją.',
    },
    {
      title: 'Weekendowy wzorzec',
      message:
        '{{percent}}% wydatków na rozrywkę przypada na weekendy. Lżejszy tydzień często sprawia, że weekend jest tańszy.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}}: {{percent}}% miesiąca',
      message:
        '{{totalAmount}} trafiło do jednego sprzedawcy rozrywki. Gdy jedno miejsce ma tyle Twoich pieniędzy, zapytaj, ile ma Twojej uwagi.',
    },
    {
      title: 'Jedno miejsce — {{totalAmount}}',
      message:
        '{{merchant}} to {{percent}}% wydatków miesiąca. Czy jest wart takiej części owoców Twojej pracy?',
    },
    {
      title: 'Najwięcej wydatków: {{merchant}}',
      message:
        '{{percent}}% miesiąca — {{totalAmount}} — poszło właśnie tam. Nie ma nic złego w cieszeniu się tym, o ile to nadal Twój świadomy wybór.',
    },
    {
      title: 'Duży udział: {{merchant}}',
      message:
        '{{totalAmount}}, czyli {{percent}}% wydatków, w jednym miejscu rozrywki. Spokojnie zważ przyjemność i cenę.',
    },
    {
      title: '{{percent}}% — {{merchant}}',
      message:
        'Ten jeden sprzedawca wziął {{totalAmount}}. Wolność to móc przejść obok, kiedy tak postanowisz.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Dochód spadł, wydatki nie',
      message:
        'Dochód spadł o {{percent}}%, do {{incomeAmount}}, a wydatki zostały na poziomie {{expenseAmount}}. Los zmienił zdanie; Twoje wydatki jeszcze tego nie zauważyły.',
    },
    {
      title: 'Dochód niższy o {{percent}}%',
      message:
        'Wpłynęło {{incomeAmount}}, wypłynęło {{expenseAmount}}. Co los dał, może odebrać — dopasuj wydatki do tego, co jest, a nie do tego, co było.',
    },
    {
      title: 'Skromniejszy miesiąc, te same nawyki',
      message:
        'Dochód jest o {{percent}}% niższy ({{incomeAmount}}), a wydatki trzymają się na {{expenseAmount}}. Dochód nie zależy od Ciebie; odpowiedź na niego — tak.',
    },
    {
      title: 'Los się odwrócił',
      message:
        'Dochód jest o {{percent}}% niższy niż zwykle, a wydatki jak dotąd wynoszą {{expenseAmount}}. Przytnij teraz, póki to wybór, a nie konieczność.',
    },
    {
      title: 'Wydatki nie poszły za dochodem',
      message:
        'Dochód spadł do {{incomeAmount}} (−{{percent}}%), wydatki: {{expenseAmount}}. Ustaw żagiel do wiatru, który naprawdę wieje.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Subskrypcje: {{monthlyAmount}} miesięcznie',
      message:
        'Subskrypcje: {{count}}, a zabierają {{percent}}% Twoich miesięcznych wydatków. Każda odnawia się, nie pytając Cię o zdanie — zadaj pytanie o każdą z nich.',
    },
    {
      title: '{{percent}}% wydatków odnawia się samo',
      message:
        'Subskrypcje: {{count}}, {{monthlyAmount}} miesięcznie. Zostaw te, które warto wykupić także dziś.',
    },
    {
      title: 'Cicho, regularnie, {{monthlyAmount}}',
      message:
        'Subskrypcje (łącznie {{count}}) kosztują {{percent}}% Twojego miesiąca. Wygoda to dobry sługa i kosztowny pan.',
    },
    {
      title: 'Subskrypcje do przejrzenia: {{count}}',
      message:
        'Razem to {{monthlyAmount}} miesięcznie, {{percent}}% wydatków. Anuluj tę, z której prawie nie korzystasz, i zauważ, jak mało Ci jej brakuje.',
    },
    {
      title: 'To, co odnawia się samo',
      message:
        '{{monthlyAmount}} miesięcznie, subskrypcje: {{count}}. Automatyczne wydatki zasługują na świadomy przegląd.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Twój sukces może sięgnąć trochę dalej',
      message:
        'Przez {{months}} mies. zostaje u Ciebie {{savingsPercent}}% dochodu, a do innych nie trafia z tego prawie nic. Bogactwu najlepiej w otwartych dłoniach — może jeden prezent albo darowizna w tym miesiącu?',
    },
    {
      title: 'Dobre zarobki, niewiele dawania',
      message:
        'Dochód z {{months}} mies.: {{incomeAmount}}, dla innych: {{givenAmount}}. Jeśli pomagasz w sposób, którego aplikacja nie widzi, pomiń to; jeśli nie — w planie jest na to miejsce.',
    },
    {
      title: 'Dobry czas na hojność',
      message:
        'Oszczędności to {{savingsPercent}}% dochodu — znak pewnej ręki. Niewielka część tego, oddana komuś w potrzebie, nadałaby tej stałości większy sens.',
    },
    {
      title: 'Na obrazku nie ma jeszcze innych ludzi',
      message:
        'Ostatnie mies. ({{months}}) to staranne zarabianie i oszczędzanie, ale bez dobroczynności i prezentów. Jesteśmy stworzeni dla siebie nawzajem; na początek wystarczy skromny dar.',
    },
    {
      title: 'Miejsce na życzliwość',
      message:
        'Na pomoc innym poszło tylko {{givenAmount}} z {{incomeAmount}}. Pomyśl o małej, regularnej darowiźnie — hojność, jak każda cnota, z nawykiem przychodzi łatwiej.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '„{{goal}}” zostaje w tyle',
      message:
        'Potrzeba {{requiredAmount}} miesięcznie, a odkładasz około {{paceAmount}}. W tym tempie cel zostanie osiągnięty z opóźnieniem {{monthsLate}} mies. Tempo leży w Twojej mocy.',
    },
    {
      title: '„{{goal}}”: opóźnienie {{monthsLate}} mies. w tym tempie',
      message:
        'Potrzeba {{requiredAmount}} miesięcznie, w praktyce około {{paceAmount}}. Uczciwie przesuń termin albo świadomie przeznacz więcej pieniędzy.',
    },
    {
      title: 'Cel i tempo się rozmijają',
      message:
        '„{{goal}}” wymaga {{requiredAmount}} miesięcznie, a dostaje {{paceAmount}}. Cel jest tak realny, jak realny jest comiesięczny krok w jego stronę.',
    },
    {
      title: 'Cel „{{goal}}” potrzebuje pewniejszego kroku',
      message:
        '{{paceAmount}} miesięcznie wobec potrzebnych {{requiredAmount}}. W przyszłym miesiącu najpierw zapłać celowi, dopiero potem wszystkiemu, co opcjonalne.',
    },
    {
      title: 'Opóźnienie celu „{{goal}}”',
      message:
        'Obecne tempo ({{paceAmount}}/mies.) daje opóźnienie {{monthsLate}} mies. W Twojej mocy jest następny krok, nie cała droga.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '„{{goal}}” nie mieści się w planie',
      message:
        'Potrzeba {{requiredAmount}} miesięcznie, a po budżetach wolne jest tylko {{freeAmount}}. Zmień termin, kwotę albo budżety — nadzieja to nie plan.',
    },
    {
      title: '„{{goal}}” wymaga więcej, niż masz wolnego',
      message:
        'Wymagane {{requiredAmount}} co miesiąc, dostępne {{freeAmount}}. Kto chce wszystkiego naraz, nie osiąga niczego; wybieraj.',
    },
    {
      title: 'Liczby mówią „nie” — na razie',
      message:
        '„{{goal}}” wymaga {{requiredAmount}} miesięcznie; Twoje wolne środki to {{freeAmount}}. Zmień to, co od Ciebie zależy: termin albo inne limity.',
    },
    {
      title: 'Cel „{{goal}}” wymaga decyzji',
      message:
        'Przy {{requiredAmount}} miesięcznie przekracza on {{freeAmount}}, które zostaje po budżetach. Cel wybrany z otwartymi oczami jest lepszy od podtrzymywanego pobożnymi życzeniami.',
    },
    {
      title: 'Niemożliwe tempo dla „{{goal}}”',
      message:
        'Wymagane {{requiredAmount}} miesięcznie, wolne {{freeAmount}}. Uczciwa arytmetyka dziś oszczędzi rozczarowania jutro.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Saldo spadnie poniżej zera: {{date}}',
      message:
        'Przy obecnych dochodach i wydatkach prognozowane saldo spada do {{lowestAmount}}. Przygotuj się teraz, póki to tylko prognoza.',
    },
    {
      title: 'Nadchodzi niedobór: {{date}}',
      message:
        'Płatności i codzienne wydatki wyprzedzają wpływy, a saldo sięga dna na poziomie {{lowestAmount}}. Przewidywanie trudności odbiera im moc.',
    },
    {
      title: 'Zaplanuj datę: {{date}}',
      message:
        'Tego dnia prognozowane saldo dojdzie do {{lowestAmount}}. Przesunąć płatność, wstrzymać zachciankę albo odłożyć gotówkę — każde z tych jest dziś w Twojej mocy.',
    },
    {
      title: 'Prognoza spada poniżej zera',
      message:
        'Saldo spada do {{lowestAmount}} około {{date}}. Spokojną odpowiedzią jest ta wczesna.',
    },
    {
      title: 'Przewiduj lukę: {{date}}',
      message:
        'Prognozowane najniższe saldo: {{lowestAmount}}. To, co przewidziane, można przyjąć ze spokojem; to, co zaskakuje — rzadko.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Dotrzymujesz słowa danego sobie',
      message:
        'Już {{months}} mies. z rzędu wydatki mieszczą się w wyznaczonym przez siebie planie. Tak wygląda panowanie nad sobą.',
    },
    {
      title: 'W ramach planu: {{months}} mies.',
      message:
        'Miesiąc po miesiącu to, co zamierzasz, i to, co robisz, się zgadza. Wytrwałość jest cichsza od siły woli i trwa dłużej.',
    },
    {
      title: 'Plan i życie są zgodne',
      message:
        'W swoich granicach już {{months}} mies. z rzędu. Plan tak przestrzegany nie jest już ograniczeniem — jest sposobem życia.',
    },
    {
      title: 'Stabilnie: {{months}} mies.',
      message:
        'Twoje budżety trzymają się już {{months}} mies. z rzędu. Zachowaj tę samą uważność — działa.',
    },
    {
      title: 'Dyscyplina, która trwa',
      message:
        'Od {{months}} mies. nie łamiesz swojego planu. Mało co tak uwalnia jak zaufanie do własnych decyzji.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Pieniądze idą za Twoimi wartościami',
      message:
        'Pieniądze w służbie cnoty to {{actual}}% Twoich wydatków, nie mniej niż zaplanowane {{planned}}%. Dobrze wydane.',
    },
    {
      title: 'Cnota dostała pełną część',
      message:
        '{{actual}}% na zdrowie, naukę i innych przy planie {{planned}}%. To, co cenisz, zostało opłacone.',
    },
    {
      title: 'Wydane na rozwój',
      message:
        'Zdrowie, nauka i inni dostali {{actual}}% wydatków miesiąca (plan: {{planned}}%). Cnoty nie da się kupić, ale można jej służyć.',
    },
    {
      title: 'Zamiar spełniony',
      message:
        'Plan na cnotę: {{planned}}%, wydatki: {{actual}}%. Dobre zamiary rzadko przetrwają miesiąc — Twoje przetrwały.',
    },
    {
      title: 'Najlepszy użytek z pieniędzy',
      message: '{{actual}}% poszło na rozwój Twój i dobro innych. Wybieraj to dalej.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Rozrywka na swoim miejscu',
      message:
        'Rozrywka to {{actual}}% wydatków, poniżej przyznanych jej {{planned}}%. Cieszysz się rzeczami, nie dając się im rządzić.',
    },
    {
      title: 'Przyjemność w swoim rozmiarze',
      message:
        'Rozrywka zajęła {{actual}}% przy planie {{planned}}%. Umiar to nie przegapianie, lecz wybór.',
    },
    {
      title: 'Odpoczynek bez przesady',
      message:
        'Na rozrywkę {{actual}}%, poniżej Twojego limitu {{planned}}%. Radość smakuje lepiej, gdy nie rządzi.',
    },
    {
      title: 'Cichy umiar',
      message:
        'Rozrywka miała {{planned}}%, a wykorzystała tylko {{actual}}%. Ten zapas to zachowana wolność.',
    },
    {
      title: 'Rozrywka poniżej planu',
      message:
        'Rozrywka to {{actual}}% wydatków, poniżej ustalonych przez Ciebie {{planned}}%. Dobrze utrzymane.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '{{percent}}% poniżej planu',
      message:
        'Wydano o {{savedAmount}} mniej, niż pozwalał limit miesiąca. Nie potrzebować wszystkiego, na co Cię stać, to rodzaj bogactwa.',
    },
    {
      title: 'Niewydane: {{savedAmount}}',
      message:
        'Miesiąc zamknął się {{percent}}% poniżej planu. To, co nie zostało wydane, wciąż jest do Twojej dyspozycji.',
    },
    {
      title: 'Mniej, niż dopuszczał plan',
      message:
        'Wydatki są {{percent}}% poniżej planu — zostało {{savedAmount}}. Nadaj temu zapasowi cel, zanim zagarnie go nawyk.',
    },
    {
      title: 'Plan miał zapas',
      message:
        '{{savedAmount}} poniżej limitów miesiąca. Powściągliwość, która przychodzi łatwo, jest tą, która trwa.',
    },
    {
      title: 'Lżej, niż planowano',
      message:
        'Potrzeby okazały się o {{percent}}% mniejsze, niż zakładał budżet. Rozważ przekazanie {{savedAmount}} na cel.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '„{{goal}}” idzie zgodnie z harmonogramem',
      message:
        'Za Tobą {{percent}}% drogi, w tempie, jakiego cel potrzebuje. Równe kroki stawiane co miesiąc prowadzą daleko.',
    },
    {
      title: 'Cel „{{goal}}” na dobrej drodze',
      message:
        'Gotowe w {{percent}}% i tempo się utrzymuje. Dalej płać celowi w pierwszej kolejności — to działa.',
    },
    {
      title: '„{{goal}}”: {{percent}}% i równy krok',
      message: 'Cel co miesiąc dostaje to, czego potrzebuje. Cierpliwość robi swoje.',
    },
    {
      title: 'Cel idzie zgodnie z planem',
      message:
        'Cel „{{goal}}” jest sfinansowany w {{percent}}% i idzie na czas. Tego, co robi się po trochu co miesiąc, nie zatrzyma jeden gorszy tydzień.',
    },
    {
      title: 'Postęp, któremu można ufać',
      message:
        'Cel „{{goal}}” jest na poziomie {{percent}}%, zgodnie z tempem. Budujesz go jedynym skutecznym sposobem — stopniowo.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: 'Mniej zakupów pod wpływem impulsu: {{merchant}}',
      message:
        'Z {{before}} zakupów w miesiącu do około {{after}}. Poluzowany nawyk to zdobyta wolność.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'Bywasz tam rzadziej niż kiedyś. Każdy pominięty odruch to małe zwycięstwo wyboru nad nawykiem.',
    },
    {
      title: 'Drobny nawyk słabnie',
      message:
        '{{merchant}}: zakupy spadły z {{before}} do około {{after}}. Tak trzymaj — dalej będzie łatwiej.',
    },
    {
      title: 'Wybór zamiast odruchu',
      message:
        '{{merchant}}: zakupów było {{before}}, teraz około {{after}}. Tak buduje się panowanie nad sobą — decyzja po decyzji.',
    },
    {
      title: 'Mniej drobiazgów',
      message:
        '{{merchant}}: wizyty — około {{after}} zamiast {{before}}. Małe zwycięstwa się sumują.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Wydatki dopasowane do skromniejszego miesiąca',
      message:
        'Dochód spadł o {{incomePercent}}%, a wydatki zmalały o {{expensePercent}}%. Na zmianę losu odpowiedzią była zmiana kursu.',
    },
    {
      title: 'Spokój, gdy dochód spadł',
      message:
        'Dochód niższy o {{incomePercent}}%, wydatki niższe o {{expensePercent}}%. Wydatki poszły za tym, co jest, a nie za tym, co było.',
    },
    {
      title: 'Los się zmienił — Ty także',
      message:
        'Spadek dochodu o {{incomePercent}}% spotkał się ze spadkiem wydatków o {{expensePercent}}%. To równowaga ducha wyrażona w liczbach.',
    },
    {
      title: 'Dobrze poprowadzone',
      message:
        'Gdy dochód spadł o {{incomePercent}}%, wydatki poszły za nim (−{{expensePercent}}%). Wiatr nie był Twój; żagiel był.',
    },
    {
      title: 'Wydatki spadły za dochodem',
      message:
        'Wydatki zmalały o {{expensePercent}}%, gdy dochód spadł o {{incomePercent}}%. Wczesne dostosowanie to spokojna droga przez zmiany.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'Konieczność jest stabilna',
      message:
        'Od {{months}} mies. Twoje niezbędne koszty prawie się nie zmieniają. Stabilna podłoga daje wolność ponad nią.',
    },
    {
      title: 'Potrzeby pod kontrolą',
      message:
        'Wydatki na konieczność trzymają się jednego poziomu od {{months}} mies. Potrzeby, które nie rosną, to potrzeby, nad którymi panujesz.',
    },
    {
      title: 'Stabilna konieczność: {{months}} mies.',
      message:
        'Czynsz, jedzenie i rachunki zostały tam, gdzie były. Cicha stabilność też jest osiągnięciem.',
    },
    {
      title: 'Konieczność nie pełznie w górę',
      message:
        'Od {{months}} mies. bez dryfu w tym, czego wymaga życie. Na takim gruncie łatwiej planować wszystko inne.',
    },
    {
      title: 'Mocna podstawa',
      message:
        'Niezbędne wydatki są stabilne od {{months}} mies. Nie pozwalasz, by wygody udawały potrzeby.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Hojność wobec tego, co zarobione',
      message:
        'Przez {{months}} mies. {{percent}}% dochodu — {{givenAmount}} — poszło na pomoc innym. To pieniądze wykorzystane najlepiej, jak się da.',
    },
    {
      title: 'Oddane innym: {{givenAmount}}',
      message:
        'W ciągu {{months}} mies. {{percent}}% Twojego dochodu trafiło do innych. Życzliwość widoczna w liczbach to życzliwość praktykowana, nie tylko odczuwana.',
    },
    {
      title: 'Otwarte dłonie',
      message:
        'Dobroczynność i prezenty pochłonęły ostatnio {{percent}}% dochodu. To, co oddajesz, jest częścią bogactwa, której żadne nieszczęście nie odbierze.',
    },
    {
      title: 'Hojność jest częścią Twojego planu',
      message:
        'Dla innych przez {{months}} mies.: {{givenAmount}}. Tak trzymaj — dobro czynione innym jest dobrem czynionym także sobie.',
    },
    {
      title: 'Dobrze oddane',
      message:
        '{{percent}}% zarobków poszło na pomoc innym. Niewiele nawyków mówi więcej o człowieku.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Nie ma czego poprawiać',
      message: 'Twoje wydatki zgadzają się z Twoimi zamiarami. Tak trzymaj.',
    },
    {
      title: 'Zamiar i czyn są zgodne',
      message: 'Miesiąc wygląda tak, jak go zaplanowano. Ta zgodność jest całym sensem.',
    },
    {
      title: 'Spokojny miesiąc',
      message:
        'Ani nadmiaru, ani zaniedbań wartych wzmianki. Dobrze — nieś tę samą uważność dalej.',
    },
    {
      title: 'Wszystko w porządku',
      message: 'Plan wytrzymał i nic nie wymaga poprawek. Ciesz się zasłużonym spokojem.',
    },
    {
      title: 'Pewna ręka',
      message:
        'Miesiąc przebiegł zgodnie z Twoim planem. Dobre nawyki sprawiają, że dobre miesiące wyglądają zwyczajnie.',
    },
  ],
  'stoic.keep_first': [
    {
      title: 'Najpierw odłóż swoją część',
      message:
        'W ciągu {{months}} mies. zostało Ci {{savingsPercent}}% dochodów. Ostrzeżenie Seneki: za późno oszczędzać, gdy widać już dno beczki. Odłóż {{tenthAmount}} w dniu, w którym wpływa dochód.',
    },
    {
      title: 'Oszczędzaj od góry beczki',
      message:
        'Zostało Ci tylko {{savingsPercent}}% dochodów. Oszczędność, która czeka na resztki, przychodzi za późno; {{tenthAmount}} miesięcznie, odłożone jako pierwsze, zaczyna ją już teraz.',
    },
    {
      title: 'Zachowaj to, co naprawdę Twoje',
      message:
        'Seneka radzi strzec tego, co naprawdę nasze, i zaczynać wcześnie. Ostatnio zostaje Ci {{savingsPercent}}% dochodów; zacznij od {{tenthAmount}} w dniu wypłaty i pozwól, by wydatki dopasowały się do reszty.',
    },
    {
      title: 'Zacznij, zanim pojawi się osad',
      message:
        'Zostało Ci {{savingsPercent}}% w ciągu {{months}} mies. Oszczędzanie leży w Twojej mocy tylko dopóki jest jeszcze coś do odłożenia: odsuń {{tenthAmount}} przed czymkolwiek innym.',
    },
    {
      title: 'Zostało {{savingsPercent}}%, a beczka się opróżnia',
      message:
        '{{tenthAmount}} miesięcznie, jedna dziesiąta dochodu, odłożona przed jakimkolwiek rachunkiem. To, co odkładasz najpierw, nie zależy od tego, co zostawi miesiąc.',
    },
  ],
  'stoic.prepare_beforehand': [
    {
      title: 'Przygotuj się w spokojnym czasie',
      message:
        'Twoja rezerwa pokrywa około {{cushionDays}} dni wydatków. Seneka: dusza powinna hartować się w czasach wolnych od trosk. Trzy miesiące wydatków to {{targetAmount}}.',
    },
    {
      title: 'Rezerwa na {{cushionDays}} dni',
      message:
        'Fortuna nie zapowiada się z wyprzedzeniem. Dąż do {{targetAmount}}, czyli trzech miesięcy wydatków, póki nic nie naciska: wtedy jest łatwo.',
    },
    {
      title: '„Czy tego właśnie się bałem?”',
      message:
        'Seneka kazał Lucyliuszowi ćwiczyć ubóstwo, by straciło swój postrach. Przy rezerwie na {{cushionDays}} dni jeden ciężki miesiąc nie byłby ćwiczeniem. Dąż do {{targetAmount}}.',
    },
    {
      title: 'Przewidź trudny miesiąc',
      message:
        'Twoje oszczędności wystarczyłyby mniej więcej na {{cushionDays}} dni. To, co przewidziane, przychodzi łagodnie; {{targetAmount}} utrzymałoby Cię przez trzy miesiące.',
    },
    {
      title: 'Zbuduj mur przed burzą',
      message:
        'Pokryte jest około {{cushionDays}} dni. Utrata dochodu nie leży w Twojej mocy; rezerwa tak. Trzy miesiące wydatków to {{targetAmount}}.',
    },
  ],
  'stoic.wants_outrun_income': [
    {
      title: 'Pragnienia wyprzedzają dochód',
      message:
        'Wydatki wzrosły o {{expenseGrowth}}% w ostatnim kwartale, a dochód zmienił się o {{incomeGrowth}}%. Ubogi, pisze Seneka, nie jest ten, kto ma za mało, lecz ten, kto pragnie więcej.',
    },
    {
      title: 'Żyć wyżej, nie lepiej',
      message:
        'Wydatki wzrosły o {{expenseGrowth}}%, dochód o {{incomeGrowth}}%. Potrzeby natury są niewielkie, żądania opinii nie mają granic. Zapytaj, któremu z nich służy ten wzrost.',
    },
    {
      title: 'Pragnienia urosły: +{{expenseGrowth}}%',
      message:
        'Wydatki rosły szybciej niż dochód ({{incomeGrowth}}%). Nowa wygoda szybko zaczyna wyglądać na potrzebę: zauważ ją, póki jeszcze możesz jej odmówić.',
    },
    {
      title: 'Granica się przesuwa',
      message:
        'Wydatki wzrosły o {{expenseGrowth}}% kwartał do kwartału, dochód o {{incomeGrowth}}%. Dość pozostaje dość tylko wtedy, gdy sam zdecydujesz, ile to jest.',
    },
    {
      title: 'Więcej to nie lekarstwo',
      message:
        'W ostatnim kwartale wydatki wzrosły o {{expenseGrowth}}%, a dochód o {{incomeGrowth}}%. Bogactwo rosnące razem z pragnieniem nigdy nie nadchodzi; wyznacz granicę, zanim to stanie się nową normą.',
    },
  ],
  'stoic.price_in_life': [
    {
      title: '{{merchant}} kosztował Cię {{hours}} godz. życia',
      message:
        'Seneka przypomina, że tylko czas jest naprawdę nasz. {{totalAmount}} wydane w {{merchant}} to około {{hours}} godz. Twojej pracy. Czy było warto?',
    },
    {
      title: '{{hours}} godz. w {{merchant}}',
      message:
        'Pilnujemy pieniędzy, a czas rozdajemy. Przy Twoim przeciętnym dochodzie godzinowym {{totalAmount}} wydane tam to mniej więcej {{hours}} godz. pracy.',
    },
    {
      title: 'Wyceń to w godzinach',
      message:
        '{{totalAmount}} wydane w {{merchant}} to około {{hours}} godz. pracy. Godzin jako jedynych nie da się odzyskać.',
    },
    {
      title: 'Ile naprawdę kosztował {{merchant}}',
      message:
        'Wymieniasz dni na pieniądze, a pieniądze na rzeczy. {{merchant}} zabrał około {{hours}} Twoich godzin ({{totalAmount}}). Czy przyjemność jest warta tych godzin?',
    },
    {
      title: 'Zważ godziny',
      message:
        'Przeliczone według Twojego przeciętnego dochodu godzinowego, {{totalAmount}} wydane w {{merchant}} to około {{hours}} godz. Tracimy bardzo wiele czasu, pisze Seneka. Czy to był Twój wybór?',
    },
  ],
  'stoic.rule_broken': [
    {
      title: 'Reguła „{{rule}}” zgubiła drogę',
      message:
        'Wskazuje na coś, czego już nie ma, więc po cichu przestała działać. Napraw ją albo usuń: porządek, który nic nie robi, tylko udaje porządek.',
    },
    {
      title: '„{{rule}}” już nie działa',
      message:
        'Jej kategoria, konto lub odbiorca zniknęły, a reguła jest teraz pomijana przy każdej transakcji. Zobacz rzeczy takimi, jakie są, a potem je popraw.',
    },
    {
      title: 'Reguła wycelowana w nic',
      message:
        '„{{rule}}” kieruje transakcje w miejsce, które usunięto. Kiedyś coś postanowiono; zdecyduj jeszcze raz, teraz, gdy rzeczy się zmieniły.',
    },
    {
      title: '„{{rule}}” potrzebuje Twojego osądu',
      message:
        'To, do czego się odnosi, zostało usunięte, a transakcje, które kiedyś przypisywała, czekają teraz na Ciebie. Daj jej nowy cel albo pozwól jej odejść.',
    },
    {
      title: 'Zepsuta reguła, w milczeniu',
      message:
        '„{{rule}}” nic nie robi i nic o tym nie mówi. Napraw to, co leży w Twojej mocy: zajmie to minutę.',
    },
  ],
  'stoic.rule_contradicted': [
    {
      title: 'Twoja ręka nie zgadza się z „{{rule}}”',
      message:
        '{{count}} razy ręcznie przypisano gdzie indziej to, co ta reguła kieruje inaczej. Albo reguła się myli, albo ręka: rozstrzygnij, co z tych dwojga.',
    },
    {
      title: '„{{rule}}” została przegłosowana {{count}} razy',
      message:
        'Reguła, którą ciągle poprawiasz, nie jest już decyzją, lecz nawykiem sporu z samym sobą. Zmień ją albo jej zaufaj.',
    },
    {
      title: 'Mów, co robisz, rób, co mówisz',
      message:
        'Reguła „{{rule}}” mówi jedno, Twoje ostatnie poprawki ({{count}}) mówią co innego. Doprowadź jedno do zgodności z drugim.',
    },
    {
      title: 'Decyzja sporna',
      message:
        'Regułę „{{rule}}” ustawiono na chłodno, a {{count}} transakcji poszło potem inną drogą. Spójrz jeszcze raz, spokojnie, kto miał rację: reguła czy Ty.',
    },
    {
      title: '{{count}} poprawek wbrew „{{rule}}”',
      message: 'Powtarzanie jest informacją. Niech zmieni regułę, albo niech reguła zmieni nawyk.',
    },
  ],
  'stoic.rule_worth_writing': [
    {
      title: 'Zdecyduj raz w sprawie: {{payee}}',
      message:
        'Odbiorca {{payee}} był przypisywany ręcznie {{decided}} razy, zawsze tak samo. Co rozstrzygasz raz po raz, rozstrzygnij raz, na chłodno.',
    },
    {
      title: 'Decyzja podjęta {{decided}} razy',
      message:
        '{{payee}} wciąż zadaje to samo pytanie, a Ty wciąż dajesz tę samą odpowiedź. Reguła zachowa Twoją uwagę dla tego, co naprawdę jej wymaga.',
    },
    {
      title: 'Odbiorcy gotowi na regułę: {{count}}',
      message:
        'Ci sami odbiorcy dostają od Ciebie tę samą kategorię, najczęściej {{payee}}. Oszczędzaj osąd na to, co nowe.',
    },
    {
      title: 'Twój nawyk jest gotów zostać zasadą',
      message:
        'Odbiorcę {{payee}} przypisujesz za każdym razem tak samo (jak dotąd {{decided}} razy). Zapisz to jako regułę, a utrzyma się bez wysiłku.',
    },
    {
      title: 'Niech niesie to reguła',
      message:
        'Odbiorcy przypisywani zawsze tak samo: {{count}}, w tym {{payee}} z {{decided}} transakcjami. Zasady raz ustalonej nie trzeba bronić na nowo.',
    },
  ],
  'stoic.rule_idle': [
    {
      title: '„{{rule}}” nie spotkała niczego od {{months}} mies.',
      message:
        'Albo świat, dla którego ją stworzono, przeminął, albo jej warunki chybiają celu. Dbaj o prawdziwość swoich reguł: popraw ją albo usuń.',
    },
    {
      title: 'Reguła w spoczynku: „{{rule}}”',
      message:
        'Od {{months}} mies. nie dotknęła żadnej transakcji. Odrzuć to, co zbędne; temu, co zostanie, łatwiej będzie zaufać.',
    },
    {
      title: '„{{rule}}” stoi bezczynnie',
      message:
        '{{months}} mies. bez dopasowania, podczas gdy nowe transakcje wciąż napływają. Wypróbuj ją na ostatnich, potem zdecyduj.',
    },
    {
      title: 'Czy „{{rule}}” jest jeszcze potrzebna?',
      message:
        'Od {{months}} mies. nic do niej nie pasuje. Reguła trzymana z przyzwyczajenia to jeszcze jedna rzecz do pilnowania.',
    },
    {
      title: 'Decyzja, której nie ma czym rozstrzygać',
      message:
        '„{{rule}}” milczy od {{months}} mies. Porządek polega na tym, by mieć to, czego potrzeba, i tylko to.',
    },
  ],
  'stoic.praise_rules_hold': [
    {
      title: 'Twoje decyzje się trzymają',
      message:
        'Reguły przypisały {{percent}}% transakcji miesiąca, i żadna nie wymagała Twojej poprawki. Decyzja podjęta raz i dotrzymana wyzwala umysł.',
    },
    {
      title: '{{percent}}% rozstrzygnięte z góry',
      message:
        'Większość transakcji miesiąca przypisano według wcześniejszych postanowień. To uwaga oszczędzona na to, co ważne.',
    },
    {
      title: 'Zasady przy pracy',
      message:
        'Twoje reguły obsłużyły {{percent}}% transakcji bez sporu. Ustalone zasady dają spokojne dni.',
    },
    {
      title: 'Mniej do rozstrzygania',
      message:
        '{{percent}}% transakcji nie wymagało nowej decyzji. Osąd wydany raz, dobrze, wciąż stoi.',
    },
    {
      title: 'Porządek zachowany',
      message:
        'Reguły przypisały {{percent}}% miesiąca i żadna nie została zakwestionowana. Dobry porządek wygląda tak, jakby nic się nie działo.',
    },
  ],
  'stoic.goal_no_date': [
    {
      title: '„{{goal}}” nie ma daty',
      message:
        'Stoi na {{percent}}%, a nic do niej nie wpływa. Kto nie wie, do jakiego portu płynie, dla tego żaden wiatr nie jest pomyślny: nazwij dzień, w którym zamierzasz dotrzeć.',
    },
    {
      title: 'Życzenie czy cel?',
      message:
        '„{{goal}}” nie ma terminu ani tempa. Cel to decyzja z datą; nadaj mu ją albo odpuść.',
    },
    {
      title: 'Nazwij dzień dla „{{goal}}”',
      message:
        'Jest na {{percent}}% drogi i stoi w miejscu. To, co można zrobić w każdej chwili, rzadko bywa zrobione.',
    },
    {
      title: '„{{goal}}” czeka na „kiedyś”',
      message:
        'Ostatnio nic do niego nie trafiło, a żadna data niczego nie żąda. „Kiedyś” nie ma miejsca w kalendarzu; wybierz dzień, który ma.',
    },
    {
      title: '„{{goal}}” nie ma portu',
      message:
        '{{percent}}% i brak terminu. Wiedz, dokąd płyniesz, a miesięczny krok przyjdzie sam.',
    },
  ],
};
