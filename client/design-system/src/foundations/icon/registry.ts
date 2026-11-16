import {
  BaggageClaim,
  Banknote,
  Briefcase,
  Building,
  Building2,
  Car,
  ChartBar,
  CircleDollarSign,
  CreditCard,
  DollarSign,
  Factory,
  Globe,
  GraduationCap,
  HandCoins,
  HeartHandshake,
  HeartPulse,
  Hotel,
  House,
  Landmark,
  Layers,
  LayoutGrid,
  Leaf,
  MapPin,
  Megaphone,
  Monitor,
  Package,
  PaintBucket,
  Palette,
  Plane,
  Rocket,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Star,
  Store,
  Tag,
  Target,
  Truck,
  User,
  Users,
  Utensils,
  Wallet,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Icons that data can name, such as a product's sidebar icon in a simulation's configuration.
 * Keys are lucide's names. In code, import the icon itself; this registry exists only for names
 * that arrive as data, and it adds every icon below to the bundle of the screen that uses it.
 *
 * It holds the 44 icons the clients' `lucideIconMap` offered, plus the two segment glyphs of the
 * Figma player screens (baggage-claim for Retail Affluent, dollar-sign for cost).
 */
export const iconRegistry = {
  "baggage-claim": BaggageClaim,
  banknote: Banknote,
  briefcase: Briefcase,
  building: Building,
  "building-2": Building2,
  car: Car,
  "chart-bar": ChartBar,
  "circle-dollar-sign": CircleDollarSign,
  "credit-card": CreditCard,
  "dollar-sign": DollarSign,
  factory: Factory,
  globe: Globe,
  "graduation-cap": GraduationCap,
  "hand-coins": HandCoins,
  "heart-handshake": HeartHandshake,
  "heart-pulse": HeartPulse,
  hotel: Hotel,
  house: House,
  landmark: Landmark,
  layers: Layers,
  "layout-grid": LayoutGrid,
  leaf: Leaf,
  "map-pin": MapPin,
  megaphone: Megaphone,
  monitor: Monitor,
  package: Package,
  "paint-bucket": PaintBucket,
  palette: Palette,
  plane: Plane,
  rocket: Rocket,
  shield: Shield,
  "shopping-bag": ShoppingBag,
  "shopping-cart": ShoppingCart,
  smartphone: Smartphone,
  sparkles: Sparkles,
  star: Star,
  store: Store,
  tag: Tag,
  target: Target,
  truck: Truck,
  user: User,
  users: Users,
  utensils: Utensils,
  wallet: Wallet,
  wrench: Wrench,
  zap: Zap,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof iconRegistry;

/** Every registry name, sorted, for an icon picker. */
export const iconNames = (Object.keys(iconRegistry) as IconName[]).sort();

/**
 * Names that lucide has since changed, as the Figma file and older data still use them. The Figma
 * slugs "slash-bold" and "graph-up-arrow" are Bootstrap glyphs: use SlashSeparator and TrendingUp.
 */
export const renamedIcons: Readonly<Record<string, string>> = {
  "alert-circle": "circle-alert",
  "alert-triangle": "triangle-alert",
  "area-chart": "chart-area",
  "bar-chart-4": "chart-column-increasing",
  "bar-chart-horizontal": "chart-bar",
  "check-circle": "circle-check",
  "check-circle-2": "circle-check-big",
  "code-2": "code-xml",
  "file-pie-chart": "file-chart-pie",
  "help-circle": "circle-help",
  home: "house",
  "line-chart": "chart-line",
  "pen-square": "square-pen",
  "pie-chart": "chart-pie",
  "users-2": "users-round",
  "x-circle": "circle-x",
  "x-lg": "x",
};

/** "Building2" and "building2" become "building-2"; "ChartBar" becomes "chart-bar". */
function toKebabCase(name: string): string {
  return name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([a-zA-Z])(\d)/g, "$1-$2")
    .toLowerCase();
}

/**
 * The registry icon for a name that came from data, or undefined. Accepts lucide names
 * ("building-2"), the PascalCase component names stored by today's configuration ("Building2")
 * and renamed old names ("home").
 */
export function resolveIcon(name: string | null | undefined): LucideIcon | undefined {
  if (!name) return undefined;
  const kebab = toKebabCase(name);
  const current = renamedIcons[kebab] ?? kebab;
  return Object.prototype.hasOwnProperty.call(iconRegistry, current) ? iconRegistry[current as IconName] : undefined;
}
