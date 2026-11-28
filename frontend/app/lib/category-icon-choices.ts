import type categoryIcons from '@/app/components/categories/categoryIcons.content';

export type CategoryIconLabelKey = keyof typeof categoryIcons.content;

/**
 * The icons the category editor offered before it searched the whole Lucide
 * set. `value` is what older category rows store (`mdi:*`), `name` the Lucide
 * icon it now stands for, so those categories keep their choice.
 */
export const CATEGORY_ICON_CHOICES: ReadonlyArray<{
  value: string;
  name: string;
  /** What the icon stands for (`categoryIcons` dictionary), as its tooltip and accessible name. */
  labelKey: CategoryIconLabelKey;
}> = [
  { value: 'mdi:home', name: 'house', labelKey: 'home' },
  { value: 'mdi:food', name: 'utensils', labelKey: 'food' },
  { value: 'mdi:coffee', name: 'coffee', labelKey: 'coffee' },
  { value: 'mdi:cart', name: 'shopping-cart', labelKey: 'groceries' },
  { value: 'mdi:shopping', name: 'shopping-bag', labelKey: 'shopping' },
  { value: 'mdi:car', name: 'car', labelKey: 'car' },
  { value: 'mdi:gas-station', name: 'fuel', labelKey: 'fuel' },
  { value: 'mdi:airplane', name: 'plane', labelKey: 'travel' },
  { value: 'mdi:medical-bag', name: 'stethoscope', labelKey: 'health' },
  { value: 'mdi:dumbbell', name: 'dumbbell', labelKey: 'fitness' },
  { value: 'mdi:school', name: 'graduation-cap', labelKey: 'education' },
  { value: 'mdi:book', name: 'book-open', labelKey: 'books' },
  { value: 'mdi:gift', name: 'gift', labelKey: 'gifts' },
  { value: 'mdi:gamepad-variant', name: 'gamepad-2', labelKey: 'games' },
  { value: 'mdi:music', name: 'eighth-notes', labelKey: 'music' },
  { value: 'mdi:paw', name: 'paw-print', labelKey: 'pets' },
  { value: 'mdi:monitor', name: 'monitor', labelKey: 'electronics' },
  { value: 'mdi:cloud', name: 'cloud', labelKey: 'cloudServices' },
  { value: 'mdi:autorenew', name: 'repeat', labelKey: 'subscriptions' },
  { value: 'mdi:phone', name: 'smartphone', labelKey: 'phone' },
  { value: 'mdi:lightning-bolt', name: 'zap', labelKey: 'utilities' },
  { value: 'mdi:wrench', name: 'wrench', labelKey: 'repairs' },
  { value: 'mdi:shield-check', name: 'shield-check', labelKey: 'insurance' },
  { value: 'mdi:receipt', name: 'receipt-text', labelKey: 'bills' },
  { value: 'mdi:wallet', name: 'wallet', labelKey: 'wallet' },
  { value: 'mdi:cash', name: 'banknote', labelKey: 'cash' },
  { value: 'mdi:bank', name: 'landmark', labelKey: 'bank' },
  { value: 'mdi:credit-card', name: 'credit-card', labelKey: 'card' },
  { value: 'mdi:piggy-bank', name: 'piggy-bank', labelKey: 'savings' },
  { value: 'mdi:chart-line', name: 'trending-up', labelKey: 'investments' },
  { value: 'mdi:briefcase', name: 'briefcase', labelKey: 'work' },
  { value: 'mdi:heart', name: 'heart', labelKey: 'charity' },
  { value: 'mdi:tag', name: 'tag', labelKey: 'other' },
];

/** Lucide name of a legacy `mdi:*` value. */
export const LUCIDE_NAME_BY_MDI: ReadonlyMap<string, string> = new Map(
  CATEGORY_ICON_CHOICES.map(choice => [choice.value, choice.name]),
);

/** The localized label of an icon the editor used to offer, by its Lucide name. */
export const LABEL_KEY_BY_NAME: ReadonlyMap<string, CategoryIconLabelKey> = new Map(
  CATEGORY_ICON_CHOICES.map(choice => [choice.name, choice.labelKey]),
);
