import { describe, expect, it } from 'vitest';
import { groupTerms, type IconSearchIndex, listingOrder, searchIcons } from './icon-search';

const names = ['wine', 'house', 'cigarette', 'beer', 'shopping-cart', 'plane', 'zebra'];
const groups = [
  {
    icons: ['cigarette', 'beer', 'wine'],
    terms: groupTerms('Привычки, курение, сигареты, алкоголь, азартные игры', 'ru'),
  },
  { icons: ['shopping-cart', 'house'], terms: groupTerms('Дом, квартира', 'ru') },
];
const index: IconSearchIndex = {
  order: listingOrder(names, groups),
  words: { cigarette: ['smoking'], beer: ['alcohol', 'drink'], wine: ['alcohol'] },
  labels: new Map([['house', 'дом']]),
  groups,
};
const search = (query: string) => searchIcons(index, query, 'ru');

describe('listingOrder', () => {
  it('lists grouped icons first, in group order, then the rest alphabetically', () => {
    expect(index.order).toEqual([
      'cigarette',
      'beer',
      'wine',
      'shopping-cart',
      'house',
      'plane',
      'zebra',
    ]);
  });

  it('skips group icons the catalogue does not have', () => {
    expect(listingOrder(['beer'], [{ icons: ['gone', 'beer'], terms: [] }])).toEqual(['beer']);
  });
});

describe('groupTerms', () => {
  it('splits a line into trimmed lower-case terms', () => {
    expect(groupTerms(' Habits,  Smoking ,,Fast food', 'en')).toEqual([
      'habits',
      'smoking',
      'fast food',
    ]);
  });

  it('lower-cases by the language: a Turkish capital İ becomes i', () => {
    expect(groupTerms('İçki', 'tr')).toEqual(['içki']);
  });
});

describe('searchIcons', () => {
  it('lists every icon for an empty query', () => {
    expect(search('  ')).toEqual(index.order);
  });

  it('finds an icon by the start of its English name, best match first', () => {
    expect(search('cig')[0]).toBe('cigarette');
    expect(search('shopping cart')[0]).toBe('shopping-cart');
    expect(search('cart')).toEqual(['shopping-cart']);
  });

  it('finds icons by their English search words', () => {
    expect(search('smok')).toEqual(['cigarette']);
    expect(search('alcohol')).toEqual(['beer', 'wine']);
  });

  it('finds an icon by its translated name', () => {
    expect(search('дом')[0]).toBe('house');
  });

  it('finds a whole group by a word in the user’s language, with another ending', () => {
    expect(search('сигареты')).toEqual(['cigarette', 'beer', 'wine']);
    expect(search('сигарету')).toEqual(['cigarette', 'beer', 'wine']);
    expect(search('игры')).toEqual(['cigarette', 'beer', 'wine']);
  });

  it('puts a name match before a group match', () => {
    const habitsAndHouse = searchIcons(
      { ...index, labels: new Map([['house', 'дом']]), words: {} },
      'дом',
      'ru',
    );
    expect(habitsAndHouse).toEqual(['house', 'shopping-cart']);
  });

  it('finds nothing for a word nothing carries', () => {
    expect(search('qwerty')).toEqual([]);
  });
});
