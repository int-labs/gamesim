import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '@/state/store';
import type { Archetype } from '@/types';
import { ARCHETYPE_INFO, defaultArchetype } from '@/data/notebookArchetypes';
import { PixelModal } from '@/components/primitives/PixelModal';
import { BuyerInterestTab, MarketDataTab } from './NotebookMarketTabs';
import clsx from 'clsx';

const VIEWS = ['angle', 'front', 'spine', 'open', 'shelf'] as const;
type View = (typeof VIEWS)[number];

/**
 * NO TABS AND NO RAIL. Reaching a chart used to mean picking a notebook from a
 * left rail AND then picking one of four lenses, so the market numbers a player
 * decides FROM sat two clicks deep. Owner, 2026-10-05: Product and Segments
 * out, every chart for every notebook on arrival, and nothing highlighted —
 * marking the player's own market would say the others matter less.
 */
interface Props {
  open?: boolean;
  onClose?: () => void;
  /** When true, render inline (e.g. inside a NARROW drawer) instead of as a modal. */
  inline?: boolean;
  /**
   * Render the FULL sheet - rail, tabs, panels, footer - with no modal chrome,
   * sized to fill its container. For the wide right-hand drawer.
   *
   * `inline` is the narrow-column variant and drops the rail and tabs, which is
   * right at 384px and wrong at 1040px: stretched across a wide drawer it loses
   * the notebook picker and every tab, which is what made the drawer look
   * broken.
   */
  fill?: boolean;
  /** When true, show a single representative view (no angle switcher). */
  hideViews?: boolean;
}

export function ArchetypeDetailModal({ open, onClose, inline, fill, hideViews: _hideViews }: Props) {
  // May be undefined with an EMPTY portfolio (deleting the last notebook is
  // permitted). Only the `inline` branch reads it, with `??`.
  const product = useGame(
    (s) => s.portfolio.productLines.find((l) => l.id === s.portfolio.activeLineId)
      ?? (s.portfolio.productLines[0] as (typeof s.portfolio.productLines)[0] | undefined),
  );
  const [view, setView] = useState<View>('angle');

  // NO EMPTY-PORTFOLIO BAIL. This used to return "No notebook to inspect" when
  // `productLines` was empty, which meant the market data only appeared AFTER
  // the player had already chosen. That is backwards: this sheet is what the
  // choice is made FROM. Owner, 2026-10-01. The sheet reads the CATALOGUE and
  // needs no line at all now.
  const arch: Archetype = product?.productId ?? defaultArchetype();

  // Inline (drawer) stays a single narrow column.
  if (inline) {
    return (
      <div className="pb-2 flex flex-col gap-3">
        <ProductIdentity arch={arch} view={view} setView={setView} />
        <ProductCopy arch={arch} />
        <ProductStrengths arch={arch} />
        <ProductWeakness arch={arch} />
      </div>
    );
  }

  // The full sheet — every chart, one scroll, nothing to select.
  const body = (
    <div className="flex h-full min-h-0">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 bg-cream-50">
          <div className="grid grid-cols-1 gap-6">
            <BuyerInterestTab />
            <MarketDataTab />
          </div>
        </div>

        {/* The "Switch to X" footer went with the rail on 2026-10-05. It acted
             on whichever notebook the rail had selected, and there is no
             selection now — switching is the Notebook section's job. */}
      </div>
    </div>
  );

  // Wide right-hand drawer: the sheet fills the drawer, which supplies its own
  // frame, header and close button.
  if (fill) return <div className="flex flex-col h-full min-h-0">{body}</div>;

  return (
    <PixelModal
      open={!!open}
      onClose={onClose}
      title="Notebook Details"
      size="lg"
      playful
      className="h-[min(660px,calc(100dvh-48px))]"
      // No padding here: the rail must sit flush against the frame and only
      // the panel beside it scrolls.
      bodyClassName="overflow-hidden"
    >
      {body}
    </PixelModal>
  );
}

/* `RailTile` was DELETED here on 2026-10-05 with the notebook rail it filled —
   its `active` highlight and its "you're making this one" dot included. */

function ProductGallery({
  arch, view, setView, showViews, compact,
}: { arch: Archetype; view: View; setView: (v: View) => void; showViews: boolean; compact?: boolean }) {
  const art = ARCHETYPE_INFO[arch]?.art;
  return (
    <div className="bg-cream-100 pixel-frame p-3 flex flex-col items-center gap-2">
      {/* The art is the point of this panel, and in a 400px column it had
          been sized for a much narrower one. */}
      <div className={clsx('w-full flex items-center justify-center', compact ? 'min-h-[200px]' : 'min-h-[300px]')}>
        <motion.img
          // Re-keying on the visible art makes each notebook/angle change pop
          // instead of hard-swapping the pixels underneath you. Once settled it
          // breathes on a slow loop so the panel never feels like a dead sheet.
          key={arch}
          src={art}
          alt=""
          className={clsx('object-contain w-full', compact ? 'max-h-[200px]' : 'max-h-[290px]')}
          draggable={false}
          initial={{ opacity: 0, scale: 0.9, rotate: -3 }}
          animate={{
            opacity: 1,
            scale: 1,
            rotate: 0,
            y: [0, -6, 0],
          }}
          transition={{
            opacity: { duration: 0.2 },
            scale: { type: 'spring', stiffness: 320, damping: 18 },
            rotate: { type: 'spring', stiffness: 320, damping: 18 },
            y: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
          }}
          whileHover={{ scale: 1.05, rotate: 1.5 }}
        />
      </div>
      <div className={clsx('flex items-center gap-1 flex-wrap justify-center', !showViews && 'hidden')}>
        {VIEWS.map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            aria-selected={view === v}
            className={clsx(
              'px-2 py-1 border eyebrow eyebrow-sm transition-colors cursor-pointer',
              view === v
                ? 'bg-surface text-text border-border shadow-[1px_1px_0_0_var(--c-shadow)]'
                : 'bg-transparent text-text-2 border-border-soft hover:bg-surface hover:text-text',
            )}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Left column: what the notebook IS — art, name, and the story. */
function ProductIdentity({ arch, view, setView }: { arch: Archetype; view: View; setView: (v: View) => void }) {
  return <ProductGallery arch={arch} view={view} setView={setView} showViews={false} />;
}

/** Name, tagline and the story - the reading column beside the art. */
function ProductCopy({ arch }: { arch: Archetype }) {
  const info = ARCHETYPE_INFO[arch];
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div>
        <motion.div
          key={`${arch}-title`}
          className="h2 uppercase text-ink-900"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        >
          {info.title}
        </motion.div>
        <div className="body-sm text-ink-700 mt-1.5">{info.tagline}</div>
      </div>
      <p className="body-xs text-ink-900 measure">{info.description}</p>
    </div>
  );
}

/* `SegmentsTab` was DELETED here on 2026-10-05 — the operator's segment HTML
   plus the driver-copy table. The sanitiser it relied on is untouched and still
   correct: `PlayerConfigPage`'s `sanitizeSegmentsHtml` runs on the way INTO the
   database, which is the only pass there has ever been. `products.segments` is
   still stored and still sanitised; nothing renders it at present. */

/** Right column: how it performs — the two lists you weigh against each other. */
function ProductStrengths({ arch }: { arch: Archetype }) {
  const info = ARCHETYPE_INFO[arch];
  return (
    <Card title="Strengths" tone="success">
      <ul className="body-xs text-ink-900 list-disc pl-5 space-y-1.5">
        {info.strengths.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </Card>
  );
}

function ProductWeakness({ arch }: { arch: Archetype }) {
  const info = ARCHETYPE_INFO[arch];
  return (
    <Card title="Weakness" tone="warn">
      <ul className="body-xs text-ink-900 list-disc pl-5 space-y-1.5">
        {info.tradeoffs.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </Card>
  );
}

function Card({
  title,
  tone = 'neutral',
  children,
}: {
  title: string;
  tone?: 'neutral' | 'success' | 'warn' | 'info';
  children: React.ReactNode;
}) {
  const headBg =
    tone === 'success' ? 'bg-success-soft' :
    tone === 'warn' ? 'bg-warn-soft' :
    tone === 'info' ? 'bg-info-soft' : 'bg-cream-200';
  return (
    <div className="border border-border-soft bg-cream-50">
      <div className={`px-3.5 py-2 border-b border-border-soft ${headBg}`}>
        <div className="section-title text-ink-900">{title}</div>
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  );
}

