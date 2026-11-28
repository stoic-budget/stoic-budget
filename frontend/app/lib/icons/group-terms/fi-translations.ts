import type { GroupTerms } from './types';

/** First the group's name, then words that should find it (see icon-groups.ts). */
const terms: GroupTerms = {
  habits:
    'Tottumukset, paheet, tupakointi, tupakka, röökit, savukkeet, nuuska, vape, alkoholi, juominen, olut, kalja, viini, baari, kasino, rahapelit, uhkapelit, vedonlyönti, pokeri, kortit, lotto, arpa, karkki, makeiset, herkut, pikaruoka, energiajuoma, pelit, aikuisviihde, seksi',
  food: 'Ruoka, ulkona syöminen, ravintola, kahvila, lounas, päivällinen, illallinen, aamiainen, noutoruoka, kotiinkuljetus, ruoanlaitto',
  groceries: 'Ruokaostokset, kauppa, ruokakauppa, supermarket, tori, hedelmät, vihannekset',
  drinks: 'Juomat, kahvi, tee, limsa, mehu, vesi, alkoholi',
  home: 'Asuminen, koti, vuokra, asuntolaina, asunto, huonekalut, kotitalous, hotelli',
  utilities: 'Asumiskulut, sähkö, vesi, kaasu, lämmitys, netti, jätehuolto, laskut, energia',
  transport:
    'Liikenne, auto, taksi, bussi, juna, metro, raitiovaunu, ratikka, pyörä, potkulauta, polttoaine, bensa, pysäköinti, työmatkat',
  travel: 'Matkat, matkailu, loma, lennot, matka, matkatavarat, hotelli, leirintä',
  health: 'Terveys, lääkkeet, lääkäri, apteekki, sairaala, hammaslääkäri, terveyskeskus, vakuutus',
  sport: 'Urheilu, liikunta, kuntosali, sali, treeni, juoksu, uinti, pyöräily, jooga',
  beauty: 'Kauneus, vaatteet, muoti, kampaamo, parturi, kosmetiikka, meikit, hajuvesi, korut',
  shopping: 'Ostokset, shoppailu, kauppa, verkkokauppa, paketit, toimitus',
  tech: 'Tekniikka, elektroniikka, laitteet, tietokone, puhelin, kännykkä, ohjelmistot',
  media: 'Tilaukset, suoratoisto, musiikki, elokuvat, sarjat, TV, podcastit, kirjat, uutiset',
  education: 'Koulutus, koulu, yliopisto, opiskelu, kurssit, kirjat, kielet, lukukausimaksu',
  family: 'Lapset, vauva, perhe, lemmikit, koira, kissa, lelut, eläinlääkäri, päiväkoti',
  finance:
    'Raha-asiat, rahat, pankki, käteinen, kortti, säästöt, sijoitukset, osakkeet, krypto, laina, korot, valuutta',
  work: 'Työ, toimisto, yritys, palkka, asiakkaat, kokoukset, asiakirjat, posti',
  gifts: 'Lahjat, hyväntekeväisyys, lahjoitukset, juhlat, syntymäpäivä, kukat, kirkko',
  leisure:
    'Vapaa-aika, viihde, elokuvateatteri, leffa, konsertit, teatteri, harrastukset, pelit, bileet, tapahtumat',
  phone: 'Puhelin, kännykkä, liittymä, netti, viestintä, puhelut, viestit, sähköposti',
  insurance: 'Vakuutukset, turvallisuus, suoja',
  repairs: 'Korjaukset, huolto, työkalut, remontti, rakentaminen',
  garden: 'Puutarha, kasvit, kukat, luonto, mökki, ulkoilu',
  taxes: 'Verot, maksut, sakot, viranomaiset, lakiasiat',
  transfers: 'Siirrot, tilisiirto, rahansiirto, maksut, valuutanvaihto, palautukset',
  income: 'Tulot, palkka, ansiot, bonus, liikevaihto, myynti',
};

export default terms;
