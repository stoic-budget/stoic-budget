import type { LucideIcon } from '@/app/components/icons';
import { LUCIDE_NAME_BY_MDI } from '../category-icon-choices';
import * as Line from '../category-line-icons';

/** How a picked icon is stored: `lucide:<name>`, a name from the Lucide catalogue. */
export const LUCIDE_PREFIX = 'lucide:';

export function iconValue(name: string): string {
  return `${LUCIDE_PREFIX}${name}`;
}

/**
 * The Lucide name of a stored icon: `lucide:<name>`, or one of the `mdi:*`
 * values the editor stored before. Anything else (an old upload URL, nothing)
 * has no name.
 */
export function iconName(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  if (value.startsWith(LUCIDE_PREFIX)) {
    return value.slice(LUCIDE_PREFIX.length) || null;
  }
  return LUCIDE_NAME_BY_MDI.get(value) ?? null;
}

/**
 * Drawings that ship with the app (`category-line-icons.tsx`), by Lucide name:
 * a category with one of these draws at once, without the catalogue.
 */
export const BUNDLED_ICONS: Readonly<Record<string, LucideIcon>> = {
  house: Line.Home,
  utensils: Line.Utensils,
  coffee: Line.Coffee,
  'shopping-cart': Line.ShoppingCart,
  'shopping-bag': Line.ShoppingBag,
  camera: Line.Camera,
  car: Line.Car,
  fuel: Line.Fuel,
  plane: Line.Plane,
  stethoscope: Line.Stethoscope,
  dumbbell: Line.Dumbbell,
  'graduation-cap': Line.GraduationCap,
  'book-open': Line.BookOpen,
  gift: Line.Gift,
  'gamepad-2': Line.Gamepad2,
  'eighth-notes': Line.Music,
  'paw-print': Line.PawPrint,
  monitor: Line.Monitor,
  cloud: Line.Cloud,
  repeat: Line.Repeat,
  calendar: Line.Calendar,
  copy: Line.Copy,
  'alarm-clock': Line.AlarmClock,
  smartphone: Line.Smartphone,
  zap: Line.Zap,
  wrench: Line.Wrench,
  'shield-check': Line.ShieldCheck,
  'receipt-text': Line.ReceiptText,
  wallet: Line.Wallet,
  banknote: Line.Banknote,
  landmark: Line.Landmark,
  'credit-card': Line.CreditCard,
  'piggy-bank': Line.PiggyBank,
  'trending-up': Line.TrendingUp,
  briefcase: Line.Briefcase,
  heart: Line.Heart,
  tag: Line.Tag,
  'arrow-left-right': Line.ArrowLeftRight,
  'building-complex': Line.Building2,
  'circle-dollar-sign': Line.CircleDollarSign,
  handshake: Line.Handshake,
  laptop: Line.Laptop,
  megaphone: Line.Megaphone,
  ellipsis: Line.MoreHorizontal,
  package: Line.Package,
  percent: Line.Percent,
  printer: Line.Printer,
  scale: Line.Scale,
  shield: Line.Shield,
  store: Line.Store,
  truck: Line.Truck,
  users: Line.Users,
};

/** "gamepad-2" → "Gamepad 2": how an icon without a translated name is listed. */
export function humanIconName(name: string): string {
  const words = name.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
