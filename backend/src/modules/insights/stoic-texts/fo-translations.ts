import type { StoicTextMap } from './types';

export const fo: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'Mánaðurin vaks út um ætlan sína',
      message:
        'Tú ætlaði {{plannedAmount}} og hevur brúkt {{spentAmount}} — {{percent}} % meira. Ætlanin varð gjørd við greiðum huga; lat hana tala harðari enn eygnabliðið.',
    },
    {
      title: '{{percent}} % yvir tað tú ætlaði at brúka',
      message:
        'Útgjøldini standa á {{spentAmount}} móti eini ætlan um {{plannedAmount}}. Hygg at hvat mark gav seg fyrst — har liggur lærdómurin.',
    },
    {
      title: 'Ætlan tín og mánaðurin eru ósamdir',
      message:
        '{{spentAmount}} brúkt, {{plannedAmount}} ætlað. Antin kravdi ætlanin ov lítið av veruleikanum, ella veruleikin ov mikið av tær — avger í ró hvat.',
    },
    {
      title: 'Meira fór út enn tú loyvdi',
      message:
        'Mánaðurin er {{percent}} % yvir teimum {{plannedAmount}} tú setti. Einki er tapt við at steðga nú; mikið er tapt við at læta sum tað ikki hendi.',
    },
    {
      title: 'Eitt mark tú setti, eitt mark tú fórt yvir',
      message:
        'Tú ætlaði at brúka {{plannedAmount}}; tað er {{spentAmount}}. Sjálvsstýring er ikki at aldri skriða — tað er at merkja tað tíðliga og venda aftur til leiðina.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Frítíð tekur meira enn tú ætlaði',
      message:
        'Tú ætlaði frítíðina at vera {{planned}} % av útgjøldunum; hon gjørdist {{actual}} %. Nøgdsemi er vælkomin sum gestur, ikki sum húsharri.',
    },
    {
      title: 'Frítíð á {{actual}} %, ætlað {{planned}} %',
      message:
        'Hvíld fortænir pláss sítt, tá hon endurnýggjar teg. Spyr, hvørjar nøgdsemir mánaðarins gjørdu tað, og slepp restini uttan eftirsjón.',
    },
    {
      title: 'Trivnaður brúkar meira enn ætlanin',
      message:
        'Frítíðin heldur {{actual}} % av útgjøldunum móti teimum {{planned}} % tú valdi. Mátahald er ikki at nokta nøgdsemi — tað er at halda hana í tí støddini tú avgjørdi.',
    },
    {
      title: 'Tað væl hóskandi trýstir tað ætlaða burtur',
      message:
        'Tú gav frítíðini {{planned}} % av ætlanini, og hon tók {{actual}} %. Tað tú nýtur uttan møði er verd eitt nýtt eygnakast, áðrenn tað verður tað tú hevur brúk fyri.',
    },
    {
      title: 'Frítíðin hevur stigið yvir linjuna',
      message:
        '{{actual}} % av mánaðinum fóru til frítíð, {{planned}} % var ætlanin. Linjan var tín at teikna, og hon er tín at halda.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Frítíð yvir ætlan aftur',
      message:
        'Frítíðin fór út um ætlan tína í {{months}} av seinastu {{window}} mánaðunum. Ein endurtaking er ikki longur eitt óhapp — tað er ein vani verdur at kanna.',
    },
    {
      title: '{{months}} av {{window}} mánaðum yvir frítíðarætlanina',
      message:
        'Tað sum hendir eina ferð, er umstøður; tað sum hendir {{months}} ferðir, er lyndi í mótan. Vel lyndið við vilja.',
    },
    {
      title: 'Sama misstig, mánað eftir mánað',
      message:
        'Frítíðin rann frá ætlanini í {{months}} av {{window}} mánaðum. Hev ætlanina ærliga ella broyt vanan — at liva millum tey tvey kostar mest.',
    },
    {
      title: 'Eitt mynstur, ikki eitt undantak',
      message:
        'Í {{months}} av seinastu {{window}} mánaðunum tók frítíðin meira enn tú gav henni. Legg til merkis eygnabliðið tá avgerðin verður tikin, ikki bert rokningina aftaná.',
    },
    {
      title: 'Vanin velur móti ætlan tíni',
      message:
        'Frítíðin vann yvir ætlanina {{months}} ferðir á {{window}} mánaðum. Vanar verða bygdir eitt val í senn; soleiðis verða teir eisini niðurbrotnir.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'Dygd fær minni enn tú ætlaði',
      message:
        'Tú setti {{planned}} % av fíggjarætlanini av síðuni til heilsu, læring og annað; tað gjørdist {{actual}} %. Ein ætlan telur, tá hon er framd.',
    },
    {
      title: 'Dygd á {{actual}} % av ætlaðu {{planned}} %',
      message:
        'Pengarnir, tú ætlaði til tað, sum ger teg betri, bíða enn. Tað er ikki betri tíð at brúka teir væl enn nú.',
    },
    {
      title: 'Tað góða tú ætlaði er óbrúkt',
      message:
        'Heilsa, læring og gávumildi skuldu fáa {{planned}} % av útgjøldunum; tey fingu {{actual}} %. Ger eitt av teimum hesa vikuna, við vilja.',
    },
    {
      title: 'Ætlan uttan gerð',
      message:
        'Dygd heldur {{actual}} % av útgjøldunum móti teimum {{planned}} % tú valdi. Tað vit virða, sýnir seg í tí vit veruliga gjalda fyri.',
    },
    {
      title: 'Tað er pláss eftir til tað sum telur',
      message:
        'Bert {{actual}} % fóru til dygd, hóast tú ætlaði {{planned}} %. Ein bók, ein heilsukanning, ein gáva til ein sum hevur brúk — ætlanin hevur longu sagt ja.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'Dygd verður framhaldandi sett út',
      message:
        'Útgjøld til heilsu, læring og onnur hava ligið undir ætlan tíni {{months}} mánaðir í røð. Tað tú heldur fram at seta út, hevur tú í veruleikanum avgjørt ímóti.',
    },
    {
      title: '{{months}} mánaðir av útsettari dygd',
      message:
        'Hvønn mánað gav ætlanin pláss til tað sum ger tíg betri, og hvønn mánað varð tað óbrúkt. Tíð er tað eina tú ikki kanst ætla tvær ferðir.',
    },
    {
      title: 'Tað betri sjálvið bíðar framvegis',
      message:
        'Dygd hevur ligið undir ætlan {{months}} mánaðir í røð. Byrja lítið og vist heldur enn stórt og seinna.',
    },
    {
      title: 'Góðar ætlanir eldast',
      message:
        'Í {{months}} mánaðir fingu heilsa, læring og gávumildi minni enn tú ætlaði. Vel eina og fíggja hana fyrst næsta mánað, fyri øllum øðrum.',
    },
    {
      title: 'Dygd tapar støðugt fyri „seinna“',
      message:
        '{{months}} mánaðir í røð undir ætlan. Seinna er staðurin hvar góðar ætlanir fara at gloymast — gev hesari eina dagfesting.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'Ætlan tín hevur einki pláss fyri dygd',
      message:
        'Ongin av fíggjarætlanunum tínum tænar heilsu, læring ella onnur. Ein ætlan vísir hvat vit virða — hugsa um at geva dygd sína egnu linju.',
    },
    {
      title: 'Allar ætlanir, men ongin til tað góða',
      message:
        'Neyðsyn, arbeiði og frítíð hava øll mark; dygd hevur einki. Tað sum ongantíð verður ætlað, hendir vanliga ikki.',
    },
    {
      title: 'Ætla fyri tí sum ger tíg betri',
      message:
        'Tað er onki fíggjarætlan í dygdarflokkinum enn. Sjálvt ein lítil — bøkur, sport, eitt stuðul — broytir eitt ynski til eina bindandi avgerð.',
    },
    {
      title: 'Ætlanin tigur um dygd',
      message:
        'Tú ætlar fyri tí tú mást og tí tú nýtur, ikki enn fyri tí tú vilt verða. Ein beskeðin dygdarætlan hevði broytt tað.',
    },
    {
      title: 'Dygd hevur onki fíggjarætlan',
      message:
        'Útgjøld til heilsu, læring ella onnur eru ikki ætlað nakrastaðni. Vel eitt og gev tí eitt mark tú hevði verið glaður at nátt.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'Neyðsynjar kosta meira enn ætlað',
      message:
        'Tú ætlaði {{planned}} % av útgjøldunum til neyðsynjar; tey taka {{actual}} %. Kanna um hvørt er framvegis ein tørvur ella í stillheit er vorðið ein trivnaður.',
    },
    {
      title: 'Neyðsyn á {{actual}} %, ætlað {{planned}} %',
      message:
        'Tað lívið krevur, er vanliga minni enn tað vit venja okkum við. Far ígjøgnum størstu neyðsynina við ferskum eygum.',
    },
    {
      title: 'Tað neyðuga svellir',
      message:
        'Neyðsynjar halda {{actual}} % av mánaðinum móti teimum {{planned}} % tú vænti. Ein tørvur sum heldur fram at vaksa, fortænir eitt spurning.',
    },
    {
      title: 'Tørvirnir vaksa út um ætlanina',
      message:
        'Ætlað {{planned}} %, veruligt {{actual}} %. Antin undirmat ætlanin veruligu kostnaðirnar, ella nøkur ynski ferðast undir navni av tørvi.',
    },
    {
      title: 'Meira brúkt á „mást“ enn ætlað',
      message:
        'Neyðsynjar tóku {{actual}} % av útgjøldunum í staðin fyri {{planned}} %. Skil tað sum veruliga mást vera frá tí sum bert altíð hevur verið.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'Neyðsynjar krøkja uppeftir',
      message:
        'Útgjøld til neyðsynjar eru stigin {{months}} mánaðir í røð, {{percent}} % í alt. Tørvir vaksa í stillheit tá ongin biður tey rættvísgera seg.',
    },
    {
      title: '+{{percent}} % á neyðsynjum í {{months}} mánaðum',
      message:
        'Hvørt stig tókti lítið; saman eru tey tað ikki. Tak størstu endurtaknu neyðsynina og spyr um hon framvegis má kosta so mikið.',
    },
    {
      title: 'Golvið í útgjøldunum tínum stígur',
      message:
        'Neyðsynjar vuksu {{months}} mánaðir í røð (+{{percent}} %). Eitt stígandi golv letur minni pláss eftir til alt tú velur frítt.',
    },
    {
      title: 'Tørvirnir víðka seg',
      message:
        '{{months}} mánaðir av vøkstri, {{percent}} % í alt. Tann stoiska royndin er einkul: hevði tú valt hetta aftur í dag, við prísinum kendum?',
    },
    {
      title: 'Smáar økingar, støðug kós',
      message:
        'Neyðsynjar eru upp {{percent}} % yvir {{months}} mánaðir. Kósin merkir meira enn nakar einstakur mánaður — hendan er verd at rætta tíðliga.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'Arbeiði kostar meira enn ætlað',
      message:
        'Tú ætlaði {{planned}} % av útgjøldunum til arbeiði; tað tekur {{actual}} %. Tól og tænastur mugu gera seg fortænt — kanna hvat ger tað.',
    },
    {
      title: 'Arbeiðsútgjøld á {{actual}} %, ætlað {{planned}} %',
      message:
        'Íløga í arbeiðinum er góð tá hon gevur nakað aftur. Far ígjøgnum hvat tú gjaldar fyri men ikki longur brúkar.',
    },
    {
      title: 'Arbeiðsætlanin er strekt',
      message:
        'Arbeiði tók {{actual}} % í staðin fyri {{planned}} %. Dugnaskapur er at gera arbeiðið væl, ikki at keypa hvørt tól til tess.',
    },
    {
      title: 'Tól brúka meira enn ætlanin',
      message:
        'Ætlað {{planned}} %, brúkt {{actual}} % á arbeiði. Spyr hvørt útgjald: hjálpir tað mær at gera arbeiðið, ella kennist tað bert sum framgongd?',
    },
    {
      title: 'Arbeiðskostnaðirnir hava gliðið',
      message:
        'Arbeiði heldur {{actual}} % av útgjøldunum móti {{planned}} % ætlaðum. Ein skjót kanning nú sparar eina størri seinna.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '„{{category}}“ brýtur mark sítt aftur og aftur',
      message:
        '„{{category}}“ fór yvir ætlan í {{months}} av seinastu {{window}} mánaðunum. Antin er markið skeivt ella ynskið er — avger hvat.',
    },
    {
      title: '„{{category}}“: yvir ætlan {{months}} av {{window}} mánaðum',
      message:
        'Eitt mark sum altíð verður farið yvir, er onki mark, bert eitt ynski. Ger tað ærligt — hev tað við vilja ella hald tað við vilja.',
    },
    {
      title: 'Sama ætlan gevur seg aftur',
      message:
        '„{{category}}“ hevur farið yvir mark sítt {{months}} ferðir á {{window}} mánaðum. Endurtakingin er upplýsing; nýt hana.',
    },
    {
      title: '„{{category}}“ biður um ans tín',
      message:
        'Yvir ætlan í {{months}} av {{window}} mánaðum. Fylg við eygnabliðinum fyri keypið — tað er tann einasti staðurin hvar vanin kann broytast.',
    },
    {
      title: 'Eitt mynstur í „{{category}}“',
      message:
        '{{months}} yvirstigingar á {{window}} mánaðum. Tað vit endurtaka, verða vit; avger hvat tú vilt at hesin bólkurin sigur um tíg.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '„{{category}}“ tømist um dag {{day}}',
      message:
        'Tú hevur brúkt {{spentAmount}} av {{limitAmount}}, og við hesari ferð endar markið um dag {{day}}. At minka ferðina nú er lættari enn at steðga seinna.',
    },
    {
      title: '„{{category}}“ er fyri framman mánaðin',
      message:
        '{{spentAmount}} eru longu farin av einum marki á {{limitAmount}}. Við hesari ferð er tað uppbrúkt um dag {{day}} — restin av mánaðinum er framvegis tín at móta.',
    },
    {
      title: 'Ferðarkanning: „{{category}}“',
      message:
        'Ætlanin á {{limitAmount}} heldur til um dag {{day}} við verandi ferð. Framsýni er tann billigasti slagið av sjálvsstýring.',
    },
    {
      title: '„{{category}}“ brúkar framtíðina',
      message:
        '{{spentAmount}} av {{limitAmount}} brúkt; markið endar nær dag {{day}}. Tað tú gert hesa vikuna, avger um tað hendir.',
    },
    {
      title: 'Tíðlig ávaring fyri „{{category}}“',
      message:
        'Við verandi ferð røkkur markið á {{limitAmount}} ikki mánaðarenda — tað tømist um dag {{day}}. Stilla av meðan tað kostar lítið.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '„{{category}}“ hevur stáið óbrúkt',
      message:
        'Ætlanin fyri „{{category}}“ hevur ikki havt útgjøld í {{months}} mánaðir. Antin ert tú vaksin úr henni, ella hon er ein ætlan sum framvegis bíðar — avger hvat.',
    },
    {
      title: 'Ein tóm ætlan: „{{category}}“',
      message:
        '{{months}} mánaðir uttan eitt einasta útgjald. Ein ætlan eigur at greina frá tí lívi tú livir ella tí tú byggir — hvat er hetta?',
    },
    {
      title: '„{{category}}“ stendur stillt',
      message:
        'Einki brúkt her í {{months}} mánaðir. Var tað afturhald, væl gjørt; var tað vanræksla, ger nakað við tað.',
    },
    {
      title: 'Ætlað, men ikki livað',
      message:
        '„{{category}}“ hevur havt eitt mark og ongar útgjøld í {{months}} mánaðir. Hald ætlanina sanna: tak hana av ella nýt hana.',
    },
    {
      title: '„{{category}}“: {{months}} stillir mánaðir',
      message:
        'Ein ætlan sum ongantíð verður rørd, tekur framvegis pláss í ætlan tíni. Frígev plássið ella æra ætlanina.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}} % av útgjøldunum hava onki mark',
      message:
        '{{unbudgetedAmount}} av mánaðinum fóru til bólkar, sum eingin fíggjarætlan hyggur eftir. Tað, tú ikki hevur kannað, kanst tú ikki døma um.',
    },
    {
      title: 'Mikið av mánaðinum er óætlað',
      message:
        '{{percent}} % av útgjøldunum — {{unbudgetedAmount}} — liggja uttan fyri hvørja ætlan. Gev størsta partinum eitt mark, og ætlanin sær meira av lívi tínum.',
    },
    {
      title: 'Útgjøld uttan fyri ætlanina',
      message:
        'Ætlanirnar dekka bert ein part av tí tú brúkar; {{unbudgetedAmount}} ({{percent}} %) verða ómátað. Víðka ætlanina hagar pengarnir veruliga fara.',
    },
    {
      title: 'Ætlanin sær bert ein part av myndini',
      message:
        '{{percent}} % av útgjøldum mánaðarins hava onga fíggjarætlan. Klár sýn kemur áðrenn góð døming.',
    },
    {
      title: '{{unbudgetedAmount}} brúkt uttan mark',
      message:
        'Tað eru {{percent}} % av mánaðinum. Tú mást ikki avmarka tað — bert avgera hvussu mikið av tí tú veruliga vilt.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '„{{category}}“ er tað mesta av frítíð tíni',
      message:
        '{{percent}} % av frítíðarútgjøldunum fóru til „{{category}}“. Njót tað, men kanna, at tú kundi gingið frá tí.',
    },
    {
      title: 'Ein nøgdsemi ræður',
      message:
        '„{{category}}“ tekur {{percent}} % av øllum tú brúkti á frítíð. Spyr um hon framvegis gleðir tíg ella er vorðin rútina.',
    },
    {
      title: 'Frítíðin hallar seg at „{{category}}“',
      message:
        '{{percent}} % av frítíðini á einum staði. Tað vit ikki klára okkum uttan, hevur tak í okkum — kanna at takið framvegis er lætt.',
    },
    {
      title: '„{{category}}“: {{percent}} % av frítíðini',
      message:
        'Ein kelda til nøgdsemi tekur næstan alt. Far uttan hana eina løtu og sí, hvat hon veruliga gevur tær.',
    },
    {
      title: 'Hvíldin tín hevur eina adressu',
      message:
        'Mesti partur av frítíðarpeningunum, {{percent}} %, fer til „{{category}}“. Tú ert frí frá eini nøgdsemi bert um tú kundi verið uttan hana.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Nøkur útgjøld eru enn ikki mett',
      message:
        '{{count}} bólkar hava ongan flokk. Avger í Fíggjarætlanum hvat er neyðsyn, arbeiði, dygd ella frítíð.',
    },
    {
      title: '{{count}} bólkar bíða dómi tínum',
      message:
        'Teir hava útgjøld men ongan flokk, so ráðini kunnu ikki vega teir. Ein minuttur í Fíggjarætlanum avger tað.',
    },
    {
      title: 'Gev navn til tað pengarnir tæna',
      message:
        '{{count}} bólkar eru framvegis óflokkaðir. Dómsgreina byrjar við at kalla ting við røttum nøvnum.',
    },
    {
      title: 'Ómett útgjøld: {{count}} bólkar',
      message:
        'Er tað ein tørvur, arbeiðið títt, ein dygd ella ein nøgdsemi? Bert tú kanst siga tað — og ætlanin verður greiðari tá tú gert tað.',
    },
    {
      title: 'Nøkur bólkar hava ongan flokk',
      message:
        '{{count}} bólkar standa uttan fyri teir fýra flokkarnar. Flokka teir í Fíggjarætlanum, so hvørt útgjald verður sæð sum tað er.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: '{{count}} smá keyp hjá {{merchant}}',
      message:
        'Hvørt keyp tykti ómerkiligt; saman gjørdu tey {{totalAmount}} um mánaðin. Smáir, órannsakaðir vanar eru har, sum mest av peninginum hvørvur í tøgn.',
    },
    {
      title: '{{merchant}}: {{count}} ferðir um mánaðin',
      message:
        '{{totalAmount}} í smáum upphæddum. Spyr, um hvør vitjan var eitt val ella ein viðbrigdi: bert tað fyrra er frælsi.',
    },
    {
      title: 'Lítið og lítið: {{totalAmount}}',
      message:
        '{{count}} keyp hjá {{merchant}}. Onki einstakt merkir nakað; vanin ger. Avger hvussu ofta tú veruliga vilt tað.',
    },
    {
      title: 'Ein vani hjá {{merchant}}',
      message:
        '{{count}} keyp, tilsamans {{totalAmount}}. Royn at sleppa einum av hvørjum trimum og sí, um tú saknar tað.',
    },
    {
      title: 'Tey smáu tingini leggjast saman',
      message:
        '{{merchant}} sá tíg {{count}} ferðir, fyri {{totalAmount}}. Ráð á stórum avgerðum verður bygt á smáar sum hesar.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Vikuskiftini bera {{percent}} % av frítíðini',
      message:
        'Tað mesta av frítíðarútgjøldunum tínum hendir hósdag og sunnudag. Hvíld er góð; kanna at tað er hvíld og ikki uppbót fyri vikuna.',
    },
    {
      title: 'Frítíðin livir í vikuskiftinum',
      message:
        '{{percent}} % av frítíðarútgjøldunum falla í vikuskiftið. Ætla vikuskiftið eitt vet, og tað kostar minni og gevur meira.',
    },
    {
      title: 'Vikuskiftið gjaldar fyri vikuna',
      message:
        'Vikuskiftini taka {{percent}} % av tí tú brúkar á frítíð. Um vikan skal lagast hvønn hósdag, hygg at vikuni.',
    },
    {
      title: 'Hósdagur og sunnudagur: {{percent}} % av frítíðini',
      message:
        'Fríir dagar bjóða frí útgjøld. Avger fyri vikuskiftið hvat tað er til, og lat pengarnar fylgja.',
    },
    {
      title: 'Eitt vikuskiftismynstur',
      message:
        '{{percent}} % av frítíðarútgjøldunum hendir í vikuskiftinum. Lættari vikudagar gera ofta vikuskiftini billigari.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} tók {{percent}} % av mánaðinum',
      message:
        '{{totalAmount}} fóru til ein handil til frítíð. Tá ein staður hevur so mikið av pengunum tínum, spyr hvussu mikið av ansi tínum hann eisini hevur.',
    },
    {
      title: 'Ein staður, {{totalAmount}}',
      message:
        '{{merchant}} er {{percent}} % av útgjøldum mánaðarins. Er tað vert so stóran part av lívsarbeiði tínum?',
    },
    {
      title: '{{merchant}} leiðir útgjøld tín',
      message:
        '{{percent}} % av mánaðinum — {{totalAmount}} — fóru hagar. Einki galið í at njóta tað, so leingi tú hevði valt tað aftur.',
    },
    {
      title: 'Ein stórur partur hjá {{merchant}}',
      message:
        '{{totalAmount}}, ella {{percent}} % av útgjøldunum, á einum frítíðarstaði. Veg nøgdsemina móti prísinum, í ró.',
    },
    {
      title: '{{percent}} % hjá {{merchant}}',
      message:
        'Hesin eini handilin tók {{totalAmount}}. Frælsi er at kunna gá framvið tá tú velur tað.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Inntøkan fall, útgjøldini ikki',
      message:
        'Inntøkan fall {{percent}} % til {{incomeAmount}}, men útgjøldini stóðu á {{expenseAmount}}. Lukkan broytti hug; útgjøldini tín hava ikki merkt tað enn.',
    },
    {
      title: 'Inntøkan niður {{percent}} %',
      message:
        '{{incomeAmount}} komu inn móti {{expenseAmount}} út. Tað lukkan gevur, kann hon taka aftur — stilla útgjøldini til tað sum er, ikki tað sum var.',
    },
    {
      title: 'Ein knappari mánaður, teir somu vanarnir',
      message:
        'Inntøkan er {{percent}} % lægri ({{incomeAmount}}), meðan útgjøldini hildu seg á {{expenseAmount}}. Inntøkan er ikki í tínum valdi; svarið er.',
    },
    {
      title: 'Lukkan flutti seg',
      message:
        'Tú vann {{percent}} % minni enn vanligt, men brúkti {{expenseAmount}} sum fyrr. Skar niður nú, meðan tað er eitt val og ikki ein neyðsyn.',
    },
    {
      title: 'Útgjøldini hava ikki fylgt inntøkuni',
      message:
        'Inntøkan fall til {{incomeAmount}} ({{percent}} % niður); útgjøldini eru {{expenseAmount}}. Set seglið eftir tí vindi tú veruliga hevur.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Hald: {{monthlyAmount}} um mánaðin',
      message:
        '{{count}} hald taka {{percent}} % av mánaðarligu útgjøldunum tínum. Hvørt verður endurnýggjað uttan at spyrja tíg — spyr sjálvur um hvørt.',
    },
    {
      title: '{{percent}} % av útgjøldunum endurnýggja seg sjálv',
      message: '{{count}} hald, {{monthlyAmount}} um mánaðin. Hald tey tú hevði tekið aftur í dag.',
    },
    {
      title: 'Stillt, endurtakið, {{monthlyAmount}}',
      message:
        '{{count}} hald kosta {{percent}} % av mánaðinum tínum. Lættleiki er ein góður tænari og ein dýrur harri.',
    },
    {
      title: '{{count}} hald at endurskoða',
      message:
        'Tilsamans eru tey {{monthlyAmount}} um mánaðin, {{percent}} % av útgjøldunum. Sig upp eitt tú næstan ikki brúkar, og merk hvussu lítið tú saknar tað.',
    },
    {
      title: 'Tað sum endurnýggjar seg sjálvt',
      message:
        '{{monthlyAmount}} um mánaðin á {{count}} haldum. Sjálvvirkandi útgjøld fortæna eina viljandi endurskoðan.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Framgongd tín kundi rakt eitt vet longri',
      message:
        'Yvir {{months}} mánaðir helt tú {{savingsPercent}} % av inntøkuni, men næstan einki av tí fór til onnur. Ríkidømi sitir best í opnum hondum — kanska ein gáva ella eitt stuðul henda mánaðin?',
    },
    {
      title: 'Vinnur væl, gevur lítið',
      message:
        '{{incomeAmount}} komu inn yvir {{months}} mánaðir og {{givenAmount}} fóru til onnur. Hjálpir tú á mátar hetta appið ikki sær, so síggj burtur frá hesum; um ikki, hevur ætlanin pláss fyri tí.',
    },
    {
      title: 'Eitt gott ár at vera gávumildur',
      message:
        'Tú sparti {{savingsPercent}} % av inntøkuni — tekin um eina støðuga hond. Ein lítil partur av tí, givin einum sum hevur brúk, hevði gjørt støðugleikan meira verdan.',
    },
    {
      title: 'Ongin annar á myndini enn',
      message:
        'Seinastu {{months}} mánaðirnir vísa varug inntjening og sparing, men onga góðgerð ella gávur. Vit eru gjørd hvør fyri annan; ein beskeðin gáva nøktar at byrja.',
    },
    {
      title: 'Pláss fyri góðsku',
      message:
        'Bert {{givenAmount}} av {{incomeAmount}} fóru til at hjálpa øðrum. Hugsa um eitt lítið, fast stuðul — gávumildi verður lættari við vana, sum hvør dygd.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '„{{goal}}“ dregst aftur',
      message:
        'Tað krevur {{requiredAmount}} um mánaðin, og tú leggur umleið {{paceAmount}} inn. Við hesum tempo kemur tað {{monthsLate}} mánaðir ov seint. Tempoið er í tínum valdi.',
    },
    {
      title: '„{{goal}}“: {{monthsLate}} mánaðir seint við hesari ferð',
      message:
        'Kravt {{requiredAmount}} um mánaðin, veruligt um {{paceAmount}}. Flyt dagfestingina ærliga ella flyt meiri pengar viljandi.',
    },
    {
      title: 'Málið og ferðin eru ósamd',
      message:
        '„{{goal}}“ biður um {{requiredAmount}} um mánaðin; tað fær {{paceAmount}}. Eitt mál er bert so veruligt sum tað mánaðarliga stigið móti tí.',
    },
    {
      title: '„{{goal}}“ hevur brúk fyri einum fastari stigi',
      message:
        '{{paceAmount}} um mánaðin móti teimum {{requiredAmount}} tað krevur. Gjald málinum fyrst næsta mánað, fyri øllum valfríum.',
    },
    {
      title: 'Aftanfyri á „{{goal}}“',
      message:
        'Verandi tempo ({{paceAmount}} um mánaðin) letur tað vera {{monthsLate}} mánaðir ov seint. Tað, sum er í tínum valdi, er næsta stig, ikki alla leiðina.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '„{{goal}}“ hóskar ikki í ætlanina',
      message:
        'Tað krevur {{requiredAmount}} um mánaðin, men eftir fíggjarætlanunum tínum eru bert {{freeAmount}} fríar. Broyt dagfestingina, málið ella ætlanirnar — at vóna er onki ætlan.',
    },
    {
      title: '„{{goal}}“ biður um meira enn tú hevur frítt',
      message:
        '{{requiredAmount}} krevst hvønn mánað, {{freeAmount}} tøkt. At vilja alt í senn er hvussu einki verður gjørt; vel.',
    },
    {
      title: 'Tølini siga nei — í bilið',
      message:
        '„{{goal}}“ krevur {{requiredAmount}} um mánaðin; fríi peningurin tín er {{freeAmount}}. Stilla tað sum er í tínum valdi: freistina ella hinar markirnar.',
    },
    {
      title: '„{{goal}}“ krevur eina avgerð',
      message:
        'Við {{requiredAmount}} um mánaðin fer tað yvir tey {{freeAmount}} sum eru eftir fíggjarætlanunum. Eitt mál valt við opnum eygum er betri enn eitt hildið við ynskishugsan.',
    },
    {
      title: 'Ein ógjørlig ferð fyri „{{goal}}“',
      message:
        'Kravt {{requiredAmount}} mánaðarliga, frítt {{freeAmount}}. Ærlig rokning nú sparar vónbrot seinna.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Støðan tín fer undir null {{date}}',
      message:
        'Við inntøku og útgjøldum, sum tey ganga nú, fer væntaða støðan niður á {{lowestAmount}}. Ger tær klárt nú, meðan tað bert er ein fyriboðan.',
    },
    {
      title: 'Eitt brek kemur: {{date}}',
      message:
        'Gjøld og dagligdagsútgjøld renna undan tí, sum kemur inn, og lægsta støðan er {{lowestAmount}}. Tá ið trupulleikar verða sæddir fyri, missa teir mátt sín.',
    },
    {
      title: 'Ætla fyri {{date}}',
      message:
        'Tann dagin røkkur vænta støðan {{lowestAmount}}. Flyt eitt gjald, hald eitt ynski aftur, ella set pening til síðuna — hvørt av hesum er í tínum valdi í dag.',
    },
    {
      title: 'Fyriboðanin fer niður undir null',
      message:
        'Støðan fer niður á {{lowestAmount}} umleið {{date}}. Rólig viðbrekan er tann tíðliga.',
    },
    {
      title: 'Sí brekið fyri {{date}}',
      message:
        'Vænt lægsta støða: {{lowestAmount}}. Tað sum er sætt fyri, kann møtast við stillfarni; tað sum kemur óvarað, sjáldan.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Tú helt orð tín móti tær sjálvum',
      message:
        'Í {{months}} mánaðir í røð hildu útgjøldini tín seg innan tá ætlan tú setti. Soleiðis sær sjálvsstýring út.',
    },
    {
      title: '{{months}} mánaðir innan ætlan',
      message:
        'Mánað eftir mánað eru ætlan tín og gerð tín samd. Jøvnleiki er stillari enn viljastyrki og varar longri.',
    },
    {
      title: 'Ætlan og lív eru samd',
      message:
        '{{months}} mánaðir í røð innan markirnar tínar. Ein ætlan hildin so væl er ikki longur ein avmarking — tað er hvussu tú livir.',
    },
    {
      title: 'Støðugt í {{months}} mánaðir',
      message:
        'Fíggjarætlanirnar tínar hava hildið {{months}} mánaðir í røð. Hald sama ans; tað virkar.',
    },
    {
      title: 'Sjálvsstýring, varðveitt',
      message:
        '{{months}} mánaðir uttan at bróta ætlan tína. Fátt frælsar sum at kunna líta á sínar egnu avgerðir.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Pengarnir tín fylgja virðum tínum',
      message:
        'Peningar í tænastu dygdarinnar vóru {{actual}} % av útgjøldum tínum, ikki minni enn ætlaðu {{planned}} %. Væl brúkt.',
    },
    {
      title: 'Dygd fekk sín fulla part',
      message:
        '{{actual}} % á heilsu, læring og onnur, móti {{planned}} % ætlaðum. Tað tú virðir, fyri tað gjaldi tú.',
    },
    {
      title: 'Brúkt á at verða betri',
      message:
        'Heilsa, læring og annað fingu {{actual}} % av útgjøldum mánaðarins (ætlað {{planned}} %). Dygd kann ikki keypast, men hon kann tænast.',
    },
    {
      title: 'Ætlan framd',
      message:
        'Tú ætlaði {{planned}} % til dygd og brúkti {{actual}} %. Góðar ætlanir liva sjáldan ein mánað — tínar gjørdu tað.',
    },
    {
      title: 'Tann besta nýtslan av pengum',
      message: '{{actual}} % fóru til tað sum ger tíg og onnur betri. Hald fram at velja tað.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Frítíð á sínum staði',
      message:
        'Frítíð er {{actual}} % av útgjøldunum, undir teimum {{planned}} % tú loyvdi henni. Tú nýtur ting uttan at tey ráða tær.',
    },
    {
      title: 'Nøgdsemi, hildin í stødd',
      message:
        'Frítíð tók {{actual}} % móti {{planned}} % ætlaðum. Mátahald er ikki at missa av — tað er at velja.',
    },
    {
      title: 'Hvíld uttan ovmikið',
      message:
        '{{actual}} % á frítíð, undir markinum tínum á {{planned}} %. Gleði smakkar betur tá hon ikki ræður.',
    },
    {
      title: 'Mátahald, stillt',
      message:
        'Tú gav frítíðini {{planned}} % og hon brúkti bert {{actual}} %. Tað skilið er frælsi tú helt.',
    },
    {
      title: 'Frítíð undir ætlan',
      message:
        'Við {{actual}} % av útgjøldunum helt frítíðin seg undir teimum {{planned}} % tú setti. Væl hildið.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '{{percent}} % undir ætlan',
      message:
        'Tú brúkti {{savedAmount}} minni enn tú loyvdi tær til mánaðin. At hava ikki brúk fyri øllum, sum tú kundi havt, er ein slag av ríkidømi.',
    },
    {
      title: '{{savedAmount}} eftir óbrúkt',
      message:
        'Mánaðurin endaði {{percent}} % undir ætlan. Tað tú ikki brúkti, er framvegis títt at stýra.',
    },
    {
      title: 'Minni enn tú loyvdi',
      message:
        'Útgjøldini eru {{percent}} % undir ætlanini — {{savedAmount}} hildin. Gev tí skilinum eitt endamál áðrenn vanin tekur tað.',
    },
    {
      title: 'Ætlanin hevði pláss til vara',
      message:
        '{{savedAmount}} undir mørkum tínum fyri mánaðin. Mátahald, sum kennist lætt, er tað, sum endist.',
    },
    {
      title: 'Lættari enn ætlað',
      message:
        'Tú hevði brúk fyri {{percent}} % minni enn tú ætlaði. Hugsa um at senda tey {{savedAmount}} móti einum máli.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '„{{goal}}“ er á ætlan',
      message:
        'Tú ert {{percent}} % av vegnum, við tí ferð málið krevur. Støðug stig, tikin mánaðarliga, røkka langt.',
    },
    {
      title: 'Á ætlan móti „{{goal}}“',
      message:
        '{{percent}} % liðugt og ferðin heldur. Hald fram at gjalda málinum fyrst; tað virkar.',
    },
    {
      title: '„{{goal}}“: {{percent}} % og støðugt',
      message: 'Málið fær tað tað hevur brúk fyri hvønn mánað. Tolið ger sítt arbeiði.',
    },
    {
      title: 'Málið rørir seg sum ætlað',
      message:
        '„{{goal}}“ er {{percent}} % fíggjað og í tíð. Tað sum verður gjørt lítið hvønn mánað, verður ikki steðgað av eini ringari viku.',
    },
    {
      title: 'Framgongd tú kanst líta á',
      message:
        '„{{goal}}“ stendur á {{percent}} %, í ferð. Tú byggir tað á tann einasta mátan sum virkar — spakuliga.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: 'Færri snarkeyp hjá {{merchant}}',
      message:
        'Frá {{before}} keypum um mánaðin til umleið {{after}}. Ein vani, sum er loysnaður, er frælsi vunnið.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'Tú vitjar sjáldnari enn fyrr. Hvørt sleppt viðbragd er ein lítil sigur av vali yvir vana.',
    },
    {
      title: 'Tann lítli vanin minkar',
      message:
        'Keyp hjá {{merchant}} fullu frá {{before}} til um {{after}}. Hald fram — tað verður lættari.',
    },
    {
      title: 'Val fram um viðbragd',
      message:
        'Hjá {{merchant}} fórt tú frá {{before}} keypum til um {{after}}. Tað er ráð bygt ein avgerð í senn.',
    },
    {
      title: 'Minni av tí smáa',
      message:
        '{{merchant}} sá tíg um {{after}} ferðir í staðin fyri {{before}}. Smáir sigrar leggjast saman.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Tú tillagaði tíg einum knappari mánaði',
      message:
        'Inntøkan fall {{incomePercent}} %, og tú skar útgjøldini {{expensePercent}} %. Tú møtti eini broyting í lukkuni við eini broyting í kós.',
    },
    {
      title: 'Stillfarni tá inntøkan fall',
      message:
        'Inntøkan niður {{incomePercent}} %, útgjøldini niður {{expensePercent}} %. Tú tillagaði tíg tí sum er, ikki tí sum var.',
    },
    {
      title: 'Lukkan broyttist; tað gjørdi tú eisini',
      message:
        'Eitt fall í inntøkuni á {{incomePercent}} % møtti einum falli í útgjøldunum á {{expensePercent}} %. Tað er sinnisró í tølum.',
    },
    {
      title: 'Væl stýrt',
      message:
        'Tá inntøkan fall {{incomePercent}} %, fylgdu útgjøldini ({{expensePercent}} % minni). Vindurin var ikki tín; seglið var.',
    },
    {
      title: 'Útgjøldini fylgdu inntøkuni niður',
      message:
        'Tú brúkti {{expensePercent}} % minni tá inntøkan fall {{incomePercent}} %. At tillaga seg tíðliga er tann rólig vegurin ígjøgnum.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'Neyðsynjar eru støðugar',
      message:
        'Í {{months}} mánaðir hava neyðugu kostnaðirnir tínir næstan ikki rørt seg. Eitt støðugt golv gevur tær frælsi omanfyri tað.',
    },
    {
      title: 'Tørvir hildnir í teymum',
      message:
        'Útgjøld til neyðsynjar hildu seg jøvn í {{months}} mánaðir. Tørvir sum ikki vaksa eru tørvir tú stýrir.',
    },
    {
      title: '{{months}} mánaðir av støðugum neyðsynjum',
      message:
        'Húsaleiga, matur og rokningar hildu seg hvar tey vóru. Stillur støðugleiki er eisini eitt úrslit.',
    },
    {
      title: 'Onki krøking í neyðsynjum',
      message:
        '{{months}} mánaðir uttan rák í tí lívið krevur. Alt annað er lættari at ætla á tí grundarlagi.',
    },
    {
      title: 'Eitt fast golv',
      message:
        'Neyðug útgjøld hava verið støðug í {{months}} mánaðir. Tú letur ikki trivnað gá fyri tørv.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Gávumildur við tað tú vinnur',
      message:
        'Yvir {{months}} mánaðir fóru {{percent}} % av inntøkuni tíni — {{givenAmount}} — til at hjálpa øðrum. Tað eru pengar settir í sína bestu nýtslu.',
    },
    {
      title: '{{givenAmount}} givin øðrum',
      message:
        'Tú deildi {{percent}} % av inntøkuni tíni á {{months}} mánaðum. Góðska sum sæst í tølunum, er góðska útint, ikki bert kend.',
    },
    {
      title: 'Opnar hendur',
      message:
        'Góðgerð og gávur tóku {{percent}} % av inntøkuni tíni síðstu tíðina. Tað tú gevur frá tær, er tann parturin av ríkidømi tínum sum ongin óheppni kann taka.',
    },
    {
      title: 'Gávumildi er partur av ætlan tíni',
      message:
        '{{givenAmount}} til onnur yvir {{months}} mánaðir. Hald tað — tað góða tú gert fyri onnur, er eisini gjørt fyri tíg sjálvan.',
    },
    {
      title: 'Væl givið',
      message:
        '{{percent}} % av tí tú vann, fóru til at hjálpa øðrum. Fáir vanar siga meira um ein mann.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Einki at rætta',
      message: 'Útgjøldini tín svara til tað tú ætlaði. Hald fram sum tú ert.',
    },
    {
      title: 'Ætlan og gerð eru samd',
      message: 'Mánaðurin sær út, sum tú ætlaði hann. Tað samljóð er alt málið.',
    },
    {
      title: 'Ein rólig mánaður',
      message:
        'Onki ovmikið, onki vanræksla verd at nevna. Væl gjørt — tak sama ans við tær víðari.',
    },
    {
      title: 'Alt í lagi',
      message: 'Ætlanin tín helt og einki biður um rætting. Nýt tann frið tú hevur vunnið.',
    },
    {
      title: 'Støðug hond',
      message: 'Mánaðurin fylgdi ætlan tíni. Góðir vanar gera góðar mánaðir at síggja vanligar út.',
    },
  ],
  'stoic.keep_first': [
    {
      title: 'Varða tín part fyrst',
      message:
        'Á {{months}} mánaðum helt tú {{savingsPercent}} % av inntøkuni eftir. Viðvíking Seneca: tað er ov seint at spara, tá ið tú ert komin niður á botnin á fatinum. Leg {{tenthAmount}} av sær tann dagin, inntøkan kemur.',
    },
    {
      title: 'Spara úr ovara parti av fatinum',
      message:
        'Bert {{savingsPercent}} % av inntøkuni gjørdist verandi hjá tær. Sparni, sum bíðar eftir tí, ið er afturvið, kemur ov seint; {{tenthAmount}} um mánaðin, lagdar av sær fyrst, byrjar tað nú.',
    },
    {
      title: 'Halt tær fast í tað, sum er títt',
      message:
        'Seneca ráðir til at varða tað, sum veruliga er títt, og at byrja tíðliga. Seinast eru {{savingsPercent}} % av inntøkuni blivin eftir hjá tær; byrja við {{tenthAmount}} á lønardegnum og lat útgjøldini laga seg eftir restini.',
    },
    {
      title: 'Byrja áðrenn botnfallið',
      message:
        'Tú helt {{savingsPercent}} % eftir á {{months}} mánaðum. Sparni er í tínum valdi bert so leingi, sum nakað er eftir at spara: flyt {{tenthAmount}} av sær fyri alt annað.',
    },
    {
      title: '{{savingsPercent}} % goymd, og fatið tømist',
      message:
        '{{tenthAmount}} um mánaðin, ein tíggjundi av inntøkuni, lagdar av sær áðrenn nakað rokning. Tað, tú varðar fyrst, er óheft av tí, mánaðurin letur eftir.',
    },
  ],
  'stoic.prepare_beforehand': [
    {
      title: 'Ger tær klárt, meðan alt er stillisligt',
      message:
        'Goymslan hjá tær røkkur til umleið {{cushionDays}} dagar av útgjøldum. Seneca: sálin eigur at harðna í tíðum uttan sorgir. Útgjøld í trý mánaðir eru {{targetAmount}}.',
    },
    {
      title: 'Goymsla til {{cushionDays}} dagar',
      message:
        'Lukkan boðar ikki frá, at hon kemur. Bygg upp ímóti {{targetAmount}}, útgjøldum í trý mánaðir, meðan einki trýstir á: tá er tað lætt.',
    },
    {
      title: '„Var tað henda støðan, eg ræddist?“',
      message:
        'Seneca læt Lucilius venja seg við fátækradømi, so tað misti skelkin. Við goymslu til {{cushionDays}} dagar var ein trupul mánaður ongin venjing. Set tær sum mál {{targetAmount}}.',
    },
    {
      title: 'Sjóa tungan mánaðin fyri',
      message:
        'Sparingin hjá tær dygði til umleið {{cushionDays}} dagar. Tað, sum er sæð fyri, kemur mildiliga; {{targetAmount}} dygdu tær í trý mánaðir.',
    },
    {
      title: 'Reis múrin áðrenn ódnin',
      message:
        'Umleið {{cushionDays}} dagar eru tryggjaðir. At missa inntøku er ikki í tínum valdi, men goymslan er. Útgjøld í trý mánaðir gera {{targetAmount}}.',
    },
  ],
  'stoic.wants_outrun_income': [
    {
      title: 'Ynskini renna undan inntøkuni',
      message:
        'Útgjøldini vuksu {{expenseGrowth}} % seinasta fjórðing, meðan inntøkan broyttist {{incomeGrowth}} %. Tann er ikki fátækur, sum hevur ov lítið, skrivar Seneca, men tann, sum tráir meira.',
    },
    {
      title: 'At liva hægri, ikki betri',
      message:
        'Útgjøldini vuksu {{expenseGrowth}} %, inntøkan {{incomeGrowth}} %. Tørvur náttúrunnar er lítil; krøv almenningsmeiningarinnar eru markleys. Spyr tær, hvørjum teirra vøksturin tænir.',
    },
    {
      title: 'Ynskini hava vaksið: +{{expenseGrowth}} %',
      message:
        'Útgjøldini hækkaðu skjótari enn inntøkan ({{incomeGrowth}} %). Nýtt hóg kennist skjótt sum ein tørvur: legg til merkis, meðan tú enn kanst sigast frá.',
    },
    {
      title: 'Málini flyta seg',
      message:
        'Útgjøldini eru {{expenseGrowth}} % hægri enn fjórðingin undan, inntøkan {{incomeGrowth}} %. Nóg verður verandi nóg bert um tú sjálvur avger, hvat tað er.',
    },
    {
      title: 'Meira er ikki lækingin',
      message:
        'Seinasta fjórðing vuksu útgjøldini {{expenseGrowth}} % og inntøkan {{incomeGrowth}} %. Ríkidømi, sum vaksur við ynskinum, kemur aldri á mál; set eitt mark, áðrenn hetta gerst nýggja vanliga.',
    },
  ],
  'stoic.price_in_life': [
    {
      title: '{{merchant}} kostaði tær {{hours}} tímar av lívinum',
      message:
        'Seneca minnir á, at bert tíðin er veruliga okkara. {{totalAmount}} hjá seljaranum {{merchant}} eru umleið {{hours}} tímar av arbeiði tínum. Var tað tað vert?',
    },
    {
      title: '{{hours}} tímar: {{merchant}}',
      message:
        'Vit verja peningin og geva tíðina burtur. Við miðal-tímaløn tíni eru {{totalAmount}} her umleið {{hours}} arbeiðstímar.',
    },
    {
      title: 'Set prís í tímum',
      message:
        '{{totalAmount}} hjá seljaranum {{merchant}} eru umleið {{hours}} tímar av arbeiði. Tímarnir eru tað einasta, tú ikki kanst vinna aftur.',
    },
    {
      title: 'Hvat {{merchant}} veruliga kostaði',
      message:
        'Tú býtir tínar dagar fyri pening og pening fyri lutir. {{merchant}} tók umleið {{hours}} tímar av tínum ({{totalAmount}}). Svarar nøgdsemið til tímarnar?',
    },
    {
      title: 'Vátta tímarnar',
      message:
        'Umroknað við miðal-tímaløn tíni eru {{totalAmount}} hjá seljaranum {{merchant}} umleið {{hours}} tímar. Vit missa nógva av tíðini, skrivar Seneca. Valdi tú hetta?',
    },
  ],
  'stoic.rule_broken': [
    {
      title: 'Reglan „{{rule}}“ er farin vilt',
      message:
        'Hon peikar á okkurt, sum ikki er til longur, so hon er steðgað at virka í tøgn. Bøt hana ella tak hana burtur: skipan, sum onki ger, sær bert út sum skipan.',
    },
    {
      title: '„{{rule}}“ virkar ikki longur',
      message:
        'Bólkurin, kontan ella móttakarin er horvin, og reglan verður nú sniðgingin á hvørjari flytan. Sí lutirnar, sum teir eru, og bøt teir síðani.',
    },
    {
      title: 'Ein regla, sum miðar á einki',
      message:
        '„{{rule}}“ sendir flytanir til ein stað, sum er tikin burtur. Tú avgjørdi eina ferð; avger aftur nú, tá ið lutirnir eru broyttir.',
    },
    {
      title: '„{{rule}}“ hevur brúk fyri døming tíni',
      message:
        'Tað, hon vísir til, er strikað, og flytanirnar, hon flokkaði fyrr, bíða nú eftir tær. Gev henni eitt nýtt mál ella lat hana fara.',
    },
    {
      title: 'Brotin regla, í tøgn',
      message:
        '„{{rule}}“ ger einki og sigur einki um tað. Bøt tað, sum er í tínum valdi: tað tekur eina minnutt.',
    },
  ],
  'stoic.rule_contradicted': [
    {
      title: 'Hond tín er ósamd við „{{rule}}“',
      message:
        '{{count}} ferðir flokkaði tú við hond annað, enn hendan reglan flokkar. Antin er reglan skeiv ella hondin: avger hvør.',
    },
    {
      title: '„{{rule}}“ varð yvirsitin {{count}} ferðir',
      message:
        'Ein regla, sum tú javnan rættar, er ikki longur ein avgerð, bert ein vani at kappast við seg sjálvan. Broyt hana ella lit á hana.',
    },
    {
      title: 'Sig, hvat tú gert, og ger, hvat tú segði',
      message:
        'Reglan „{{rule}}“ sigur eitt; seinastu {{count}} rættingar tínar siga annað. Fá hesi bæði í samljóð.',
    },
    {
      title: 'Ein avgerð í tvísti',
      message:
        'Tú setti „{{rule}}“ við greiðum huga, og {{count}} flytanir eru síðani farnar aðra leið. Hygg enn einaferð, í ró, at hvør tykkara hevði rætt.',
    },
    {
      title: '{{count}} rættingar ímóti „{{rule}}“',
      message: 'Endurtøka er kunning. Lat hana broyta regluna, ella lat regluna broyta vanan.',
    },
  ],
  'stoic.rule_worth_writing': [
    {
      title: 'Avger eina ferð: {{payee}}',
      message:
        'Tú hevur flokkað móttakaran {{payee}} við hond {{decided}} ferðir, altíð á sama hátt. Tað, tú avger aftur og aftur, avger eina ferð, við greiðum huga.',
    },
    {
      title: 'Ein avgerð tikin {{decided}} ferðir',
      message:
        'Móttakarin {{payee}} spyr sama spurning, og tú gevur sama svar. Ein regla varðveitti eftirtekt tína til tað, sum veruliga hevur brúk fyri henni.',
    },
    {
      title: 'Móttakarar klárir til eina reglu: {{count}}',
      message:
        'Somu móttakararnir fáa sama bólk hjá tær, mest {{payee}}. Spara døming tína til tað, sum er nýtt.',
    },
    {
      title: 'Vani tín er klárur at gerast ein grundregla',
      message:
        'Tú flokkar móttakaran {{payee}} á sama hátt hvørja ferð ({{decided}} ferðir higartil). Skriva tað sum eina reglu, og tað heldur uttan møði.',
    },
    {
      title: 'Lat eina reglu bera hetta',
      message:
        'Móttakarar, sum tú flokkar eins hvørja ferð: {{count}}, og móttakarin {{payee}} við {{decided}} flytanum. Ein grundregla, avgjørd eina ferð, skal ikki rædast av nýggjum.',
    },
  ],
  'stoic.rule_idle': [
    {
      title: '„{{rule}}“ hevur einki rakt í {{months}} mánaðir',
      message:
        'Antin er heimurin, sum hon varð gjørd fyri, horvin, ella treytirnar missa málið. Halt reglur tínar sannar: bøt ella tak burtur.',
    },
    {
      title: 'Ein regla í hvíld: „{{rule}}“',
      message:
        'Hon hevur ikki nomið við eina flytan í {{months}} mánaðir. Kast tað burtur, sum er yvirflótið; tað, sum verður eftir, er lættari at lita á.',
    },
    {
      title: '„{{rule}}“ stendur ført',
      message:
        '{{months}} mánaðir uttan samsvar, meðan nýggjar flytanir halda áfram at koma. Royn hana á nýggjastu flytanirnar og avger síðani.',
    },
    {
      title: 'Er „{{rule}}“ framvegis neyðug?',
      message:
        'Einki hevur svarað til hana í {{months}} mánaðir. Ein regla, sum verður hildin av vana, er ein ting afturat at hugsa um.',
    },
    {
      title: 'Ein avgerð, sum onki hevur at avgera',
      message:
        '„{{rule}}“ hevur tagt í {{months}} mánaðir. Skipan merkir at eiga tað, sum tørvur er á, og einki umframt.',
    },
  ],
  'stoic.praise_rules_hold': [
    {
      title: 'Avgerðir tínar halda',
      message:
        'Reglur flokkaðu {{percent}} % av flytanum mánaðarins, og tú hevði ikki tørv á at yvirsita nakra. Ein avgerð, tikin eina ferð og hildin, loysir sinnið.',
    },
    {
      title: '{{percent}} % avgjørd frammanundan',
      message:
        'Flestu flytanir mánaðarins vórðu flokkaðar eftir tí, tú hevði avgjørt fyrr. Tað er eftirtekt, sum er spard til tað, sum hevur týdning.',
    },
    {
      title: 'Grundreglur í virki',
      message:
        'Reglur tínar røktu {{percent}} % av flytanum uttan tvist. Fastar grundreglur gera dagarnar stillisligar.',
    },
    {
      title: 'Minni at avgera',
      message:
        '{{percent}} % av flytanum kravdu ongar nýggjar avgerðir. Tú dømdi eina ferð, væl, og dómurin stendur enn.',
    },
    {
      title: 'Skipan hildin',
      message:
        'Reglur flokkaðu {{percent}} % av mánaðinum, og eingin varð mótsagd. Góð skipan sær út, sum einki hendir.',
    },
  ],
  'stoic.goal_no_date': [
    {
      title: '„{{goal}}“ hevur ongan dag',
      message:
        'Tað stendur á {{percent}} %, og einki rennur inn. Tá ið tú ikki veitst, hvørja havn tú siglir til, er eingin vindur røttur: nevn dagin, tú ætlar at koma.',
    },
    {
      title: 'Ynski ella mál?',
      message:
        '„{{goal}}“ hevur hvørki freist ella tempo. Eitt mál er ein avgerð við degi; gev tí ein ella lat tað fara.',
    },
    {
      title: 'Nevn dagin fyri „{{goal}}“',
      message:
        'Tað er {{percent}} % á leið og rørir seg ikki. Tað, sum kann gerast hvønn tíð sum helst, verður sjáldan gjørt.',
    },
    {
      title: '„{{goal}}“ bíðar eftir „einaferð“',
      message:
        'Einki er farið inn í tað seinastu tíðina, og eingin dagur krevur nakað. „Einaferð“ er ikki í dagbókini hjá tær; vel ein dag, sum er.',
    },
    {
      title: '„{{goal}}“ hevur onga havn',
      message: 'Á {{percent}} %, uttan freist. Veit, hvar tú siglir, og mánaðarskrefið fylgir.',
    },
  ],
};
