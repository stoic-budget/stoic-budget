import type { StoicTextMap } from './types';

export const fi: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'Kuukausi kasvoi suunnitelmansa yli',
      message:
        'Suunnittelit {{plannedAmount}} ja olet käyttänyt {{spentAmount}} — {{percent}} % enemmän. Suunnitelma tehtiin selvin päin; anna sen äänen kantaa pidemmälle kuin hetken.',
    },
    {
      title: '{{percent}} % yli sen, mitä aioit käyttää',
      message:
        'Kulut ovat {{spentAmount}} vastaan suunnitelma {{plannedAmount}}. Katso, mikä raja petti ensin — siinä on opetus.',
    },
    {
      title: 'Suunnitelmasi ja kuukautesi ovat eri mieltä',
      message:
        '{{spentAmount}} käytetty, {{plannedAmount}} aiottu. Joko suunnitelma vaati liian vähän todellisuudelta tai todellisuus liian paljon sinulta — päätä rauhassa kummasta.',
    },
    {
      title: 'Ulos lähti enemmän kuin annoit lupaa',
      message:
        'Kuukausi on {{percent}} % yli asettamasi {{plannedAmount}}. Mitään ei menetetä pysähtymällä nyt; paljon menetetään teeskentelemällä, ettei sitä tapahtunut.',
    },
    {
      title: 'Raja jonka asetit, raja jonka ylitit',
      message:
        'Aioit käyttää {{plannedAmount}}; se on {{spentAmount}}. Itsehallinta ei ole koskaan lipsumatta — se on huomata ajoissa ja palata polulle.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Vapaa-aika vie enemmän kuin suunnittelit',
      message:
        'Tarkoitit vapaa-ajan olevan {{planned}} % kuluistasi; se oli {{actual}} %. Nautinto on tervetullut vieraana, ei talon isäntänä.',
    },
    {
      title: 'Vapaa-aika {{actual}} %, suunniteltu {{planned}} %',
      message:
        'Lepo ansaitsee paikkansa, kun se palauttaa sinut. Kysy, mitkä kuukauden nautinnoista tekivät niin, ja päästä loput ilman katumusta.',
    },
    {
      title: 'Mukavuus kuluttaa enemmän kuin aikomus',
      message:
        'Vapaa-aika pitää {{actual}} % kuluista vastaan valitsemasi {{planned}} %. Kohtuus ei ole nautinnon kieltämistä — se on sen pitämistä siinä koossa, jonka päätit.',
    },
    {
      title: 'Miellyttävä syrjäyttää suunnitellun',
      message:
        'Annoit vapaa-ajalle {{planned}} % suunnitelmasta ja se otti {{actual}} %. Se mistä nautit vaivatta, kannattaa katsoa toisen kerran, ennen kuin siitä tulee se mitä tarvitset.',
    },
    {
      title: 'Vapaa-aika on astunut rajansa yli',
      message:
        '{{actual}} % kuukaudesta meni vapaa-aikaan, {{planned}} % oli aikomus. Raja oli sinun piirrettäväsi, ja se on sinun pidettäväsi.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Vapaa-aika jälleen yli suunnitelman',
      message:
        'Vapaa-aika ylitti suunnitelmasi {{months}} kuukaudessa viimeisistä {{window}} kuukaudesta. Toisto ei ole enää vahinko — se on tapa, jota kannattaa tarkastella.',
    },
    {
      title: '{{months}} / {{window}} kuukautta yli vapaa-ajan suunnitelman',
      message:
        'Mikä tapahtuu kerran, on olosuhde; mikä tapahtuu {{months}} kertaa, on muotoutuvaa luonnetta. Valitse luonne tarkoituksella.',
    },
    {
      title: 'Sama lipsahdus, kuukausi toisensa jälkeen',
      message:
        'Vapaa-aika karkasi suunnitelmasta {{months}} kuukaudessa {{window}} kuukaudesta. Nosta suunnitelmaa rehellisesti tai muuta tapaa — näiden välissä eläminen on kalleinta.',
    },
    {
      title: 'Kuvio, ei poikkeus',
      message:
        '{{months}} kuukaudessa viimeisistä {{window}} vapaa-aika otti enemmän kuin annoit. Huomaa hetki, jolloin päätös tehdään, älä vain laskua jälkeenpäin.',
    },
    {
      title: 'Tapa äänestää suunnitelmaasi vastaan',
      message:
        'Vapaa-aika voitti suunnitelman {{months}} kertaa {{window}} kuukaudessa. Tavat rakennetaan yksi valinta kerrallaan; samoin ne puretaan.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'Hyve saa vähemmän kuin aioit',
      message:
        'Varasit {{planned}} % budjetistasi terveydelle, oppimiselle ja muulle; se oli {{actual}} %. Aikomus lasketaan, kun se on toteutettu.',
    },
    {
      title: 'Hyve {{actual}} %, suunniteltu {{planned}} %',
      message:
        'Rahat, jotka aioit käyttää siihen, mikä tekee sinusta paremman, odottavat yhä. Parempaa hetkeä käyttää ne hyvin ei ole kuin nyt.',
    },
    {
      title: 'Suunniteltu hyvä on käyttämättä',
      message:
        'Terveyden, oppimisen ja anteliaisuuden oli määrä saada {{planned}} % kuluista; ne saivat {{actual}} %. Tee yksi niistä tällä viikolla, tarkoituksella.',
    },
    {
      title: 'Aikomus ilman tekoa',
      message:
        'Hyve pitää {{actual}} % kuluista vastaan valitsemasi {{planned}} %. Se mitä arvostamme, näkyy siinä mistä todella maksamme.',
    },
    {
      title: 'Tilaa on jäljellä sille mikä merkitsee',
      message:
        'Vain {{actual}} % meni hyveeseen, vaikka suunnittelit {{planned}} %. Kirja, terveystarkastus, lahja apua tarvitsevalle — suunnitelma on jo sanonut kyllä.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'Hyvettä lykätään yhä',
      message:
        'Terveyteen, oppimiseen ja toisiin käytetyt rahat ovat jääneet suunnitelmasi alle {{months}} kuukautta putkeen. Sen mitä lykkäät jatkuvasti, olet tosiasiassa päättänyt jättää.',
    },
    {
      title: '{{months}} kuukautta lykättyä hyvettä',
      message:
        'Joka kuukausi suunnitelma teki tilaa sille mikä tekee sinusta paremman, ja joka kuukausi se jäi käyttämättä. Aika on se yksi asia, jota ei voi budjetoida kahdesti.',
    },
    {
      title: 'Parempi itse odottaa vielä',
      message:
        'Hyve on ollut suunnitelman alle {{months}} kuukautta peräkkäin. Aloita pienesti ja varmasti ennemmin kuin suuresti ja myöhemmin.',
    },
    {
      title: 'Hyvät aikomukset vanhenevat',
      message:
        '{{months}} kuukauden ajan terveys, oppiminen ja anteliaisuus saivat vähemmän kuin suunnittelit. Valitse yksi ja rahoita se ensin ensi kuussa, ennen muuta.',
    },
    {
      title: 'Hyve häviää aina ”myöhemmälle”',
      message:
        '{{months}} kuukautta putkeen alle suunnitelman. Myöhemmin on paikka, johon hyvät aikomukset menevät unohtumaan — anna tälle päivämäärä.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'Suunnitelmassasi ei ole tilaa hyveelle',
      message:
        'Yksikään budjetistasi ei palvele terveyttä, oppimista tai toisia. Suunnitelma kertoo, mitä arvostamme — anna hyveelle oma rivi.',
    },
    {
      title: 'Kaikki budjetit, mutta ei yhtään hyvälle',
      message:
        'Välttämättömyydellä, työllä ja vapaa-ajalla on rajat; hyveellä ei ole. Se mitä ei koskaan suunnitella, jää yleensä tapahtumatta.',
    },
    {
      title: 'Suunnittele se mikä tekee sinusta paremman',
      message:
        'Hyveluokassa ei ole vielä yhtään budjettia. Pienikin — kirjat, liikunta, lahjoitus — muuttaa toiveen sitoumukseksi.',
    },
    {
      title: 'Suunnitelma on vaiti hyveestä',
      message:
        'Budjetoit sen mikä on pakko ja sen mistä nautit, et vielä sitä kuka haluat olla. Yksi vaatimaton hyvebudjetti muuttaisi sen.',
    },
    {
      title: 'Hyveelle ei ole budjettia',
      message:
        'Terveyteen, oppimiseen tai toisiin käytettävää rahaa ei ole suunniteltu mihinkään. Valitse yksi ja anna sille raja, jonka saavuttamisesta olisit iloinen.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'Välttämättömyydet kustantavat enemmän kuin suunniteltu',
      message:
        'Suunnittelit {{planned}} % kuluista välttämättömyyksiin; ne vievät {{actual}} %. Tarkista, onko jokainen vielä tarve vai hiljaa muuttunut mukavuudeksi.',
    },
    {
      title: 'Välttämättömyys {{actual}} %, suunniteltu {{planned}} %',
      message:
        'Se mitä elämä vaatii, on yleensä vähemmän kuin se mihin tottuu. Käy suurin välttämättömyys läpi tuorein silmin.',
    },
    {
      title: 'Olennainen paisuu',
      message:
        'Välttämättömyydet pitävät {{actual}} % kuukaudesta vastaan odottamasi {{planned}} %. Tarve joka jatkaa kasvuaan ansaitsee kysymyksen.',
    },
    {
      title: 'Tarpeet kasvavat suunnitelman yli',
      message:
        'Suunniteltu {{planned}} %, toteutunut {{actual}} %. Joko suunnitelma aliarvioi todelliset kustannukset, tai jotkin halut matkustavat tarpeiden nimellä.',
    },
    {
      title: '”Pakko”-menoihin enemmän kuin aiottu',
      message:
        'Välttämättömyydet vievät {{actual}} % kuluista {{planned}} %:n sijaan. Erota se mikä todella on pakko siitä mikä vain on aina ollut.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'Välttämättömyydet hiipivät ylös',
      message:
        'Välttämättömyyksiin käytetty raha on noussut {{months}} kuukautta putkeen, yhteensä {{percent}} %. Tarpeet kasvavat hiljaa, kun kukaan ei vaadi niitä perustelemaan itseään.',
    },
    {
      title: '+{{percent}} % välttämättömyyksissä {{months}} kuukaudessa',
      message:
        'Jokainen askel näytti pieneltä; yhdessä ne eivät ole. Ota suurin toistuva välttämättömyys ja kysy, täytyykö sen vielä kustantaa näin paljon.',
    },
    {
      title: 'Kulutuksesi lattia nousee',
      message:
        'Välttämättömyydet kasvoivat {{months}} kuukautta peräkkäin (+{{percent}} %). Nouseva lattia jättää vähemmän tilaa kaikelle minkä valitset vapaasti.',
    },
    {
      title: 'Tarpeet laajenevat',
      message:
        '{{months}} kuukautta kasvua, {{percent}} % kaiken kaikkiaan. Stoalainen koe on yksinkertainen: valitsisitko tämän tänään uudelleen, kun tiedät sen hinnan?',
    },
    {
      title: 'Pieniä nousuja, vakaa suunta',
      message:
        'Välttämättömyydet ovat ylös {{percent}} % {{months}} kuukauden aikana. Suunta merkitsee enemmän kuin yksittäinen kuukausi — tämä kannattaa korjata ajoissa.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'Työ kustantaa enemmän kuin suunniteltu',
      message:
        'Suunnittelit {{planned}} % kuluista työhön; se vie {{actual}} %. Työkalujen ja palvelujen on ansaittava paikkansa — tarkista mitkä ansaitsevat.',
    },
    {
      title: 'Työn kulut {{actual}} %, suunniteltu {{planned}} %',
      message:
        'Työhön investointi on hyvä, kun se tuottaa jotain. Käy läpi, mistä maksat mutta mitä et enää käytä.',
    },
    {
      title: 'Työbudjetti on venynyt',
      message:
        'Työ vei {{actual}} % {{planned}} %:n sijaan. Ahkeruus on työn tekemistä hyvin, ei jokaisen työkalun ostamista siihen.',
    },
    {
      title: 'Työkalut kuluttavat yli suunnitelman',
      message:
        'Suunniteltu {{planned}} %, käytetty {{actual}} % työhön. Kysy jokaiselta kululta: auttaako se minua tekemään työn, vai tuntuuko se vain edistykseltä?',
    },
    {
      title: 'Työn kulut ovat liukuneet',
      message:
        'Työ pitää {{actual}} % kuluista vastaan aiotun {{planned}} %. Nopea tarkastus nyt säästää suuremman myöhemmin.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '”{{category}}” rikkoo rajansa toistuvasti',
      message:
        '”{{category}}” meni yli budjetin {{months}} kuukaudessa viimeisistä {{window}} kuukaudesta. Joko raja on väärä tai halu on — päätä kumpi.',
    },
    {
      title: '”{{category}}”: yli budjetin {{months}} / {{window}} kuukautta',
      message:
        'Raja joka aina ylitetään, ei ole raja vaan toive. Tee siitä rehellinen — nosta sitä tarkoituksella tai pidä se tarkoituksella.',
    },
    {
      title: 'Sama budjetti pettää jälleen',
      message:
        '”{{category}}” on ylittänyt rajansa {{months}} kertaa {{window}} kuukaudessa. Toisto on tietoa; käytä sitä.',
    },
    {
      title: '”{{category}}” pyytää huomiotasi',
      message:
        'Yli budjetin {{months}} kuukaudessa {{window}} kuukaudesta. Tarkkaile hetkeä ennen ostoa — se on ainoa paikka, jossa tapa voi muuttua.',
    },
    {
      title: 'Kuvio kohteessa ”{{category}}”',
      message:
        '{{months}} ylitystä {{window}} kuukaudessa. Siksi tulemme, mitä toistamme; päätä mitä haluat tämän kategorian kertovan sinusta.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '”{{category}}” loppuu noin päivänä {{day}}',
      message:
        'Olet käyttänyt {{spentAmount}} / {{limitAmount}}, ja tällä tahdilla raja loppuu noin päivänä {{day}}. Hidastaminen nyt on helpompaa kuin pysähtyminen myöhemmin.',
    },
    {
      title: '”{{category}}” on kuukautta edellä',
      message:
        '{{spentAmount}} on jo mennyt {{limitAmount}}:n rajasta. Tällä vauhdilla se on käytetty noin päivänä {{day}} — loppukuu on silti sinun muotoiltavissasi.',
    },
    {
      title: 'Tahtitarkistus: ”{{category}}”',
      message:
        '{{limitAmount}}:n budjetti riittää nykytahdilla noin päivään {{day}}. Ennakointi on halvin kuri.',
    },
    {
      title: '”{{category}}” kuluttaa tulevaisuutta',
      message:
        '{{spentAmount}} / {{limitAmount}} käytetty; raja päättyy lähellä päivää {{day}}. Se mitä teet tällä viikolla, ratkaisee tapahtuuko se.',
    },
    {
      title: 'Varoitus ajoissa: ”{{category}}”',
      message:
        'Nykytahdilla {{limitAmount}}:n raja ei kanna kuun loppuun — se loppuu noin päivänä {{day}}. Säädä, kun se maksaa vähän.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '”{{category}}” on jäänyt käyttämättä',
      message:
        '”{{category}}”-budjetissa ei ole näkynyt kuluja {{months}} kuukauteen. Joko olet kasvanut siitä ulos tai se on aikomus, joka vielä odottaa — päätä kumpi.',
    },
    {
      title: 'Tyhjä budjetti: ”{{category}}”',
      message:
        '{{months}} kuukautta ilman yhtäkään menoa. Suunnitelman tulisi kuvata elämää, jota elät, tai sitä, jota rakennat — kumpi tämä on?',
    },
    {
      title: '”{{category}}” seisoo toimettomana',
      message:
        'Täällä ei ole käytetty mitään {{months}} kuukauteen. Jos se oli pidättyvyyttä, hyvä; jos se oli laiminlyöntiä, tee sille jotain.',
    },
    {
      title: 'Suunniteltu, mutta ei elettyä',
      message:
        '”{{category}}”-budjetilla on ollut raja ja ei kuluja {{months}} kuukauteen. Pidä suunnitelma totuudenmukaisena: poista se tai käytä sitä.',
    },
    {
      title: '”{{category}}”: {{months}} hiljaista kuukautta',
      message:
        'Budjetti jota ei koskaan kosketa, varaa silti paikan suunnitelmassasi. Vapauta paikka tai kunnioita aikomusta.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}} % kuluista on ilman rajaa',
      message:
        '{{unbudgetedAmount}} kuukaudesta meni luokkiin, joita mikään budjetti ei valvo. Mitä et ole katsonut, sitä et voi arvioida.',
    },
    {
      title: 'Suuri osa kuukaudesta on suunnittelematta',
      message:
        '{{percent}} % kuluista — {{unbudgetedAmount}} — on kaikkien budjettien ulkopuolella. Anna suurimmalle osalle raja, niin suunnitelma näkee enemmän elämästäsi.',
    },
    {
      title: 'Kulutus suunnitelman ulkopuolella',
      message:
        'Budjetit kattavat vain osan kuluistasi; {{unbudgetedAmount}} ({{percent}} %) jää mittaamatta. Laajenna suunnitelma sinne, minne raha tosiasiassa menee.',
    },
    {
      title: 'Suunnitelma näkee vain osan kuvasta',
      message:
        '{{percent}} % kuukauden kuluista on ilman budjettia. Selkeä näkemys tulee ennen hyvää arvostelua.',
    },
    {
      title: '{{unbudgetedAmount}} käytetty ilman rajaa',
      message:
        'Se on {{percent}} % kuukaudesta. Sinun ei ole pakko rajoittaa sitä — vain päättää, kuinka paljon siitä todella haluat.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '”{{category}}” on suurin osa vapaa-ajastasi',
      message:
        '{{percent}} % vapaa-ajan kuluista meni luokkaan ”{{category}}”. Nauti siitä, mutta tarkista, että voisit kävellä siitä pois.',
    },
    {
      title: 'Yksi nautinto hallitsee',
      message:
        '”{{category}}” vie {{percent}} % kaikesta, mitä käytit vapaa-aikaan. Kysy, iloitseeko se sinua vielä vai onko siitä tullut rutiini.',
    },
    {
      title: 'Vapaa-aika nojaa kohteeseen ”{{category}}”',
      message:
        '{{percent}} % vapaa-ajasta yhdessä paikassa. Se mistä emme tule toimeen ilman, pitää meistä kiinni — tarkista että ote on vielä kevyt.',
    },
    {
      title: '”{{category}}”: {{percent}} % vapaa-ajasta',
      message:
        'Yksi nautinnon lähde vie siitä lähes kaiken. Ole hetki ilman sitä ja katso, mitä se sinulle todella antaa.',
    },
    {
      title: 'Levolla on yksi osoite',
      message:
        'Suurin osa vapaa-ajan rahoista, {{percent}} %, menee luokkaan ”{{category}}”. Olet vapaa nautinnosta vain, jos pärjäisit ilman sitä.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Osa kuluista on vielä arvioimatta',
      message:
        '{{count}} kategoriaa on ilman luokkaa. Päätä Budjetit-näkymässä, mikä on välttämättömyyttä, työtä, hyvettä vai vapaa-aikaa.',
    },
    {
      title: '{{count}} kategoriaa odottaa arviotasi',
      message:
        'Niillä on kuluja mutta ei luokkaa, joten neuvot eivät voi punnita niitä. Minuutti Budjetit-näkymässä ratkaisee sen.',
    },
    {
      title: 'Nimeä se, mitä rahasi palvelee',
      message:
        '{{count}} kategoriaa on vielä luokittelematta. Harkinta alkaa siitä, että asioita kutsutaan oikeilla nimillään.',
    },
    {
      title: 'Arvioimatonta kulutusta: {{count}} kategoriaa',
      message:
        'Onko se tarve, työsi, hyve vai nautinto? Vain sinä voit sanoa — ja suunnitelma selkenee, kun sanot.',
    },
    {
      title: 'Parilla kategorialla ei ole luokkaa',
      message:
        '{{count}} kategoriaa on neljän luokan ulkopuolella. Luokittele ne Budjetit-näkymässä, niin jokainen meno nähdään sellaisena kuin se on.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: '{{count}} pientä ostoa kohteessa {{merchant}}',
      message:
        'Jokainen näytti mitättömältä; yhdessä ne tekivät kuukauden aikana {{totalAmount}}. Pienissä, tutkimattomissa tavoissa suurin osa rahasta hiljaa katoaa.',
    },
    {
      title: '{{merchant}}: {{count}} kertaa kuukaudessa',
      message:
        '{{totalAmount}} pieninä erinä. Kysy, oliko jokainen käynti valinta vai refleksi: vain ensimmäinen on vapautta.',
    },
    {
      title: 'Vähän kerrallaan: {{totalAmount}}',
      message:
        '{{count}} ostoa kohteessa {{merchant}}. Yksikään ei merkitse; tapa merkitsee. Päätä, kuinka usein sitä todella haluat.',
    },
    {
      title: 'Tapa kohteessa {{merchant}}',
      message:
        '{{count}} ostosta, yhteensä {{totalAmount}}. Kokeile jättää joka kolmas väliin ja katso, jäätkö kaipaamaan sitä.',
    },
    {
      title: 'Pienet asiat kertyvät',
      message:
        '{{merchant}} näki sinut {{count}} kertaa, yhteensä {{totalAmount}}. Suurten päätösten hallinta rakentuu näiden pienten varaan.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Viikonloput kantavat {{percent}} % vapaa-ajasta',
      message:
        'Suurin osa vapaa-ajan kuluistasi tapahtuu lauantaina ja sunnuntaina. Lepo on hyvä; tarkista että se on lepoa eikä viikon hyvitystä.',
    },
    {
      title: 'Vapaa-aika asuu viikonlopussa',
      message:
        '{{percent}} % vapaa-ajan kuluista osuu viikonloppuun. Suunnittele viikonloppua hiukan, niin se kustantaa vähemmän ja antaa enemmän.',
    },
    {
      title: 'Viikonloppu maksaa viikon puolesta',
      message:
        'Viikonloput vievät {{percent}} % siitä, mitä käytät vapaa-aikaan. Jos viikkoa on korjattava joka lauantai, katso viikkoa.',
    },
    {
      title: 'Lauantai ja sunnuntai: {{percent}} % vapaa-ajasta',
      message:
        'Vapaat päivät kutsuvat vapaata kulutusta. Päätä ennen viikonloppua, mihin se on, ja anna rahan seurata.',
    },
    {
      title: 'Viikonloppukuvio',
      message:
        '{{percent}} % vapaa-ajan kuluista tapahtuu viikonloppuna. Kevyemmät arkipäivät tekevät viikonloputkin usein halvemmiksi.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} vei {{percent}} % kuukaudesta',
      message:
        '{{totalAmount}} meni yhdelle kauppiaalle vapaa-aikaan. Kun yhdellä paikalla on noin paljon rahaasi, kysy kuinka paljon sillä on myös huomiotasi.',
    },
    {
      title: 'Yksi paikka, {{totalAmount}}',
      message:
        '{{merchant}} on {{percent}} % kuukauden kuluista. Onko se tuon osuuden arvoinen elämäntyöstäsi?',
    },
    {
      title: '{{merchant}} johtaa kulutustasi',
      message:
        '{{percent}} % kuukaudesta — {{totalAmount}} — meni sinne. Siitä nauttimisessa ei ole vikaa, kunhan valitsisit sen uudelleen.',
    },
    {
      title: 'Suuri osuus kohteessa {{merchant}}',
      message:
        '{{totalAmount}}, eli {{percent}} % kuluista, yhdessä vapaa-ajan paikassa. Punnitse nautinto hintaa vasten, rauhassa.',
    },
    {
      title: '{{percent}} % kohteessa {{merchant}}',
      message:
        'Tämä yksi kauppias vei {{totalAmount}}. Vapaus on kyky kulkea ohi, kun niin valitset.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Tulot laskivat, kulut eivät',
      message:
        'Tulot putosivat {{percent}} % tasolle {{incomeAmount}}, mutta kulut pysyivät {{expenseAmount}}:ssa. Kohtalo muutti mielensä; kulutuksesi ei ole vielä huomannut.',
    },
    {
      title: 'Tulot alas {{percent}} %',
      message:
        '{{incomeAmount}} tuli sisään vastaan {{expenseAmount}} ulos. Mitä onni antaa, sen se voi ottaa takaisin — sovita kulut siihen mitä on, ei siihen mitä oli.',
    },
    {
      title: 'Niukempi kuukausi, samat tavat',
      message:
        'Tulot ovat {{percent}} % matalammat ({{incomeAmount}}), kun kulut pysyivät {{expenseAmount}}:ssa. Tulot eivät ole vallassasi; vastaus on.',
    },
    {
      title: 'Onni siirtyi',
      message:
        'Ansaitsit {{percent}} % vähemmän kuin tavallisesti, mutta käytit {{expenseAmount}} kuten ennen. Karsi nyt, kun se on valinta eikä pakko.',
    },
    {
      title: 'Kulutus ei ole seurannut tuloja',
      message:
        'Tulot putosivat {{incomeAmount}}:een ({{percent}} % alas); kulut ovat {{expenseAmount}}. Sovita purje siihen tuuleen, joka sinulla todella on.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Tilaukset: {{monthlyAmount}} kuussa',
      message:
        '{{count}} tilausta vie {{percent}} % kuukausikuluistasi. Jokainen uusiutuu kysymättä sinulta — kysy itse jokaisesta.',
    },
    {
      title: '{{percent}} % kuluista uusiutuu itsestään',
      message:
        '{{count}} tilausta, {{monthlyAmount}} kuussa. Pidä ne, joihin liittyisit tänään uudelleen.',
    },
    {
      title: 'Hiljainen, toistuva, {{monthlyAmount}}',
      message:
        '{{count}} tilausta vie {{percent}} % kuukaudestasi. Mukavuus on hyvä palvelija ja kallis isäntä.',
    },
    {
      title: '{{count}} tilausta tarkistettavaksi',
      message:
        'Yhdessä ne ovat {{monthlyAmount}} kuussa, {{percent}} % kuluista. Peru yksi, jota tuskin käytät, ja huomaa kuinka vähän kaipaat sitä.',
    },
    {
      title: 'Se mikä uusiutuu itsestään',
      message:
        '{{monthlyAmount}} kuussa {{count}} tilauksen yli. Automaattinen kulutus ansaitsee tarkoituksellisen tarkastuksen.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Menestyksesi voisi ulottua vähän pidemmälle',
      message:
        '{{months}} kuukauden aikana pidit {{savingsPercent}} % tuloistasi, mutta siitä ei mennyt juuri mitään toisille. Vauraus istuu parhaiten avoimissa käsissä — ehkä lahja tai lahjoitus tässä kuussa?',
    },
    {
      title: 'Ansaitsee hyvin, antaa vähän',
      message:
        '{{incomeAmount}} tuli sisään {{months}} kuukauden aikana ja {{givenAmount}} meni toisille. Jos auttat tavoilla joita tämä sovellus ei näe, jätä tämä huomiotta; jos et, suunnitelmassa on tilaa sille.',
    },
    {
      title: 'Hyvä vuosi olla antelias',
      message:
        'Säästit {{savingsPercent}} % tuloista — merkki vakaasta kädestä. Pieni osa siitä, annettuna sitä tarvitsevalle, tekisi vakaudesta arvokkaampaa.',
    },
    {
      title: 'Kuvassa ei ole vielä muita',
      message:
        'Viimeiset {{months}} kuukautta osoittavat huolellista ansaitsemista ja säästämistä, mutta ei hyväntekeisyyttä tai lahjoja. Meidät on tehty toisiamme varten; vaatimaton lahja riittää alkuun.',
    },
    {
      title: 'Tilaa ystävällisyydelle',
      message:
        'Vain {{givenAmount}} / {{incomeAmount}} meni toisten auttamiseen. Harkitse pientä, säännöllistä lahjoitusta — anteliaisuus helpottuu tavan myötä, kuten jokainen hyve.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '”{{goal}}” on jäämässä jälkeen',
      message:
        'Se vaatii {{requiredAmount}} kuussa, ja sinä laitat siihen noin {{paceAmount}}. Tällä vauhdilla se saapuu {{monthsLate}} kuukautta myöhässä. Vauhti on sinun vallassasi.',
    },
    {
      title: '”{{goal}}”: {{monthsLate}} kuukautta myöhässä tällä tahdilla',
      message:
        'Vaadittu {{requiredAmount}} kuussa, todellinen noin {{paceAmount}}. Siirrä päivää rehellisesti tai siirrä rahaa tarkoituksella.',
    },
    {
      title: 'Tavoite ja tahti ovat eri mieltä',
      message:
        '”{{goal}}” pyytää {{requiredAmount}} kuussa; se saa {{paceAmount}}. Tavoite on yhtä todellinen kuin kuukausittainen askel sitä kohti.',
    },
    {
      title: '”{{goal}}” tarvitsee lujemman askeleen',
      message:
        '{{paceAmount}} kuussa vastaan tarvittava {{requiredAmount}}. Maksa tavoitteelle ensi kuussa ensin, ennen mitään valinnaista.',
    },
    {
      title: 'Jäljessä tavoitteessa ”{{goal}}”',
      message:
        'Nykyinen vauhti ({{paceAmount}}/kk) jättää sen {{monthsLate}} kuukautta myöhään. Sinun vallassasi on seuraava askel, ei koko tie.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '”{{goal}}” ei mahdu suunnitelmaan',
      message:
        'Se tarvitsee {{requiredAmount}} kuussa, mutta budjettien jälkeen vapaana on vain {{freeAmount}}. Muuta päivää, tavoitetta tai budjetteja — toivominen ei ole suunnitelma.',
    },
    {
      title: '”{{goal}}” pyytää enemmän kuin sinulla on vapaana',
      message:
        '{{requiredAmount}} vaaditaan kuukausittain, {{freeAmount}} käytettävissä. Kaiken haluaminen yhtä aikaa on tapa saada mitään aikaan; valitse.',
    },
    {
      title: 'Luvut sanovat ei — tällä hetkellä',
      message:
        '”{{goal}}” tarvitsee {{requiredAmount}} kuussa; vapaa rahasi on {{freeAmount}}. Säädä sitä mikä on vallassasi: määräaikaa tai muita rajoja.',
    },
    {
      title: '”{{goal}}” vaatii päätöksen',
      message:
        '{{requiredAmount}} kuussa ylittää budjettien jälkeen jäävän {{freeAmount}}. Avoimin silmin valittu tavoite on parempi kuin toiveajattelulla ylläpidetty.',
    },
    {
      title: 'Mahdoton tahti tavoitteelle ”{{goal}}”',
      message:
        'Vaadittu {{requiredAmount}} kuussa, vapaana {{freeAmount}}. Rehellinen laskutoimitus nyt säästää pettymyksen myöhemmin.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Saldosi painuu miinukselle {{date}}',
      message:
        'Tulojen ja menojen nykyisellä kululla ennustettu saldo painuu summaan {{lowestAmount}}. Valmistaudu nyt, kun se on vielä vain ennuste.',
    },
    {
      title: 'Vaje on tulossa: {{date}}',
      message:
        'Maksut ja arkimenot ylittävät sen, mitä tulee, ja pohja on {{lowestAmount}}. Vastoinkäymisen ennakointi vie siltä vallan.',
    },
    {
      title: 'Varaudu päivään {{date}}',
      message:
        'Sinä päivänä ennustettu saldo on {{lowestAmount}}. Siirrä maksua, pidätä halu tai varaa rahaa sivuun — mikä tahansa näistä on vallassasi tänään.',
    },
    {
      title: 'Ennuste painuu nollan alle',
      message:
        'Saldo laskee summaan {{lowestAmount}} noin {{date}}. Tyyni vastaus on varhainen vastaus.',
    },
    {
      title: 'Ennakoi aukko {{date}}',
      message:
        'Ennustettu alin saldo: {{lowestAmount}}. Se mikä on ennakoitu, voidaan kohdata tyynesti; se mikä yllättää, harvoin.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Pidit lupauksen itsellesi',
      message:
        '{{months}} kuukautta putkeen kulutuksesi pysyi asettamassasi suunnitelmassa. Tältä itsehallinta näyttää.',
    },
    {
      title: '{{months}} kuukautta suunnitelman sisällä',
      message:
        'Kuukausi toisensa jälkeen aikomuksesi ja tekosi ovat samaa mieltä. Johdonmukaisuus on tahdonvoimaa hiljaisempi ja kestää pidempään.',
    },
    {
      title: 'Suunnitelma ja elämä ovat samaa mieltä',
      message:
        '{{months}} peräkkäistä kuukautta rajojesi sisällä. Näin hyvin pidetty suunnitelma ei ole enää rajoite — se on tapa, jolla elät.',
    },
    {
      title: 'Vakaana {{months}} kuukautta',
      message:
        'Budjettisi ovat pitäneet {{months}} kuukautta putkeen. Säilytä sama tarkkaavaisuus; se toimii.',
    },
    {
      title: 'Kuri, ylläpidetty',
      message:
        '{{months}} kuukautta rikkomatta suunnitelmaasi. Harvat asiat vapauttavat niin kuin oman päätöksen luottaminen.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Rahasi seuraavat arvojasi',
      message:
        'Hyveen palvelukseen käytetty raha oli {{actual}} % kuluistasi, ei vähempää kuin suunnittelemasi {{planned}} %. Hyvin käytetty.',
    },
    {
      title: 'Hyve sai täyden osansa',
      message:
        '{{actual}} % terveyteen, oppimiseen ja toisiin, vastaan suunniteltu {{planned}} %. Se mitä arvostat, siitä maksoit.',
    },
    {
      title: 'Käytetty paremmaksi tulemiseen',
      message:
        'Terveys, oppiminen ja muu saivat {{actual}} % kuukauden kuluista (suunniteltu {{planned}} %). Hyvettä ei voi ostaa, mutta sitä voi palvella.',
    },
    {
      title: 'Aikomus toteutettu',
      message:
        'Suunnittelit {{planned}} % hyveeseen ja käytit {{actual}} %. Hyvät aikomukset selviävät harvoin kuukauden — sinun selvisivät.',
    },
    {
      title: 'Rahan paras käyttö',
      message:
        '{{actual}} % meni siihen, mikä tekee sinusta ja toisista parempia. Jatka sen valitsemista.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Vapaa-aika paikallaan',
      message:
        'Vapaa-aika on {{actual}} % kuluista, alle sallimasi {{planned}} %. Nautit asioista ilman että ne hallitsevat sinua.',
    },
    {
      title: 'Nautinto, pidetty koossa',
      message:
        'Vapaa-aika vei {{actual}} % vastaan suunniteltu {{planned}} %. Kohtuus ei ole paitsi jäämistä — se on valitsemista.',
    },
    {
      title: 'Lepo ilman liiallisuutta',
      message:
        '{{actual}} % vapaa-aikaan, alle {{planned}} %:n rajan. Nautinto maistuu paremmalta, kun se ei komenna.',
    },
    {
      title: 'Kohtuullisuus, vaivihkaa',
      message:
        'Annoit vapaa-ajalle {{planned}} % ja se käytti vain {{actual}} %. Tuo marginaali on vapautta, joka jäi sinulle.',
    },
    {
      title: 'Vapaa-aika alle suunnitelman',
      message:
        '{{actual}} %:lla kuluista vapaa-aika pysyi alle asettamasi {{planned}} %. Hyvin pidetty.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '{{percent}} % alle suunnitelman',
      message:
        'Käytit {{savedAmount}} vähemmän kuin sallit itsellesi kuukaudeksi. Se, ettei tarvitse kaikkea, minkä voisi saada, on eräänlaista rikkautta.',
    },
    {
      title: '{{savedAmount}} jäi käyttämättä',
      message:
        'Kuukausi päättyi {{percent}} % alle suunnitelman. Se mitä et käyttänyt, on vielä sinun ohjattavissasi.',
    },
    {
      title: 'Vähemmän kuin sallit',
      message:
        'Kulutus on {{percent}} % alle suunnitelman — {{savedAmount}} säästyi. Anna sille marginaalille tarkoitus, ennen kuin tapa ottaa sen.',
    },
    {
      title: 'Suunnitelmassa oli varaa',
      message:
        '{{savedAmount}} alle rajojesi kuukaudelta. Kohtuus, joka tuntuu helpolta, on kestävää.',
    },
    {
      title: 'Kevyempi kuin suunniteltu',
      message:
        'Tarvitsit {{percent}} % vähemmän kuin budjetoit. Harkitse {{savedAmount}}:n ohjaamista tavoitteeseen.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '”{{goal}}” on aikataulussa',
      message:
        'Olet {{percent}} % matkasta, siinä tahdissa jonka tavoite tarvitsee. Vakaat askeleet, otettuna kuukausittain, kantavat kauas.',
    },
    {
      title: 'Aikataulussa kohti tavoitetta ”{{goal}}”',
      message:
        '{{percent}} % valmiina ja tahti pitää. Jatka tavoitteen maksamista ensin; se toimii.',
    },
    {
      title: '”{{goal}}”: {{percent}} % ja vakaa',
      message: 'Tavoite saa mitä se tarvitsee joka kuukausi. Kärsivällisyys tekee työtään.',
    },
    {
      title: 'Tavoite liikkuu suunnitellusti',
      message:
        '”{{goal}}” on {{percent}} % rahoitettu ja ajassa. Sitä mitä tehdään vähän joka kuukausi, ei pysäytä yksi huono viikko.',
    },
    {
      title: 'Edistys johon voi luottaa',
      message:
        '”{{goal}}” on {{percent}} %:ssa, tahdissa. Rakennat sitä ainoalla toimivalla tavalla — vähitellen.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: 'Vähemmän heräteostoja kohteessa {{merchant}}',
      message:
        'Kuukaudessa tehdyistä {{before}} ostoksesta noin {{after}}:een. Höllentynyt tapa on voitettua vapautta.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'Käyt harvemmin kuin ennen. Jokainen ohitettu refleksi on pieni valinnan voitto tavasta.',
    },
    {
      title: 'Pieni tapa kutistuu',
      message:
        'Ostot kohteessa {{merchant}} laskivat {{before}}:stä noin {{after}}:ään. Jatka — se helpottuu.',
    },
    {
      title: 'Valinta refleksin sijaan',
      message:
        'Kohteessa {{merchant}} siirryit {{before}} ostosta noin {{after}}:ään. Se on hallintaa, joka rakentuu päätös kerrallaan.',
    },
    {
      title: 'Vähemmän pikkuasioita',
      message:
        '{{merchant}} näki sinut noin {{after}} kertaa {{before}}:n sijaan. Pienet voitot kasautuvat.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Sopeutuit niukempaan kuukauteen',
      message:
        'Tulot laskivat {{incomePercent}} %, ja leikkasit kuluja {{expensePercent}} %. Kohtasit onnen muutoksen suunnan muutoksella.',
    },
    {
      title: 'Tyyneys, kun tulot notkahtivat',
      message:
        'Tulot alas {{incomePercent}} %, kulut alas {{expensePercent}} %. Sopeutuit siihen mitä on, ei siihen mitä oli.',
    },
    {
      title: 'Onni muuttui; niin muutuit sinäkin',
      message:
        '{{incomePercent}} %:n pudotus tuloissa kohtasi {{expensePercent}} %:n pudotuksen kuluissa. Se on mielenrauhaa numeroina.',
    },
    {
      title: 'Hyvin ohjattu',
      message:
        'Kun tulot laskivat {{incomePercent}} %, kulut seurasivat ({{expensePercent}} % vähemmän). Tuuli ei ollut sinun; purje oli.',
    },
    {
      title: 'Kulutus seurasi tuloja alas',
      message:
        'Käytit {{expensePercent}} % vähemmän, kun tulot laskivat {{incomePercent}} %. Ajoissa sopeutuminen on rauhallinen tie läpi.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'Välttämättömyydet ovat vakaita',
      message:
        '{{months}} kuukauden ajan välttämättömät kulusi ovat tuskin liikkuneet. Vakaa lattia antaa vapauden sen yläpuolella.',
    },
    {
      title: 'Tarpeet kurissa',
      message:
        'Välttämättömyyksien kulut pysyivät tasaisina {{months}} kuukautta. Tarpeet jotka eivät kasva ovat tarpeita, joita hallitset.',
    },
    {
      title: '{{months}} kuukautta vakaita perusmenoja',
      message: 'Vuokra, ruoka ja laskut pysyivät ennallaan. Hiljainen vakaus on sekin saavutus.',
    },
    {
      title: 'Ei hiipimistä välttämättömyyksissä',
      message:
        '{{months}} kuukautta ilman siirtymää siinä, mitä elämä vaatii. Kaikki muu on helpompi suunnitella sillä pohjalla.',
    },
    {
      title: 'Luja lattia',
      message:
        'Välttämättömät kulut ovat olleet vakaita {{months}} kuukautta. Et päästä mukavuuksia tarpeiden nimellä.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Antelias sillä mitä ansaitset',
      message:
        '{{months}} kuukauden aikana {{percent}} % tuloistasi — {{givenAmount}} — meni toisten auttamiseen. Se on rahaa parhaassa käytössään.',
    },
    {
      title: '{{givenAmount}} annettu toisille',
      message:
        'Jaoit {{percent}} % tuloistasi {{months}} kuukauden aikana. Ystävällisyys joka näkyy luvuissa, on harjoitettua ystävällisyyttä, ei vain tunnettua.',
    },
    {
      title: 'Avoimet kädet',
      message:
        'Hyväntekeisyys ja lahjat vievät {{percent}} % tuloistasi viime aikoina. Se mitä annat pois, on se osa vaurauttasi, jota mikään onnettomuus ei voi ottaa.',
    },
    {
      title: 'Anteliaisuus on osa suunnitelmaasi',
      message:
        '{{givenAmount}} toisille {{months}} kuukauden aikana. Pidä siitä kiinni — hyvä jota teet toisille, on tehty myös itsellesi.',
    },
    {
      title: 'Hyvin annettu',
      message:
        '{{percent}} % ansioistasi meni toisten auttamiseen. Harvat tavat kertovat ihmisestä enemmän.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Ei mitään korjattavaa',
      message: 'Kulutuksesi vastaa sitä mitä aioit. Jatka kuten olet.',
    },
    {
      title: 'Aikomus ja teko ovat samaa mieltä',
      message: 'Kuukausi näyttää siltä kuin suunnittelit. Tuo sopusointu on koko pointti.',
    },
    {
      title: 'Rauhallinen kuukausi',
      message:
        'Ei liiallisuutta, ei mainittavaa laiminlyöntiä. Hyvin tehty — kanna sama tarkkaavaisuus eteenpäin.',
    },
    {
      title: 'Kaikki järjestyksessä',
      message: 'Suunnitelmasi piti eikä mikään kaipaa korjausta. Nauti ansaitusta rauhasta.',
    },
    {
      title: 'Vakaa käsi',
      message:
        'Kuukausi seurasi suunnitelmaasi. Hyvät tavat saavat hyvät kuukaudet näyttämään tavallisilta.',
    },
  ],
  'stoic.keep_first': [
    {
      title: 'Pidä oma osuutesi ensin',
      message:
        '{{months}} kuukauden aikana säästit {{savingsPercent}} % tuloistasi. Senecan varoitus kuuluu: on liian myöhäistä säästää, kun tynnyrissä on jäljellä vain pohjasakka. Laita {{tenthAmount}} syrjään samana päivänä, kun tulot saapuvat.',
    },
    {
      title: 'Säästä tynnyrin yläosasta',
      message:
        'Vain {{savingsPercent}} % tuloista jäi sinulle. Säästäväisyys, joka odottaa jäännöstä, tulee liian myöhään; {{tenthAmount}} kuussa, ensin syrjään pantuna, aloittaa sen jo nyt.',
    },
    {
      title: 'Pidä se, mikä on omaasi',
      message:
        'Seneca neuvoo pitämään sen, mikä todella on omaasi, ja aloittamaan ajoissa. Viime aikoina {{savingsPercent}} % tuloista on jäänyt sinulle; aloita {{tenthAmount}} palkkapäivänä ja anna kulutuksen sovittautua lopun ympärille.',
    },
    {
      title: 'Aloita ennen pohjasakkaa',
      message:
        'Säästit {{savingsPercent}} % {{months}} kuukauden aikana. Säästäminen on sinun vallassasi vain niin kauan kuin säästettävää vielä on: siirrä {{tenthAmount}} syrjään ennen kaikkea muuta.',
    },
    {
      title: '{{savingsPercent}} % säästetty, ja tynnyri tyhjenee',
      message:
        '{{tenthAmount}} kuussa, kymmenesosa tuloista, pantuna syrjään ennen yhtään laskua. Se, minkä pidät ensin, ei riipu siitä, mitä kuukausi jättää jäljelle.',
    },
  ],
  'stoic.prepare_beforehand': [
    {
      title: 'Varaudu, kun on rauhallista',
      message:
        'Puskurisi kattaa noin {{cushionDays}} päivän menot. Seneca: sielun tulee karaista itseään huolettomina aikoina. Kolmen kuukauden menot ovat {{targetAmount}}.',
    },
    {
      title: '{{cushionDays}} päivän puskuri',
      message:
        'Onni ei ilmoita tulostaan. Rakenna kohti summaa {{targetAmount}}, kolmen kuukauden menoja, silloin kun mikään ei kiirehdi: silloin se on helppoa.',
    },
    {
      title: '”Tätäkö minä pelkäsin?”',
      message:
        'Seneca antoi Luciliuksen harjoitella köyhyyttä, jotta se menettäisi kauhunsa. Kun puskuria on {{cushionDays}} päivän verran, yksi vaikea kuukausi ei olisi harjoitus. Tavoittele summaa {{targetAmount}}.',
    },
    {
      title: 'Ennakoi vaikea kuukausi',
      message:
        'Säästösi riittäisivät noin {{cushionDays}} päiväksi. Ennakoitu tulee lempeästi; {{targetAmount}} kantaisi sinua kolme kuukautta.',
    },
    {
      title: 'Rakenna muuri ennen myrskyä',
      message:
        'Noin {{cushionDays}} päivää on katettu. Tulojen menetys ei ole sinun vallassasi, mutta puskuri on. Kolmen kuukauden menot ovat yhteensä {{targetAmount}}.',
    },
  ],
  'stoic.wants_outrun_income': [
    {
      title: 'Halut kirivät tulojen edelle',
      message:
        'Menot kasvoivat viime neljänneksellä {{expenseGrowth}} %, tulot muuttuivat {{incomeGrowth}} %. Köyhä ei ole se, jolla on liian vähän, kirjoittaa Seneca, vaan se, joka himoitsee enemmän.',
    },
    {
      title: 'Elät korkeammalla, et paremmin',
      message:
        'Menot kasvoivat {{expenseGrowth}} %, tulot {{incomeGrowth}} %. Luonnon tarpeet ovat vähäiset; mielipiteen vaatimukset rajattomat. Kysy, kumpaa nämä lisäykset palvelevat.',
    },
    {
      title: 'Halut ovat kasvaneet: +{{expenseGrowth}} %',
      message:
        'Menot nousivat nopeammin kuin tulot ({{incomeGrowth}} %). Uusi mukavuus tuntuu pian tarpeelta: huomaa se, kun voit vielä kieltäytyä.',
    },
    {
      title: 'Maalitolpat liikkuvat',
      message:
        'Menot ovat nousseet {{expenseGrowth}} % neljänneksestä toiseen, tulot {{incomeGrowth}} %. Riittävä pysyy riittävänä vain, jos päätät itse, mikä se on.',
    },
    {
      title: 'Lisä ei ole lääke',
      message:
        'Viime neljänneksellä menot kasvoivat {{expenseGrowth}} % ja tulot {{incomeGrowth}} %. Rikkaus, joka kasvaa halun mukana, ei koskaan saavu perille; aseta raja, ennen kuin tästä tulee uusi normaali.',
    },
  ],
  'stoic.price_in_life': [
    {
      title: '{{merchant}} vei {{hours}} tuntia elämästäsi',
      message:
        'Seneca muistuttaa, että vain aika on todella meidän. Summa {{totalAmount}} kohteessa {{merchant}} on noin {{hours}} tuntia työtäsi. Oliko se sen arvoista?',
    },
    {
      title: '{{hours}} tuntia: {{merchant}}',
      message:
        'Vartioimme rahaamme ja annamme aikamme pois. Keskimääräisellä tuntitulollasi {{totalAmount}} on tässä noin {{hours}} työtuntia.',
    },
    {
      title: 'Hinnoittele tunteina',
      message:
        '{{totalAmount}} ostoksesta ({{merchant}}) tulee noin {{hours}} tuntia työtä. Tunnit ovat ainoa asia, jota et voi ansaita takaisin.',
    },
    {
      title: 'Mitä {{merchant}} todella maksoi',
      message:
        'Vaihdat päiväsi rahaksi ja rahasi tavaraksi. {{merchant}} vei noin {{hours}} tuntia sinun tunneistasi ({{totalAmount}}). Vastaako ilo tunteja?',
    },
    {
      title: 'Punnitse tunnit',
      message:
        'Keskimääräisellä tuntitulollasi laskettuna {{totalAmount}} ostoksesta ({{merchant}}) tulee noin {{hours}} tuntia. Hukkaamme suuren osan ajastamme, kirjoittaa Seneca. Valitsitko tämän itse?',
    },
  ],
  'stoic.rule_broken': [
    {
      title: 'Sääntö ”{{rule}}” on eksynyt',
      message:
        'Se osoittaa johonkin, jota ei enää ole, joten se on hiljaa lakannut toimimasta. Korjaa se tai poista se: järjestys, joka ei tee mitään, vain näyttää järjestykseltä.',
    },
    {
      title: '”{{rule}}” ei enää toimi',
      message:
        'Sen luokka, tili tai maksunsaaja on poistettu, ja sääntö ohitetaan nyt jokaisessa tapahtumassa. Katso asioita sellaisina kuin ne ovat, ja korjaa ne sitten.',
    },
    {
      title: 'Sääntö, joka tähtää tyhjään',
      message:
        '”{{rule}}” lähettää tapahtumat paikkaan, joka on poistettu. Päätit kerran jotakin; päätä uudelleen nyt, kun asiat ovat muuttuneet.',
    },
    {
      title: '”{{rule}}” kaipaa harkintaasi',
      message:
        'Se, mihin se viittaa, on poistettu, ja tapahtumat, jotka se ennen luokitteli, odottavat nyt sinua. Anna sille uusi kohde tai päästä irti.',
    },
    {
      title: 'Rikkinäinen sääntö, hiljaa',
      message:
        '”{{rule}}” ei tee mitään eikä kerro siitä. Korjaa se, mikä on vallassasi: siihen menee minuutti.',
    },
  ],
  'stoic.rule_contradicted': [
    {
      title: 'Kätesi on eri mieltä kuin ”{{rule}}”',
      message:
        'Olet luokitellut käsin {{count}} kertaa muualle sen, minkä tämä sääntö luokittelee toisin. Joko sääntö on väärässä tai käsi: päätä kumpi.',
    },
    {
      title: '”{{rule}}” ohitettiin {{count}} kertaa',
      message:
        'Sääntö, jota korjaat jatkuvasti, ei ole enää päätös vaan tapa kiistellä itsesi kanssa. Muuta sitä tai luota siihen.',
    },
    {
      title: 'Sano, mitä teet, ja tee, mitä sanoit',
      message:
        'Sääntö ”{{rule}}” sanoo yhtä; viimeiset {{count}} korjaustasi sanovat toista. Saata nämä kaksi sopusointuun.',
    },
    {
      title: 'Kiistanalainen päätös',
      message:
        'Asetit säännön ”{{rule}}” selvin päin, ja {{count}} tapahtumaa on sittemmin mennyt toisin. Katso rauhassa uudelleen, kumpi teistä oli oikeassa.',
    },
    {
      title: '{{count}} korjausta sääntöä ”{{rule}}” vastaan',
      message: 'Toisto on tietoa. Anna sen muuttaa sääntöä, tai anna säännön muuttaa tapa.',
    },
  ],
  'stoic.rule_worth_writing': [
    {
      title: 'Päätä kerran: {{payee}}',
      message:
        'Olet luokitellut maksunsaajan {{payee}} käsin {{decided}} kertaa, aina samalla tavalla. Minkä päätät yhä uudelleen, päätä kerran, selvin päin.',
    },
    {
      title: 'Päätös tehty {{decided}} kertaa',
      message:
        'Maksunsaaja {{payee}} esittää saman kysymyksen, ja sinä annat saman vastauksen. Sääntö säästäisi huomiosi sille, mikä todella sitä tarvitsee.',
    },
    {
      title: 'Maksunsaajia, jotka ovat valmiita säännölle: {{count}}',
      message:
        'Samat maksunsaajat saavat sinulta aina saman luokan, eniten {{payee}}. Säästä harkintasi sille, mikä on uutta.',
    },
    {
      title: 'Tapasi on valmis periaatteeksi',
      message:
        'Luokittelet maksunsaajan {{payee}} joka kerta samalla tavalla (tähän mennessä {{decided}} kertaa). Kirjoita se säännöksi, niin se pitää vaivatta.',
    },
    {
      title: 'Anna säännön kantaa tämä',
      message:
        'Maksunsaajia, jotka luokittelet joka kerta samoin: {{count}}, ja maksunsaaja {{payee}} niistä {{decided}} tapahtumalla. Kerran ratkaistua periaatetta ei tarvitse kiistää uudelleen.',
    },
  ],
  'stoic.rule_idle': [
    {
      title: '”{{rule}}” ei ole kohdannut mitään {{months}} kuukauteen',
      message:
        'Joko maailma, jota varten se tehtiin, on kadonnut, tai sen ehdot osuvat ohi. Pidä sääntösi todenmukaisina: korjaa tai poista.',
    },
    {
      title: 'Lepäävä sääntö: ”{{rule}}”',
      message:
        'Se ei ole koskenut yhteenkään tapahtumaan {{months}} kuukauteen. Heitä pois, mikä on liiallista; jäljelle jäävään on helpompi luottaa.',
    },
    {
      title: '”{{rule}}” seisoo toimettomana',
      message:
        '{{months}} kuukautta ilman osumaa, vaikka uusia tapahtumia tulee koko ajan. Kokeile sitä viimeaikaisiin tapahtumiin ja päätä sitten.',
    },
    {
      title: 'Tarvitaanko ”{{rule}}” vielä?',
      message:
        'Mikään ei ole osunut siihen {{months}} kuukauteen. Tottumuksesta pidetty sääntö on yksi asia lisää hoidettavaksi.',
    },
    {
      title: 'Päätös, jolla ei ole mitään päätettävää',
      message:
        '”{{rule}}” on ollut hiljaa {{months}} kuukautta. Järjestys tarkoittaa, että on se, mitä tarvitsee, eikä muuta.',
    },
  ],
  'stoic.praise_rules_hold': [
    {
      title: 'Päätöksesi pitävät',
      message:
        'Säännöt luokittelivat {{percent}} % kuukauden tapahtumista, eikä sinun tarvinnut ohittaa niitä. Kerran tehty ja pidetty päätös vapauttaa mielen.',
    },
    {
      title: '{{percent}} % ratkaistu etukäteen',
      message:
        'Suurin osa kuukauden tapahtumista luokiteltiin aiemmin tekemiesi päätösten mukaan. Se on huomiota säästettynä sille, mikä on tärkeää.',
    },
    {
      title: 'Periaatteet työssä',
      message:
        'Sääntösi hoitivat {{percent}} % tapahtumista kiistatta. Vakiintuneet periaatteet tekevät päivistä hiljaisia.',
    },
    {
      title: 'Vähemmän päätettävää',
      message:
        '{{percent}} % tapahtumista ei vaatinut uutta päätöstä. Arvioit kerran, hyvin, ja arvio pitää yhä.',
    },
    {
      title: 'Järjestys säilyi',
      message:
        'Säännöt luokittelivat {{percent}} % kuukaudesta, eikä yhtäkään vastustettu. Hyvä järjestys näyttää siltä, ettei mitään tapahdu.',
    },
  ],
  'stoic.goal_no_date': [
    {
      title: 'Ei päivämäärää: ”{{goal}}”',
      message:
        'Se on {{percent}} %:ssa, eikä siihen mene mitään. Kun et tiedä, mihin satamaan olet matkalla, mikään tuuli ei ole oikea: nimeä päivä, jona aiot perille.',
    },
    {
      title: 'Toive vai tavoite?',
      message:
        '”{{goal}}” ei ole määräaikaa eikä vauhtia. Tavoite on päätös, jolla on päivämäärä; anna sille sellainen tai päästä irti.',
    },
    {
      title: 'Nimeä päivä: ”{{goal}}”',
      message:
        'Matkaa on tehty {{percent}} %, eikä mitään liiku. Mikä voidaan tehdä milloin tahansa, tehdään harvoin lainkaan.',
    },
    {
      title: '”{{goal}}” odottaa jotakin ”joskus”',
      message:
        'Viime aikoina siihen ei ole mennyt mitään, eikä mikään päivämäärä vaadi mitään. Joskus ei ole kalenterissasi; valitse päivä, joka on.',
    },
    {
      title: 'Tavoitteelta ”{{goal}}” puuttuu satama',
      message:
        '{{percent}} %:ssa, ilman määräaikaa. Tiedä, minne purjehdit, niin kuukausittainen askel seuraa.',
    },
  ],
};
