/**
 * Icons gathered by what money is spent on. The picker lists these first, in
 * this order, before the rest of the catalogue, and a word in the user's
 * language (group-terms/<locale>-translations.ts) finds a whole group:
 * Lucide's own search words are English only.
 */
export const ICON_GROUPS = {
  habits:
    'cigarette cigarette-off beer beer-off wine wine-off martini bottle-wine can-soda dices dice-5 playing-cards playing-card spade club diamond ticket candy candy-off lollipop cake-slice cookie cupcake cup-soda pizza hamburger joystick gamepad-2 cannabis cannabis-off venus-and-mars heart-crack flame moon bed coffee smartphone tv',
  food: 'utensils utensils-crossed chef-hat cooking-pot soup pizza sandwich salad beef drumstick egg-fried fish ham croissant cookie ice-cream-cone popcorn hamburger',
  groceries:
    'shopping-cart shopping-basket apple carrot banana cherry grape citrus milk egg wheat store',
  drinks: 'coffee cup-soda can-soda glass-water milk beer wine martini bottle-wine',
  home: 'house house-plus building building-complex sofa bed bath lamp key armchair door-open warehouse hotel',
  utilities: 'zap plug lightbulb droplet flame thermometer wifi router trash recycle heater',
  transport:
    'car car-taxi-front car-front bus bus-front train-front tram-front bike scooter motorbike fuel square-letter-p ship sailboat truck map-pin navigation route caravan',
  travel:
    'plane plane-takeoff luggage map globe tent mountain tree-palm umbrella hotel ticket compass camera sun',
  health:
    'stethoscope heart-pulse pill pill-bottle syringe hospital cross activity thermometer bandage eye glasses toothbrush brain baby dna microscope accessibility',
  sport:
    'dumbbell bike volleyball trophy medal footprints mountain waves-horizontal goal award timer',
  beauty: 'shirt scissors sparkles gem glasses watch spray-can perfume-bottle brush paintbrush',
  shopping:
    'shopping-bag shopping-cart store package gift tag tags receipt barcode scan-barcode truck',
  tech: 'smartphone laptop monitor tablet tv headphones keyboard mouse printer camera cpu hard-drive cloud server gamepad-2 watch battery plug',
  media:
    'repeat tv film clapperboard eighth-notes headphones mic-vocal radio book-open newspaper cloud play calendar-sync',
  education:
    'graduation-cap school book book-open library notebook pencil languages brain lightbulb backpack',
  family: 'baby toy-brick blocks paw-print dog cat bird fish rabbit bone',
  finance:
    'wallet banknote coins credit-card piggy-bank landmark receipt receipt-text calculator percent circle-dollar-sign euro pound-sterling japanese-yen indian-rupee russian-ruble bitcoin hand-coins trending-up trending-down chart-line chart-pie scale vault',
  work: 'briefcase building-complex laptop users handshake megaphone printer presentation clipboard file-text folder mail phone calendar',
  gifts: 'gift heart heart-handshake hand-heart party-popper cake flower church ribbon',
  leisure:
    'ticket film popcorn eighth-notes guitar piano palette camera drama gamepad-2 puzzle dices party-popper tent',
  phone: 'smartphone phone wifi router signal globe mail message-circle at-sign',
  insurance: 'shield shield-check umbrella lock key-round life-buoy siren',
  repairs:
    'wrench hammer drill paint-roller paintbrush ruler screwdriver toolbox construction settings',
  garden: 'flower flower-2 leaf sprout tree-pine trees shovel sun cloud-rain',
  taxes: 'scale landmark file-text receipt percent stamp gavel calculator',
  transfers: 'arrow-left-right arrow-right-left send repeat refresh-cw hand-coins users',
  income: 'briefcase circle-dollar-sign banknote trending-up hand-coins coins piggy-bank award',
} as const;

export type IconGroupKey = keyof typeof ICON_GROUPS;

export const ICON_GROUP_KEYS = Object.keys(ICON_GROUPS) as IconGroupKey[];

export function groupIcons(key: IconGroupKey): string[] {
  return ICON_GROUPS[key].split(' ');
}
