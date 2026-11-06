import type { StoicTextMap } from './types';

export const is: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'Mánuðurinn vex út fyrir áætlun sína',
      message:
        'Þú áætlaðir {{plannedAmount}} og hefur eytt {{spentAmount}} — {{percent}} % meira. Áætlunin var gerð með skýrum huga; láttu hana tala hærra en augnablikið.',
    },
    {
      title: '{{percent}} % fram úr því sem þú ætlaðir að eyða',
      message:
        'Eyðslan stendur í {{spentAmount}} á móti áætlun um {{plannedAmount}}. Skoðaðu hvaða mark lét undan fyrst — þar er lexían.',
    },
    {
      title: 'Áætlun þín og mánuðurinn eru ósamhljóða',
      message:
        '{{spentAmount}} eytt, {{plannedAmount}} ætlað. Annaðhvort krafðist áætlunin of lítils af raunveruleikanum eða raunveruleikinn of mikils af þér — ákveddu í ró hvort.',
    },
    {
      title: 'Meira fór út en þú heimilaðir',
      message:
        'Mánuðurinn er {{percent}} % yfir þeim {{plannedAmount}} sem þú settir. Ekkert tapast með því að stöðva nú; margt tapast við að láta sem það hafi ekki gerst.',
    },
    {
      title: 'Mark sem þú settir, mark sem þú fórst yfir',
      message:
        'Þú ætlaðir að eyða {{plannedAmount}}; það er {{spentAmount}}. Sjálfsstjórn er ekki að hrasa aldrei — hún er að taka eftir í tíma og snúa aftur á leiðina.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Afþreying tekur meira en þú áætlaðir',
      message:
        'Þú ætlaðir afþreyingu {{planned}} % af eyðslunni; hún varð {{actual}} %. Nautn er velkomin sem gestur, ekki sem húsbóndi.',
    },
    {
      title: 'Afþreying {{actual}} %, áætlað {{planned}} %',
      message:
        'Hvíld á sinn stað þegar hún endurnærir. Spyrðu hverjar nautnir mánaðarins gerðu það og slepptu hinum án eftirsjár.',
    },
    {
      title: 'Þægindin eyða meiru en ætlunin',
      message:
        'Afþreying heldur {{actual}} % af eyðslunni á móti þeim {{planned}} % sem þú valdir. Hófsemi er ekki að afneita nautn — hún er að halda henni í þeirri stærð sem þú ákvaðst.',
    },
    {
      title: 'Hið notalega ryður því áætlaða úr vegi',
      message:
        'Þú gafst afþreyingu {{planned}} % af áætluninni og hún tók {{actual}} %. Það sem þú nýtur áreynslulaust er þess virði að skoða aftur áður en það verður það sem þú þarft.',
    },
    {
      title: 'Afþreyingin hefur stigið yfir línuna',
      message:
        '{{actual}} % af mánuðinum fór í afþreyingu, {{planned}} % var ætlunin. Línan var þín að draga og hún er þín að halda.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Afþreying yfir áætlun á nýjan leik',
      message:
        'Afþreying fór fram úr áætlun þinni í {{months}} af síðustu {{window}} mánuðum. Endurtekning er ekki lengur óhapp — hún er vani sem er þess verður að skoða.',
    },
    {
      title: '{{months}} af {{window}} mánuðum yfir afþreyingaráætlun',
      message:
        'Það sem gerist einu sinni er aðstæður; það sem gerist {{months}} sinnum er skapgerð í mótun. Veldu skapgerðina viljandi.',
    },
    {
      title: 'Sama misstigið, mánuð eftir mánuð',
      message:
        'Afþreying fór fram úr áætlun í {{months}} af {{window}} mánuðum. Lyftu áætluninni heiðarlega eða breyttu vananum — að búa milli þeirra kostar mest.',
    },
    {
      title: 'Mynstur, ekki undantekning',
      message:
        'Í {{months}} af síðustu {{window}} mánuðum tók afþreying meira en þú gafst henni. Taktu eftir augnablikinu þegar ákvörðunin er tekin, ekki aðeins reikningnum á eftir.',
    },
    {
      title: 'Vaninn kýs gegn áætlun þinni',
      message:
        'Afþreying sigraði áætlunina {{months}} sinnum á {{window}} mánuðum. Vanar byggjast upp eitt val í einu; eins eru þeir brotnir niður.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'Dygð fær minna en þú ætlaðir',
      message:
        'Þú tókst {{planned}} % af áætluninni til hliðar fyrir heilsu, lærdóm og annað; það varð {{actual}} %. Ætlun gildir þegar hún er framkvæmd.',
    },
    {
      title: 'Dygð í {{actual}} % af áætluðum {{planned}} %',
      message:
        'Peningarnir sem þú ætlaðir í það sem gerir þig betri bíða enn. Það er enginn betri tími til að nýta þá vel en núna.',
    },
    {
      title: 'Hið góða sem þú áætlaðir er óeytt',
      message:
        'Heilsa, lærdómur og gjafmildi áttu að fá {{planned}} % af eyðslunni; þau fengu {{actual}} %. Gerðu eitt af þeim í þessari viku, með vilja.',
    },
    {
      title: 'Ætlun án athafnar',
      message:
        'Dygð heldur {{actual}} % af eyðslunni á móti þeim {{planned}} % sem þú valdir. Það sem við metum sýnir sig í því sem við greiðum raunverulega fyrir.',
    },
    {
      title: 'Rúm er eftir fyrir það sem skiptir máli',
      message:
        'Aðeins {{actual}} % fóru í dygð, þótt þú áætlaðir {{planned}} %. Bók, heilsufarsskoðun, gjöf til þess sem þarf — áætlunin hefur þegar sagt já.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'Dygð er áfram sett á bið',
      message:
        'Eyðsla í heilsu, lærdóm og aðra hefur verið undir áætlun þinni {{months}} mánuði í röð. Það sem þú heldur áfram að fresta hefur þú í raun ákveðið gegn.',
    },
    {
      title: '{{months}} mánuðir af frestaðri dygð',
      message:
        'Hvern mánuð skildi áætlunin rúm fyrir það sem gerir þig betri og hvern mánuð var það ónotað. Tími er það eina sem ekki er unnt að áætla tvisvar.',
    },
    {
      title: 'Betra sjálfið bíður enn',
      message:
        'Dygð hefur verið undir áætlun {{months}} mánuði í röð. Byrjaðu lítið og víst fremur en stórt og síðar.',
    },
    {
      title: 'Góðar ætlanir eldast',
      message:
        'Í {{months}} mánuði fengu heilsa, lærdómur og gjafmildi minna en þú áætlaðir. Veldu eitt og fjármagnaðu það fyrst í næsta mánuði, fyrir öllu öðru.',
    },
    {
      title: 'Dygð tapar stöðugt fyrir „síðar“',
      message:
        '{{months}} mánuðir í röð undir áætlun. Síðar er staðurinn þar sem góðar ætlanir fara til að gleymast — gefðu þessari dagsetningu.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'Áætlunin þín hefur ekkert rúm fyrir dygð',
      message:
        'Engin af fjárhagsáætlunum þínum þjónar heilsu, lærdómi eða öðrum. Áætlun sýnir hvað við metum — hugleiddu að gefa dygð sína eigin línu.',
    },
    {
      title: 'Allar áætlanir, en engin fyrir hið góða',
      message:
        'Nauðsyn, vinna og afþreying hafa öll mörk; dygð hefur engin. Það sem aldrei er áætlað hefur tilhneigingu til að aldrei gerast.',
    },
    {
      title: 'Áætlaðu fyrir því sem gerir þig betri',
      message:
        'Það er engin fjárhagsáætlun í dygðarflokki enn. Jafnvel lítil — bækur, hreyfing, framlag — breytir ósk í skuldbindingu.',
    },
    {
      title: 'Áætlunin þegir um dygð',
      message:
        'Þú áætlar fyrir því sem þú verður að og því sem þú nýtur, ekki enn fyrir þeim sem þú vilt verða. Ein hógvær dygðaráætlun myndi breyta því.',
    },
    {
      title: 'Dygð hefur engin áætlun',
      message:
        'Eyðsla í heilsu, lærdóm eða aðra er ekki áætluð nokkurs staðar. Veldu eitt og gefðu því mark sem þú værir glaður að ná.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'Nauðsynjar kosta meira en áætlað',
      message:
        'Þú áætlaðir {{planned}} % af eyðslunni í nauðsynjar; þær taka {{actual}} %. Athugaðu hvort hver þeirra er enn þörf eða hefur hljóðlega orðið þægindi.',
    },
    {
      title: 'Nauðsyn í {{actual}} %, áætlað {{planned}} %',
      message:
        'Það sem lífið krefst er venjulega minna en það sem við vöndumst. Farðu yfir stærstu nauðsynina með ferskum augum.',
    },
    {
      title: 'Hið nauðsynlega þrútnar',
      message:
        'Nauðsynjar halda {{actual}} % af mánuðinum á móti þeim {{planned}} % sem þú vænti. Þörf sem heldur áfram að vaxa á spurningu skilið.',
    },
    {
      title: 'Þarfirnar vaxa út fyrir áætlunina',
      message:
        'Áætlað {{planned}} %, raunverulegt {{actual}} %. Annaðhvort vanmat áætlunin raunkostnað, eða einhverjar langanir ferðast undir nafni þarfa.',
    },
    {
      title: 'Meira eytt í „verður“ en ætlað',
      message:
        'Nauðsynjar tóku {{actual}} % af eyðslunni í stað {{planned}} %. Skildu það sem verður að vera frá því sem einfaldlega hefur alltaf verið.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'Nauðsynjar skríða upp',
      message:
        'Eyðsla í nauðsynjar hefur aukist {{months}} mánuði í röð, {{percent}} % í heild. Þarfir vaxa hljóðlega þegar engin biður þær að réttlæta sig.',
    },
    {
      title: '+{{percent}} % í nauðsynjum á {{months}} mánuðum',
      message:
        'Hvert skref virtist lítið; saman eru þau ekki. Tak stærstu endurteknu nauðsynina og spyrðu hvort hún þurfi enn að kosta svo mikið.',
    },
    {
      title: 'Gólfið í eyðslunni þinni hækkar',
      message:
        'Nauðsynjar jukust {{months}} mánuði í röð (+{{percent}} %). Hækkandi gólf skilur minna rúm eftir fyrir allt sem þú velur frjálst.',
    },
    {
      title: 'Þarfirnar víkka',
      message:
        '{{months}} mánuðir af vexti, {{percent}} % í heild. Stóíska prófið er einfalt: myndir þú velja þetta aftur í dag, með verðið þekkt?',
    },
    {
      title: 'Litlar aukningar, stöðug stefna',
      message:
        'Nauðsynjar eru upp {{percent}} % á {{months}} mánuðum. Stefnan skiptir meira máli en einstakur mánuður — þessa er vert að leiðrétta í tíma.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'Vinna kostar meira en áætlað',
      message:
        'Þú áætlaðir {{planned}} % af eyðslunni í vinnu; hún tekur {{actual}} %. Verkfæri og þjónusta þurfa að vinna fyrir sér — athugaðu hvað gerir það.',
    },
    {
      title: 'Vinnueyðsla í {{actual}} %, áætlað {{planned}} %',
      message:
        'Fjárfesting í starfinu er góð þegar hún skilar einhverju. Farðu yfir það sem þú greiðir fyrir en notar ekki lengur.',
    },
    {
      title: 'Vinnuáætlunin er þanin',
      message:
        'Vinna tók {{actual}} % í stað {{planned}} %. Iðni er að gera verkið vel, ekki að kaupa hvert verkfæri til þess.',
    },
    {
      title: 'Verkfæri eyða fram úr áætluninni',
      message:
        'Áætlað {{planned}} %, eytt {{actual}} % í vinnu. Spyrðu hvern kostnað: hjálpar hann mér að gera verkið, eða líður hann bara eins og framför?',
    },
    {
      title: 'Vinnukostnaður hefur skriðið',
      message:
        'Vinna heldur {{actual}} % af eyðslunni á móti {{planned}} % ætluðum. Snögg endurskoðun nú sparar stærri síðar.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '„{{category}}“ brýtur mark sitt hvað eftir annað',
      message:
        '„{{category}}“ fór yfir áætlun í {{months}} af síðustu {{window}} mánuðum. Annaðhvort er markið rangt eða löngunin — ákveddu hvort.',
    },
    {
      title: '„{{category}}“: yfir áætlun {{months}} af {{window}} mánuðum',
      message:
        'Mark sem alltaf er farið yfir er ekki mark, aðeins ósk. Gerðu það heiðarlegt — hækkaðu það viljandi eða haltu því viljandi.',
    },
    {
      title: 'Sama áætlun lætur undan aftur',
      message:
        '„{{category}}“ hefur farið yfir mark sitt {{months}} sinnum á {{window}} mánuðum. Endurtekningin er upplýsing; notaðu hana.',
    },
    {
      title: '„{{category}}“ biður um athygli þína',
      message:
        'Yfir áætlun í {{months}} af {{window}} mánuðum. Fylgstu með augnablikinu fyrir kaupin — það er eini staðurinn þar sem vananum má breyta.',
    },
    {
      title: 'Mynstur í „{{category}}“',
      message:
        '{{months}} umframeyðslur á {{window}} mánuðum. Það sem við endurtökum verðum við; ákveddu hvað þú vilt að þessi flokkur segi um þig.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '„{{category}}“ tæmist um dag {{day}}',
      message:
        'Þú hefur eytt {{spentAmount}} af {{limitAmount}}, og á þessum hraða endar markið um dag {{day}}. Að hægja nú er léttara en að stöðva síðar.',
    },
    {
      title: '„{{category}}“ er á undan mánuðinum',
      message:
        '{{spentAmount}} er þegar farið af marki {{limitAmount}}. Á þessum hraða er það uppurið um dag {{day}} — það sem eftir er af mánuðinum er samt þitt að móta.',
    },
    {
      title: 'Hraðaskoðun: „{{category}}“',
      message:
        'Áætlunin um {{limitAmount}} heldur til um dag {{day}} á núverandi hraða. Forsjálni er ódýrasta tegund sjálfsstjórnar.',
    },
    {
      title: '„{{category}}“ eyðir framtíðinni',
      message:
        '{{spentAmount}} af {{limitAmount}} eytt; markið endar nær dag {{day}}. Það sem þú gerir í þessari viku ákveður hvort það gerist.',
    },
    {
      title: 'Snemmbúin viðvörun fyrir „{{category}}“',
      message:
        'Á núverandi hraða nær markið {{limitAmount}} ekki mánaðarlokum — það tæmist um dag {{day}}. Stilltu af á meðan það kostar lítið.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '„{{category}}“ hefur verið ónotað',
      message:
        'Áætlunin fyrir „{{category}}“ hefur ekki séð eyðslu í {{months}} mánuði. Annaðhvort hefur þú vaxið upp úr henni, eða hún er ætlun sem bíður enn — ákveddu hvort.',
    },
    {
      title: 'Tóm áætlun: „{{category}}“',
      message:
        '{{months}} mánuðir án eins einasta kostnaðar. Áætlun ætti að lýsa því lífi sem þú lifir eða því sem þú byggir — hvort er þetta?',
    },
    {
      title: '„{{category}}“ stendur ónotað',
      message:
        'Ekkert eytt hér í {{months}} mánuði. Var það sjálfsstilling, vel gert; var það vanræksla, gerðu eitthvað í því.',
    },
    {
      title: 'Áætlað, en ekki lifað',
      message:
        '„{{category}}“ hefur haft mark og enga eyðslu í {{months}} mánuði. Haltu áætluninni sannri: fjarlægðu hana eða notaðu hana.',
    },
    {
      title: '„{{category}}“: {{months}} hljóðir mánuðir',
      message:
        'Áætlun sem aldrei er hreyft við tekur samt sæti í áætlun þinni. Losaðu sætið eða heiðraðu ætlunina.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}} % af eyðslunni hefur ekkert mark',
      message:
        '{{unbudgetedAmount}} af mánuðinum fóru í flokka sem engin áætlun fylgist með. Það sem þú hefur ekki skoðað getur þú ekki dæmt um.',
    },
    {
      title: 'Mikið af mánuðinum er óáætlað',
      message:
        '{{percent}} % af eyðslunni — {{unbudgetedAmount}} — liggja utan allra áætlana. Gefðu stærsta hluta hennar mark og áætlunin mun sjá meira af lífi þínu.',
    },
    {
      title: 'Eyðsla utan áætlunar',
      message:
        'Áætlanir ná aðeins yfir hluta þess sem þú eyðir; {{unbudgetedAmount}} ({{percent}} %) verða ómæld. Víkkaðu áætlunina þangað sem peningarnir fara raunverulega.',
    },
    {
      title: 'Áætlunin sér aðeins hluta myndarinnar',
      message:
        '{{percent}} % af eyðslu mánaðarins hafa enga áætlun. Skýr sýn kemur á undan góðri dómgreind.',
    },
    {
      title: '{{unbudgetedAmount}} eytt án marks',
      message:
        'Það eru {{percent}} % af mánuðinum. Þú þarft ekki að skerða það — aðeins að ákveða hve mikið af því þú vilt í raun.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '„{{category}}“ er flest af afþreyingu þinni',
      message:
        '{{percent}} % af afþreyingareyðslunni fóru í „{{category}}“. Njóttu þess, en athugaðu að þú gætir gengið frá því.',
    },
    {
      title: 'Ein nautn ræður',
      message:
        '„{{category}}“ tekur {{percent}} % af öllu sem þú eyddir í afþreyingu. Spyrðu hvort hún gleðji þig enn eða sé orðin að rútínu.',
    },
    {
      title: 'Afþreying hallar sér að „{{category}}“',
      message:
        '{{percent}} % af afþreyingu á einum stað. Það sem við getum ekki verið án hefur tak á okkur — athugaðu að takið sé enn laust.',
    },
    {
      title: '„{{category}}“: {{percent}} % af afþreyingu',
      message:
        'Ein uppspretta ánægju tekur næstum allt. Farðu án hennar um stund og sjáðu hvað hún gefur þér í raun.',
    },
    {
      title: 'Hvíldin þín hefur eitt heimilisfang',
      message:
        'Mest af afþreyingarfénu, {{percent}} %, fer í „{{category}}“. Þú ert frjáls af nautn aðeins ef þú gætir verið án hennar.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Sumri eyðslu hefur ekki enn verið mætt',
      message:
        '{{count}} flokkar hafa engan flokk. Ákveddu í Fjárhagsáætlunum hvað er nauðsyn, vinna, dygð eða afþreying.',
    },
    {
      title: '{{count}} flokkar bíða dóms þíns',
      message:
        'Þeir hafa eyðslu en engan flokk, svo ráðin geta ekki vegið þá. Ein mínúta í Fjárhagsáætlunum leysir það.',
    },
    {
      title: 'Nefndu það sem peningarnir þjóna',
      message:
        '{{count}} flokkar eru enn óflokkaðir. Dómgreind byrjar með því að kalla hluti réttum nöfnum.',
    },
    {
      title: 'Ómetin eyðsla: {{count}} flokkar',
      message:
        'Er það þörf, starf þitt, dygð eða nautn? Aðeins þú getur sagt það — og áætlunin skýrist þegar þú gerir það.',
    },
    {
      title: 'Nokkrir flokkar hafa engan flokk',
      message:
        '{{count}} flokkar eru utan fjögurra flokkanna. Flokkaðu þá í Fjárhagsáætlunum svo hver kostnaður sé séður eins og hann er.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: '{{count}} lítil kaup hjá {{merchant}}',
      message:
        'Hver kaup virtust léttvæg; saman urðu þau {{totalAmount}} á mánuðinum. Litlir, órannsakaðir vanar eru þar sem mest af peningunum hverfur hljóðlega.',
    },
    {
      title: '{{merchant}}: {{count}} sinnum á mánuði',
      message:
        '{{totalAmount}} í litlum upphæðum. Spyrðu hvort hver heimsókn var val eða viðbragð: aðeins hið fyrra er frelsi.',
    },
    {
      title: 'Smátt og smátt: {{totalAmount}}',
      message:
        '{{count}} kaup hjá {{merchant}}. Ekkert eitt skiptir máli; vaninn gerir það. Ákveddu hve oft þú vilt það í raun.',
    },
    {
      title: 'Vani hjá {{merchant}}',
      message:
        '{{count}} kaup, samtals {{totalAmount}}. Reyndu að sleppa einum af hverjum þremur og sjáðu hvort þú saknar þess.',
    },
    {
      title: 'Smáhlutirnir leggjast saman',
      message:
        '{{merchant}} sá þig {{count}} sinnum, fyrir {{totalAmount}}. Tök á stórum ákvörðunum byggjast á smáum eins og þessum.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Helgar bera {{percent}} % af afþreyingu',
      message:
        'Flest afþreyingareyðsla þín verður á laugardögum og sunnudögum. Hvíld er góð; athugaðu að hún sé hvíld og ekki uppbót fyrir vikuna.',
    },
    {
      title: 'Afþreyingin lifir á helginni',
      message:
        '{{percent}} % af afþreyingareyðslu fellur á helgar. Áætlaðu helgina örlítið og hún mun kosta minna og gefa meira.',
    },
    {
      title: 'Helgin eyðir fyrir vikuna',
      message:
        'Helgar taka {{percent}} % af því sem þú eyðir í afþreyingu. Ef vikan þarf að lagfærast hvern laugardag, skoðaðu vikuna.',
    },
    {
      title: 'Laugardagur og sunnudagur: {{percent}} % af afþreyingu',
      message:
        'Frídagar bjóða upp á frjálsa eyðslu. Ákveddu fyrir helgina til hvers hún er og láttu peningana fylgja.',
    },
    {
      title: 'Helgarmynstur',
      message:
        '{{percent}} % af afþreyingareyðslu verður á helgum. Léttari virkir dagar gera helgar oft ódýrari.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} tók {{percent}} % af mánuðinum',
      message:
        '{{totalAmount}} fóru til eins seljanda í afþreyingu. Þegar einn staður hefur svo mikið af peningum þínum, spyrðu hve mikið af athygli þinni hann hafi líka.',
    },
    {
      title: 'Einn staður, {{totalAmount}}',
      message:
        '{{merchant}} er {{percent}} % af eyðslu mánaðarins. Er það þess virði að leggja svo stóran hluta ævistarfs þíns í?',
    },
    {
      title: '{{merchant}} leiðir eyðslu þína',
      message:
        '{{percent}} % af mánuðinum — {{totalAmount}} — fóru þangað. Ekkert athugavert við að njóta þess, svo lengi sem þú myndir velja það aftur.',
    },
    {
      title: 'Stór hlutur hjá {{merchant}}',
      message:
        '{{totalAmount}}, eða {{percent}} % af eyðslunni, á einum afþreyingarstað. Vegðu nautnina á móti verðinu, í ró.',
    },
    {
      title: '{{percent}} % hjá {{merchant}}',
      message:
        'Þessi eini seljandi tók {{totalAmount}}. Frelsi er að geta gengið fram hjá þegar þú velur það.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Tekjur lækkuðu, eyðslan ekki',
      message:
        'Tekjur lækkuðu {{percent}} % í {{incomeAmount}}, en eyðslan stóð í {{expenseAmount}}. Gæfan skipti um skoðun; eyðslan þín hefur ekki tekið eftir enn.',
    },
    {
      title: 'Tekjur niður {{percent}} %',
      message:
        '{{incomeAmount}} komu inn á móti {{expenseAmount}} út. Það sem gæfan gefur getur hún tekið til baka — stilltu eyðsluna að því sem er, ekki því sem var.',
    },
    {
      title: 'Rýrri mánuður, sömu vanar',
      message:
        'Tekjur eru {{percent}} % lægri ({{incomeAmount}}), en eyðslan hélt sér í {{expenseAmount}}. Tekjurnar eru ekki í valdi þínu; svarið er.',
    },
    {
      title: 'Gæfan hreyfðist',
      message:
        'Þú hafðir {{percent}} % lægri tekjur en venjulega, en eyddir {{expenseAmount}} sem fyrr. Skertu nú, á meðan það er val fremur en nauðsyn.',
    },
    {
      title: 'Eyðslan hefur ekki fylgt tekjunum',
      message:
        'Tekjur lækkuðu í {{incomeAmount}} ({{percent}} % niður); eyðslan er {{expenseAmount}}. Stilltu seglið að þeim vindi sem þú hefur raunverulega.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Áskriftir: {{monthlyAmount}} á mánuði',
      message:
        '{{count}} áskriftir taka {{percent}} % af mánaðarlegri eyðslu þinni. Hver endurnýjast án að spyrja þig — spyrðu sjálfur um hverja.',
    },
    {
      title: '{{percent}} % af eyðslunni endurnýjast sjálf',
      message:
        '{{count}} áskriftir, {{monthlyAmount}} á mánuði. Haltu þeim sem þú myndir skrá þig í aftur í dag.',
    },
    {
      title: 'Hljóðlátt, endurtekið, {{monthlyAmount}}',
      message:
        '{{count}} áskriftir kosta {{percent}} % af mánuði þínum. Þægindi eru góður þjónn og dýr herra.',
    },
    {
      title: '{{count}} áskriftir til endurskoðunar',
      message:
        'Saman eru þær {{monthlyAmount}} á mánuði, {{percent}} % af eyðslunni. Segðu upp einni sem þú notar varla og tak eftir hve lítið þú saknar hennar.',
    },
    {
      title: 'Það sem endurnýjast sjálft',
      message:
        '{{monthlyAmount}} á mánuði yfir {{count}} áskriftir. Sjálfvirk eyðsla á meðvitaða endurskoðun skilið.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Velgengni þín gæti náð lítið eitt lengra',
      message:
        'Á {{months}} mánuðum hélst þú {{savingsPercent}} % af tekjum þínum, en nánast ekkert af því fór til annarra. Auður situr best í opnum höndum — ef til vill ein gjöf eða framlag þennan mánuð?',
    },
    {
      title: 'Þénar vel, gefur lítið',
      message:
        '{{incomeAmount}} komu inn á {{months}} mánuðum og {{givenAmount}} fóru til annarra. Ef þú hjálpar á vegu sem þetta forrit sér ekki, horfðu fram hjá þessu; ef ekki, hefur áætlunin rúm fyrir það.',
    },
    {
      title: 'Gott ár til að vera gjafmildur',
      message:
        'Þú sparaðir {{savingsPercent}} % af tekjum — merki um stöðuga hönd. Lítill hluti af því, gefinn þeim sem þarf, myndi gera stöðugleikann meira virði.',
    },
    {
      title: 'Enginn annar á myndinni enn',
      message:
        'Síðustu {{months}} mánuðir sýna varkára tekjuöflun og sparnað, en engar góðgerðir eða gjafir. Við erum gerð hvert fyrir annað; hógvær gjöf nægir til að byrja.',
    },
    {
      title: 'Rúm fyrir góðvild',
      message:
        'Aðeins {{givenAmount}} af {{incomeAmount}} fóru í að hjálpa öðrum. Hugleiddu lítið, reglulegt framlag — gjafmildi verður léttari með vana, eins og hver dygð.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '„{{goal}}“ dregst aftur úr',
      message:
        'Það þarf {{requiredAmount}} á mánuði og þú leggur til um það bil {{paceAmount}}. Með þessum hraða kemur það {{monthsLate}} mánuðum of seint. Hraðinn er í þínu valdi.',
    },
    {
      title: '„{{goal}}“: {{monthsLate}} mánuðum síðar á þessum hraða',
      message:
        'Krafist {{requiredAmount}} á mánuði, raunverulegt um {{paceAmount}}. Færðu dagsetninguna heiðarlega eða færðu meiri peninga viljandi.',
    },
    {
      title: 'Markmiðið og hraðinn eru ósamhljóða',
      message:
        '„{{goal}}“ biður um {{requiredAmount}} á mánuði; það fær {{paceAmount}}. Markmið er aðeins eins raunverulegt sem mánaðarlega skrefið að því.',
    },
    {
      title: '„{{goal}}“ þarf fastara skref',
      message:
        '{{paceAmount}} á mánuði á móti þeim {{requiredAmount}} sem það þarf. Greiddu markmiðinu fyrst í næsta mánuði, fyrir öllu valkvæðu.',
    },
    {
      title: 'Aftur úr á „{{goal}}“',
      message:
        'Núverandi hraði ({{paceAmount}} á mánuði) skilur það eftir {{monthsLate}} mánuðum of seint. Í þínu valdi er næsta skref, ekki öll leiðin.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '„{{goal}}“ passar ekki í áætlunina',
      message:
        'Það þarf {{requiredAmount}} á mánuði, en eftir áætlanir þínar eru aðeins {{freeAmount}} laus. Breyttu dagsetningunni, markinu eða áætlununum — að vona er ekki áætlun.',
    },
    {
      title: '„{{goal}}“ biður um meira en þú hefur laust',
      message:
        '{{requiredAmount}} krafist í hverjum mánuði, {{freeAmount}} tiltækt. Að vilja allt í einu er hvernig ekkert verður gert; veldu.',
    },
    {
      title: 'Tölurnar segja nei — í bili',
      message:
        '„{{goal}}“ þarf {{requiredAmount}} á mánuði; laust reiðufé þitt er {{freeAmount}}. Stilltu það sem er í valdi þínu: tímamörkin eða hin mörkin.',
    },
    {
      title: '„{{goal}}“ þarf ákvörðun',
      message:
        'Með {{requiredAmount}} á mánuði fer það fram úr þeim {{freeAmount}} sem eru eftir áætlanir. Markmið valið með opnum augum er betra en það sem haldið er við með hugsanaskekkju.',
    },
    {
      title: 'Óframkvæmanlegur hraði fyrir „{{goal}}“',
      message:
        'Krafist {{requiredAmount}} mánaðarlega, laust {{freeAmount}}. Heiðarlegur reikningur nú sparar vonbrigði síðar.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Staðan fer undir núll {{date}}',
      message:
        'Með tekjur og eyðslu eins og þær ganga núna fer spáð staða niður í {{lowestAmount}}. Undirbúðu þig nú, meðan það er aðeins spá.',
    },
    {
      title: 'Skortur er í aðsigi: {{date}}',
      message:
        'Greiðslur og daglegar útgjaldaliðir hlaupa fram úr tekjunum og lægsta staðan er {{lowestAmount}}. Að sjá erfiðleika fyrir er leiðin til að svipta þá valdinu.',
    },
    {
      title: 'Gerðu ráð fyrir {{date}}',
      message:
        'Þann dag nær áætluð staða {{lowestAmount}}. Færðu greiðslu, haltu löngun í skefjum eða legðu reiðufé til hliðar — hvert af þessu er í valdi þínu í dag.',
    },
    {
      title: 'Spáin fer niður fyrir núll',
      message:
        'Staðan fer niður í {{lowestAmount}} um {{date}}. Rólegt viðbragð er snemmbúið viðbragð.',
    },
    {
      title: 'Sjáðu bilið fyrir {{date}}',
      message:
        'Áætluð lægsta staða: {{lowestAmount}}. Það sem er séð fyrir má mæta með stillingu; það sem kemur okkur í opna skjöldu, sjaldan.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Þú stóðst við orð þín við sjálfan þig',
      message:
        'Í {{months}} mánuði í röð hélst eyðslan innan áætlunarinnar sem þú settir. Þannig lítur sjálfsstjórn út.',
    },
    {
      title: '{{months}} mánuðir innan áætlunar',
      message:
        'Mánuð eftir mánuð eru ætlun þín og athöfn samhljóða. Samkvæmni er hljóðlátari en viljaþrek og varir lengur.',
    },
    {
      title: 'Áætlun og líf eru samhljóða',
      message:
        '{{months}} mánuðir í röð innan marka þinna. Áætlun sem haldið er svo vel er ekki lengur höft — hún er hvernig þú lifir.',
    },
    {
      title: 'Stöðugt í {{months}} mánuði',
      message:
        'Áætlanir þínar hafa haldið {{months}} mánuði í röð. Haltu sömu athygli; það gengur upp.',
    },
    {
      title: 'Sjálfsstjórn, viðhaldin',
      message:
        '{{months}} mánuðir án að brjóta áætlun þína. Fátt frelsar eins og að geta treyst eigin ákvörðunum.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Peningarnir þínir fylgja gildum þínum',
      message:
        'Fé í þjónustu dygðarinnar nam {{actual}} % af eyðslu þinni, ekki minna en áætluðu {{planned}} %. Vel varið.',
    },
    {
      title: 'Dygð fékk sinn fulla hlut',
      message:
        '{{actual}} % í heilsu, lærdóm og aðra, á móti {{planned}} % áætluðum. Það sem þú metur, fyrir það greiddir þú.',
    },
    {
      title: 'Eytt í að verða betri',
      message:
        'Heilsa, lærdómur og annað fengu {{actual}} % af eyðslu mánaðarins (áætlað {{planned}} %). Dygð verður ekki keypt, en henni má þjóna.',
    },
    {
      title: 'Ætlun framkvæmd',
      message:
        'Þú áætlaðir {{planned}} % í dygð og eyddir {{actual}} %. Góðar ætlanir lifa sjaldan mánuð — þínar gerðu það.',
    },
    {
      title: 'Besta notkun peninga',
      message: '{{actual}} % fóru í það sem gerir þig og aðra betri. Haltu áfram að velja það.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Afþreying á sínum stað',
      message:
        'Afþreying er {{actual}} % af eyðslunni, undir þeim {{planned}} % sem þú heimilaðir henni. Þú nýtur hluta án að þeir ráði þér.',
    },
    {
      title: 'Nautn, haldin í stærð',
      message:
        'Afþreying tók {{actual}} % á móti {{planned}} % áætluðum. Hófsemi er ekki að missa af — hún er að velja.',
    },
    {
      title: 'Hvíld án ofgnóttar',
      message:
        '{{actual}} % í afþreyingu, undir marki þínu um {{planned}} %. Ánægja smakkast betur þegar hún ræður ekki.',
    },
    {
      title: 'Hófsemi, hljóðlát',
      message:
        'Þú gafst afþreyingu {{planned}} % og hún notaði aðeins {{actual}} %. Það svigrúm er frelsi sem þú hélst.',
    },
    {
      title: 'Afþreying undir áætlun',
      message:
        'Með {{actual}} % af eyðslunni hélt afþreying sér undir þeim {{planned}} % sem þú settir. Vel haldið.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '{{percent}} % undir áætlun',
      message:
        'Þú eyddir {{savedAmount}} minna en þú leyfðir þér fyrir mánuðinn. Að þurfa ekki allt sem þú gætir haft er tegund auðs.',
    },
    {
      title: '{{savedAmount}} eftir óeytt',
      message:
        'Mánuðurinn endaði {{percent}} % undir áætlun. Það sem þú eyddir ekki er enn þitt að stýra.',
    },
    {
      title: 'Minna en þú heimilaðir',
      message:
        'Eyðslan er {{percent}} % undir áætluninni — {{savedAmount}} haldið eftir. Gefðu því svigrúmi markmið áður en vaninn tekur það.',
    },
    {
      title: 'Áætlunin hafði rúm til vara',
      message:
        '{{savedAmount}} undir mörkum þínum fyrir mánuðinn. Hófsemi sem er auðveld er sú sem endist.',
    },
    {
      title: 'Léttara en áætlað',
      message:
        'Þú þurftir {{percent}} % minna en þú áætlaðir. Hugleiddu að senda þau {{savedAmount}} í markmið.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '„{{goal}}“ er á áætlun',
      message:
        'Þú ert {{percent}} % á leiðinni, á þeim hraða sem markmiðið þarf. Stöðug skref, tekin mánaðarlega, nást langt.',
    },
    {
      title: 'Á áætlun með „{{goal}}“',
      message:
        '{{percent}} % lokið og hraðinn heldur. Haltu áfram að greiða markmiðinu fyrst; það gengur upp.',
    },
    {
      title: '„{{goal}}“: {{percent}} % og stöðugt',
      message: 'Markmiðið fær það sem það þarf hvern mánuð. Þolinmæðin vinnur sitt verk.',
    },
    {
      title: 'Markmiðið hreyfist eins og áætlað',
      message:
        '„{{goal}}“ er {{percent}} % fjármagnað og á tíma. Það sem gert er lítið í hverjum mánuði verður ekki stöðvað af einni slæmri viku.',
    },
    {
      title: 'Framför sem þú getur treyst',
      message:
        '„{{goal}}“ standur í {{percent}} %, á hraða. Þú byggir það á þann eina hátt sem gengur upp — smám saman.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: 'Færri hvatakaup hjá {{merchant}}',
      message:
        'Úr {{before}} kaupum á mánuði í um það bil {{after}}. Vani sem losnar er frelsi sem vinnst.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'Þú heimsækir sjaldnar en áður. Hvert sleppt viðbragð er lítill sigur vals yfir vana.',
    },
    {
      title: 'Litli vaninn skreppur saman',
      message:
        'Kaup hjá {{merchant}} fóru frá {{before}} í um {{after}}. Haltu áfram — það verður léttara.',
    },
    {
      title: 'Val í stað viðbragðs',
      message:
        'Hjá {{merchant}} fórstu frá {{before}} kaupum í um {{after}}. Það eru tök byggð ein ákvörðun í einu.',
    },
    {
      title: 'Minna af smáhlutunum',
      message:
        '{{merchant}} sá þig um {{after}} sinnum í stað {{before}}. Litlir sigrar leggjast saman.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Þú tókst rýrari mánuði',
      message:
        'Tekjur lækkuðu {{incomePercent}} % og þú skertir eyðslu {{expensePercent}} %. Þú mættir breyttri gæfu með breyttri stefnu.',
    },
    {
      title: 'Stilling þegar tekjur dýfðu',
      message:
        'Tekjur niður {{incomePercent}} %, eyðsla niður {{expensePercent}} %. Þú stilltir þig að því sem er, ekki því sem var.',
    },
    {
      title: 'Gæfan breyttist; svo gerðir þú',
      message:
        '{{incomePercent}} % fall í tekjum mætti {{expensePercent}} % falli í eyðslu. Það er hugarró í tölum.',
    },
    {
      title: 'Vel stýrt',
      message:
        'Þegar tekjur lækkuðu {{incomePercent}} % fylgdi eyðslan ({{expensePercent}} % minna). Vindurinn var ekki þinn; seglið var.',
    },
    {
      title: 'Eyðslan fylgdi tekjunum niður',
      message:
        'Þú eyddir {{expensePercent}} % minna þegar tekjur lækkuðu {{incomePercent}} %. Að stilla sig í tíma er róleg leið í gegn.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'Nauðsynjar eru stöðugar',
      message:
        'Í {{months}} mánuði hafa nauðsynlegir kostnaðir þínir varla hreyfst. Stöðugt gólf gefur þér frelsi ofan á því.',
    },
    {
      title: 'Þarfir í skefjum',
      message:
        'Eyðsla í nauðsynjar hélt sér jöfn í {{months}} mánuði. Þarfir sem vaxa ekki eru þarfir sem þú stjórnar.',
    },
    {
      title: '{{months}} mánuðir af stöðugum nauðsynjum',
      message:
        'Húsaleiga, matur og reikningar héldu sér þar sem þeir voru. Hljóðlátur stöðugleiki er líka árangur.',
    },
    {
      title: 'Engin skriðþróun í nauðsynjum',
      message:
        '{{months}} mánuðir án reks í því sem lífið krefst. Allt annað er léttara að áætla á þeim grunni.',
    },
    {
      title: 'Fast gólf',
      message:
        'Nauðsynleg eyðsla hefur verið stöðug í {{months}} mánuði. Þú lætur ekki þægindi líðast sem þarfir.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Gjafmildur með það sem þú þénar',
      message:
        'Á {{months}} mánuðum fóru {{percent}} % af tekjum þínum — {{givenAmount}} — í að hjálpa öðrum. Það eru peningar settir í sína bestu notkun.',
    },
    {
      title: '{{givenAmount}} gefnir öðrum',
      message:
        'Þú deildir {{percent}} % af tekjum þínum á {{months}} mánuðum. Góðvild sem sést í tölunum er góðvild iðkuð, ekki aðeins fundin.',
    },
    {
      title: 'Opnar hendur',
      message:
        'Góðgerðir og gjafir tóku {{percent}} % af tekjum þínum undanfarið. Það sem þú gefur frá þér er sá hluti auðs þíns sem engin óhöpp geta tekið.',
    },
    {
      title: 'Gjafmildi er hluti af áætlun þinni',
      message:
        '{{givenAmount}} til annarra á {{months}} mánuðum. Haltu því — hið góða sem þú gerir öðrum er einnig gert fyrir þig.',
    },
    {
      title: 'Vel gefið',
      message:
        '{{percent}} % af því sem þú þénaðir fóru í að hjálpa öðrum. Fáir vanar segja meira um manneskju.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Ekkert að leiðrétta',
      message: 'Eyðslan þín svarar því sem þú ætlaðir. Haltu áfram eins og þú ert.',
    },
    {
      title: 'Ætlun og athöfn eru samhljóða',
      message: 'Mánuðurinn lítur út eins og þú ætlaðir. Þetta samræmi er tilgangurinn.',
    },
    {
      title: 'Rólegur mánuður',
      message:
        'Engin ofgnótt, engin vanræksla sem vert er að nefna. Vel gert — tak sömu athygli með þér áfram.',
    },
    {
      title: 'Allt í lagi',
      message:
        'Áætlun þín hélt og ekkert biður um leiðréttingu. Njóttu þeirrar kyrrðar sem þú áunnst.',
    },
    {
      title: 'Stöðug hönd',
      message: 'Mánuðurinn fylgdi áætlun þinni. Góðir vanar láta góða mánuði líta venjulega út.',
    },
  ],
  'stoic.keep_first': [
    {
      title: 'Haltu þínum hluta fyrst',
      message:
        'Á {{months}} mánuðum hélstu eftir {{savingsPercent}} % af tekjunum. Aðvörun Seneca: það er of seint að spara þegar komið er niður í botn fatsins. Leggðu {{tenthAmount}} til hliðar daginn sem tekjurnar berast.',
    },
    {
      title: 'Sparaðu af toppi fatsins',
      message:
        'Aðeins {{savingsPercent}} % af tekjunum urðu eftir hjá þér. Sparnaður sem bíður eftir afgangnum kemur of seint; {{tenthAmount}} á mánuði, lagðar til hliðar fyrst, hefja hann núna.',
    },
    {
      title: 'Haltu í það sem er þitt',
      message:
        'Seneca ráðleggur að varðveita það sem raunverulega er þitt og byrja snemma. Undanfarið hafa {{savingsPercent}} % af tekjunum orðið eftir hjá þér; byrjaðu á {{tenthAmount}} á útborgunardegi og láttu eyðsluna laga sig að afganginum.',
    },
    {
      title: 'Byrjaðu áður en botninn kemur',
      message:
        'Þú hélst eftir {{savingsPercent}} % á {{months}} mánuðum. Sparnaður er í þínu valdi aðeins meðan eitthvað er eftir til að spara: færðu {{tenthAmount}} til hliðar á undan öllu öðru.',
    },
    {
      title: '{{savingsPercent}} % haldið eftir og fatið tæmist',
      message:
        '{{tenthAmount}} á mánuði, tíundi hluti teknanna, lagður til hliðar áður en nokkur reikningur er greiddur. Það sem þú heldur fyrst eftir er óháð því hvað mánuðurinn skilur eftir.',
    },
  ],
  'stoic.prepare_beforehand': [
    {
      title: 'Búðu þig undir meðan allt er rólegt',
      message:
        'Varasjóðurinn dugir fyrir um það bil {{cushionDays}} daga eyðslu. Seneca: sálin á að harðna á tímum án áhyggna. Þriggja mánaða eyðsla er {{targetAmount}}.',
    },
    {
      title: 'Varasjóður fyrir {{cushionDays}} daga',
      message:
        'Hamingjan boðar ekki komu sína. Byggðu upp sjóð að {{targetAmount}}, þriggja mánaða eyðslu, meðan ekkert þrýstir á: þá er það auðvelt.',
    },
    {
      title: '„Var þetta ástandið sem ég hræddist?“',
      message:
        'Seneca lét Lucilius æfa fátækt svo hún missti skelfingu sína. Með varasjóð fyrir {{cushionDays}} daga væri einn erfiður mánuður engin æfing. Stefndu að {{targetAmount}}.',
    },
    {
      title: 'Sjáðu erfiða mánuðinn fyrir',
      message:
        'Sparnaðurinn dygði í um það bil {{cushionDays}} daga. Það sem er séð fyrir kemur mildilega; {{targetAmount}} bæru þig í þrjá mánuði.',
    },
    {
      title: 'Reistu vegginn fyrir storminn',
      message:
        'Um {{cushionDays}} dagar eru tryggðir. Að missa tekjur er ekki í þínu valdi, en varasjóðurinn er það. Þriggja mánaða eyðsla nemur {{targetAmount}}.',
    },
  ],
  'stoic.wants_outrun_income': [
    {
      title: 'Löngunin hleypur fram úr tekjunum',
      message:
        'Eyðslan jókst um {{expenseGrowth}} % á síðasta ársfjórðungi en tekjurnar breyttust um {{incomeGrowth}} %. Fátækur er ekki sá sem á of lítið, skrifar Seneca, heldur sá sem þráir meira.',
    },
    {
      title: 'Að lifa hærra, ekki betur',
      message:
        'Eyðslan jókst um {{expenseGrowth}} %, tekjurnar um {{incomeGrowth}} %. Þarfir náttúrunnar eru litlar; kröfur álitsins eru takmarkalausar. Spyrðu hverri þeirra aukningin þjónar.',
    },
    {
      title: 'Löngunin hefur vaxið: +{{expenseGrowth}} %',
      message:
        'Útgjöldin hækkuðu hraðar en tekjurnar ({{incomeGrowth}} %). Ný þægindi virðast fljótt vera þörf: taktu eftir þeim meðan þú getur enn hafnað þeim.',
    },
    {
      title: 'Markstangirnar færast',
      message:
        'Eyðslan er {{expenseGrowth}} % hærri en á fjórðungnum á undan, tekjurnar {{incomeGrowth}} %. Nóg er áfram nóg aðeins ef þú ákveður sjálfur hvað það er.',
    },
    {
      title: 'Meira er ekki lækningin',
      message:
        'Á síðasta ársfjórðungi jókst eyðslan um {{expenseGrowth}} % og tekjurnar um {{incomeGrowth}} %. Auður sem vex með þránni kemur aldrei á leiðarenda; settu mörk áður en þetta verður hið nýja eðlilega.',
    },
  ],
  'stoic.price_in_life': [
    {
      title: '{{merchant}} kostaði þig {{hours}} stundir úr lífi',
      message:
        'Seneca minnir á að aðeins tíminn er í raun okkar. {{totalAmount}} hjá söluaðilanum {{merchant}} eru um það bil {{hours}} stundir af vinnu þinni. Var það þess virði?',
    },
    {
      title: '{{hours}} stundir: {{merchant}}',
      message:
        'Við gætum peninganna en gefum tímann. Miðað við meðaltímakaup þitt eru {{totalAmount}} hér um það bil {{hours}} vinnustundir.',
    },
    {
      title: 'Verðlagðu í stundum',
      message:
        '{{totalAmount}} hjá söluaðilanum {{merchant}} eru um það bil {{hours}} stundir af vinnu. Stundirnar eru það eina sem þú getur ekki unnið þér inn aftur.',
    },
    {
      title: 'Hvað {{merchant}} kostaði í raun',
      message:
        'Þú skiptir dögum fyrir peninga og peningum fyrir hluti. {{merchant}} tók um það bil {{hours}} stundir af þínum ({{totalAmount}}). Stendur ánægjan undir stundunum?',
    },
    {
      title: 'Vegðu stundirnar',
      message:
        'Umreiknað á meðaltímakaupið þitt eru {{totalAmount}} hjá söluaðilanum {{merchant}} um það bil {{hours}} stundir. Við glötum miklu af tíma okkar, skrifar Seneca. Valdir þú þetta?',
    },
  ],
  'stoic.rule_broken': [
    {
      title: 'Reglan „{{rule}}“ hefur villst af leið',
      message:
        'Hún bendir á eitthvað sem er ekki lengur til, svo hún hefur hljóðlega hætt að virka. Lagaðu hana eða fjarlægðu: regla sem gerir ekkert lítur bara út eins og regla.',
    },
    {
      title: '„{{rule}}“ verkar ekki lengur',
      message:
        'Flokkurinn, reikningurinn eða viðtakandinn er horfinn og reglan er nú sniðgengin í hverri færslu. Sjáðu hlutina eins og þeir eru og lagaðu þá svo.',
    },
    {
      title: 'Regla sem miðar á ekkert',
      message:
        '„{{rule}}“ sendir færslur á stað sem hefur verið fjarlægður. Þú ákvaðst eitthvað einu sinni; ákveddu aftur nú þegar hlutirnir hafa breyst.',
    },
    {
      title: '„{{rule}}“ þarf á dómgreind þinni að halda',
      message:
        'Það sem hún vísar í hefur verið eytt og færslurnar sem hún flokkaði áður bíða nú eftir þér. Gefðu henni nýtt markmið eða slepptu henni.',
    },
    {
      title: 'Biluð regla, í þögn',
      message:
        '„{{rule}}“ gerir ekkert og segir ekkert um það. Lagaðu það sem er í þínu valdi: það tekur eina mínútu.',
    },
  ],
  'stoic.rule_contradicted': [
    {
      title: 'Hönd þín er ósammála „{{rule}}“',
      message:
        '{{count}} sinnum flokkaðir þú handvirkt annað en þessi regla flokkar. Annaðhvort er reglan röng eða höndin: ákveddu hvort.',
    },
    {
      title: '„{{rule}}“ var hnekkt {{count}} sinnum',
      message:
        'Regla sem þú ert sífellt að leiðrétta er ekki lengur ákvörðun, aðeins vani að deila við sjálfan sig. Breyttu henni eða treystu henni.',
    },
    {
      title: 'Segðu það sem þú gerir, gerðu það sem þú sagðir',
      message:
        'Reglan „{{rule}}“ segir eitt; síðustu {{count}} leiðréttingar þínar segja annað. Færðu þetta tvennt í samræmi.',
    },
    {
      title: 'Umdeild ákvörðun',
      message:
        'Þú settir „{{rule}}“ með skýrum huga og {{count}} færslur hafa síðan farið aðra leið. Líttu aftur, í ró, á hvort ykkar hafði rétt fyrir sér.',
    },
    {
      title: '{{count}} leiðréttingar gegn „{{rule}}“',
      message:
        'Endurtekning er upplýsing. Láttu hana breyta reglunni, eða láttu regluna breyta vananum.',
    },
  ],
  'stoic.rule_worth_writing': [
    {
      title: 'Ákveddu einu sinni: {{payee}}',
      message:
        'Þú hefur flokkað viðtakandann {{payee}} handvirkt {{decided}} sinnum, alltaf eins. Það sem þú ákveður aftur og aftur, ákveddu einu sinni, með skýrum huga.',
    },
    {
      title: 'Ákvörðun tekin {{decided}} sinnum',
      message:
        'Viðtakandinn {{payee}} spyr sömu spurningar og þú gefur sama svar. Regla myndi geyma athygli þína fyrir það sem raunverulega þarf á henni að halda.',
    },
    {
      title: 'Viðtakendur sem eru tilbúnir fyrir reglu: {{count}}',
      message:
        'Sömu viðtakendurnir fá sama flokk hjá þér, mest {{payee}}. Sparaðu dómgreindina fyrir það sem er nýtt.',
    },
    {
      title: 'Vani þinn er tilbúinn að verða grundvallarregla',
      message:
        'Þú flokkar viðtakandann {{payee}} eins í hvert sinn (hingað til {{decided}} sinnum). Skrifaðu það sem reglu og það heldur án fyrirhafnar.',
    },
    {
      title: 'Láttu reglu bera þetta',
      message:
        'Viðtakendur sem þú flokkar eins í hvert sinn: {{count}}, og viðtakandinn {{payee}} með {{decided}} færslur. Grundvallaratriði sem er útkljáð einu sinni þarf ekki að þrefa um aftur.',
    },
  ],
  'stoic.rule_idle': [
    {
      title: '„{{rule}}“ hefur ekkert hitt í {{months}} mánuði',
      message:
        'Annaðhvort er heimurinn sem hún var gerð fyrir horfinn eða skilyrði hennar missa marks. Haltu reglum þínum sönnum: lagaðu eða fjarlægðu.',
    },
    {
      title: 'Regla í hvíld: „{{rule}}“',
      message:
        'Hún hefur ekki snert færslu í {{months}} mánuði. Kastaðu því sem er óþarft; það sem eftir stendur er auðveldara að treysta.',
    },
    {
      title: '„{{rule}}“ stendur auðum höndum',
      message:
        '{{months}} mánuði án samsvörunar meðan nýjar færslur berast stöðugt. Prófaðu hana á nýjustu færslunum og ákveddu svo.',
    },
    {
      title: 'Er „{{rule}}“ enn þörf?',
      message:
        'Ekkert hefur samsvarað henni í {{months}} mánuði. Regla sem er geymd af vana er einn hlutur í viðbót til að hugsa um.',
    },
    {
      title: 'Ákvörðun sem hefur ekkert að ákveða',
      message:
        '„{{rule}}“ hefur þagað í {{months}} mánuði. Góð skipan er að eiga það sem þarf, og ekkert umfram það.',
    },
  ],
  'stoic.praise_rules_hold': [
    {
      title: 'Ákvarðanir þínar halda',
      message:
        'Reglur flokkuðu {{percent}} % færslna mánaðarins og þú þurftir ekki að hnekkja neinni. Ákvörðun sem er tekin einu sinni og haldið frelsar hugann.',
    },
    {
      title: '{{percent}} % afgreitt fyrirfram',
      message:
        'Flestar færslur mánaðarins voru flokkaðar eftir því sem þú ákvaðst áður. Það er athygli sem sparast fyrir það sem skiptir máli.',
    },
    {
      title: 'Grundvallarreglur að verki',
      message:
        'Reglur þínar afgreiddu {{percent}} % færslna án ágreinings. Fastmótaðar reglur gera dagana kyrrláta.',
    },
    {
      title: 'Minna að ákveða',
      message:
        '{{percent}} % færslna þurftu enga nýja ákvörðun. Þú dæmdir einu sinni, vel, og dómurinn stendur enn.',
    },
    {
      title: 'Reglan er í lagi',
      message:
        'Reglur flokkuðu {{percent}} % mánaðarins og engri var mótmælt. Góð skipan lítur út eins og ekkert gerist.',
    },
  ],
  'stoic.goal_no_date': [
    {
      title: '„{{goal}}“ hefur enga dagsetningu',
      message:
        'Markmiðið stendur í {{percent}} % og ekkert rennur í það. Þegar maður veit ekki í hvaða höfn hann stefnir er enginn vindur hagstæður: nefndu daginn sem þú ætlar að koma.',
    },
    {
      title: 'Ósk eða markmið?',
      message:
        '„{{goal}}“ hefur hvorki skiladag né hraða. Markmið er ákvörðun með dagsetningu; gefðu því eina eða slepptu því.',
    },
    {
      title: 'Nefndu daginn: „{{goal}}“',
      message:
        'Það er komið {{percent}} % og hreyfist ekki. Það sem hægt er að gera hvenær sem er, er sjaldan gert.',
    },
    {
      title: '„{{goal}}“ bíður eftir „einhvern tíma“',
      message:
        'Ekkert hefur runnið í það upp á síðkastið og engin dagsetning krefst neins. „Einhvern tíma“ er ekki í dagatalinu þínu; veldu dag sem er það.',
    },
    {
      title: 'Markmiðið „{{goal}}“ á enga höfn',
      message:
        'Í {{percent}} %, án skiladags. Vittu hvert þú siglir og mánaðarlega skrefið fylgir.',
    },
  ],
};
