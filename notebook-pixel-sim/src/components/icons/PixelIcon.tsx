import clsx from 'clsx';
import {
  Wallet,
  DollarSign,
  TrendingUp,
  ReceiptText,
  Package,
  ShoppingCart,
  Target,
  Zap,
  Flag,
  Users,
  Settings,
  Megaphone,
  BookOpen,
  Briefcase,
  Trophy,
  CircleHelp,
  X,
  Check,
  TriangleAlert,
  Info,
  Pencil,
  Sparkles,
  Tag,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Bot,
  Bell,
  Minus,
  Plus,
  Trash2,
  ChevronDown,
  History,
  HardHat,
  RotateCcw,
  RotateCw,
  Crosshair,
  BringToFront,
  SendToBack,
  Lock,
  LockOpen,
  Eye,
  EyeOff,
  type LucideIcon,
} from 'lucide-react';

export type PixelIconKind =
  | 'cash' | 'profit' | 'revenue' | 'stock' | 'demand' | 'fit' | 'energy'
  | 'phase' | 'audience' | 'operations' | 'inventory' | 'sales'
  | 'product' | 'business' | 'results'
  | 'help' | 'close' | 'check' | 'warning' | 'info'
  | 'pen' | 'sparkle' | 'tag' | 'gear' | 'megaphone' | 'box'
  | 'arrow-right' | 'arrow-up' | 'arrow-down'
  | 'mascot' | 'bell' | 'minus' | 'plus' | 'dollar'
  | 'trash' | 'chevron-down'
  | 'history' | 'hire' | 'reset' | 'rotate-cw' | 'rotate-ccw'
  | 'crosshair' | 'bring-front' | 'send-back'
  | 'lock' | 'unlock' | 'eye' | 'eye-off';

interface Props {
  kind: PixelIconKind;
  size?: number;
  color?: string;
  className?: string;
  title?: string;
}

/**
 * Icon facade backed by lucide-react. The original implementation drew
 * pixel-art glyphs in SVG; those proved hard to read at small sizes
 * (legibility complaints in user testing). Same `kind`-based API is
 * preserved so call sites don't need to change.
 *
 * Each kind maps to a semantically appropriate lucide icon. When
 * multiple kinds reuse the same lucide glyph (e.g. `box`/`stock`/
 * `inventory` all → Package), context decides — the kind name
 * documents intent at the call site.
 */
const KIND_TO_LUCIDE: Record<PixelIconKind, LucideIcon> = {
  // Financial / KPI
  cash: Wallet,
  dollar: DollarSign,
  profit: TrendingUp,
  revenue: ReceiptText,
  stock: Package,
  box: Package,
  inventory: Package,
  demand: ShoppingCart,
  fit: Target,
  energy: Zap,
  // Game structure
  phase: Flag,
  audience: Users,
  operations: Settings,
  gear: Settings,
  sales: Megaphone,
  megaphone: Megaphone,
  // Page / navigation
  product: BookOpen,
  business: Briefcase,
  results: Trophy,
  // Status / feedback
  help: CircleHelp,
  close: X,
  check: Check,
  warning: TriangleAlert,
  info: Info,
  // Tools / actions
  pen: Pencil,
  sparkle: Sparkles,
  tag: Tag,
  trash: Trash2,
  // Directional
  'arrow-right': ArrowRight,
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
  'chevron-down': ChevronDown,
  // Misc
  mascot: Bot,
  bell: Bell,
  minus: Minus,
  plus: Plus,
  // Newer dedicated kinds — added during the pre-presentation QA pass
  // so call sites stop reusing semantically-wrong glyphs.
  history: History,
  hire: HardHat,
  // `reset` now points at Crosshair so it doesn't visually collide
  // with the rotate-left button in the add-on toolbar. RotateCcw is
  // used ONLY for the explicit rotate-left action.
  reset: Crosshair,
  'rotate-ccw': RotateCcw,
  'rotate-cw': RotateCw,
  crosshair: Crosshair,
  'bring-front': BringToFront,
  'send-back': SendToBack,
  lock: Lock,
  unlock: LockOpen,
  eye: Eye,
  'eye-off': EyeOff,
};

export function PixelIcon({ kind, size = 16, color = 'currentColor', className, title }: Props) {
  const Icon = KIND_TO_LUCIDE[kind];
  if (!Icon) return null;
  return (
    <Icon
      size={size}
      color={color}
      strokeWidth={2}
      className={clsx('inline-block shrink-0', className)}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    />
  );
}
