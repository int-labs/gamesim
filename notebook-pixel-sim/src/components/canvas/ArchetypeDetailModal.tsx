import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '@/state/store';
import type { Archetype } from '@/types';
import { ARCHETYPE_INFO, notebookCatalogue, defaultArchetype } from '@/data/notebookArchetypes';
import { PixelModal } from '@/components/primitives/PixelModal';
import { PixelButton } from '@/components/primitives';
import { setProductField } from '@/engine/mockEngine';
import { playSfx } from '@/audio/audioManager';
import { BuyerInterestTab, MarketDataTab } from './NotebookMarketTabs';
import clsx from 'clsx';

const VIEWS = ['angle', 'front', 'spine', 'open', 'shelf'] as const;
type View = (typeof VIEWS)[number];

/** Rail contents come from the live catalogue, so a published notebook
 *  gets a tile automatically. */
const notebookIds = (): Archetype[] => notebookCatalogue().map((n) => n.id);

/**
 * Three lenses on the same notebook: what it IS, who WANTS it, and how big
 * that want is. They're tabs rather than one long scroll because they answer
 * different questions — you arrive asking one of them, not all three.
 */
const TABS = [
  { id: 'product', label: 'Product', hint: 'What this notebook is' },
  { id: 'buyers', label: 'Buyer Interest', hint: 'Who wants it, and what they weigh' },
  { id: 'market', label: 'Market Data', hint: 'How big each market is, and its growth' },
] as const;
type TabId = (typeof TABS)[number]['id'];

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
  // permitted) — Details can open in that state, so every access below the
  // guard must stay behind `if (!product)`.
  const product = useGame(
    (s) => s.portfolio.productLines.find((l) => l.id === s.portfolio.activeLineId)
      ?? (s.portfolio.productLines[0] as (typeof s.portfolio.productLines)[0] | undefined),
  );
  const apply = useGame((s) => s.apply);
  // Hooks run unconditionally (before the empty-portfolio early return).
  const [arch, setArch] = useState<Archetype>(product?.archetype ?? defaultArchetype());
  const [view, setView] = useState<View>('angle');
  const [tab, setTab] = useState<TabId>('product');

  if (!product) {
    const empty = (
      <div className="flex flex-col items-center justify-center text-center px-4 py-12 gap-2">
        <div className="item-name text-text">No notebook to inspect</div>
        <p className="hint text-text-2 max-w-[28ch]">
          Add one in <span className="strong text-text">Notebook Items</span> first - details show up here.
        </p>
      </div>
    );
    if (inline || fill) return <div className="p-4">{empty}</div>;
    return (
      <PixelModal open={!!open} onClose={onClose} title="Notebook Details">
        {empty}
      </PixelModal>
    );
  }

  const info = ARCHETYPE_INFO[arch];

  const pick = (next: Archetype) => {
    if (next === arch) return;
    playSfx('click-soft');
    setArch(next);
  };

  const switchTab = (next: TabId) => {
    if (next === tab) return;
    playSfx('whoosh');
    setTab(next);
  };


  // Inline (drawer) stays a single narrow column — no rail, no tabs, and the
  // two halves stack because there is no room to sit them side by side.
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

  // The full sheet, shared by both presentations so the drawer and the modal
  // can never drift apart in content.
  const body = (
    <div className="flex h-full min-h-0">
      {/* ── Left rail — which notebook you're inspecting. Vertical so the
           three stay visible while the panel beside them changes. ── */}
      <div role="group" aria-label="Notebook to inspect" className="w-[92px] sm:w-[108px] shrink-0 border-r border-border-soft bg-cream-200 p-2 flex flex-col gap-2 overflow-y-auto">
        {notebookIds().map((id) => (
          <RailTile key={id} id={id} active={id === arch} owned={id === product.archetype} onPick={() => pick(id)} />
        ))}
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* ── Tab bar ── */}
        <div role="tablist" aria-label="Notebook details sections" className="shrink-0 flex items-end gap-1 px-2 pt-2 border-b border-border-soft bg-cream-200">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <motion.button
                key={t.id}
                onClick={() => switchTab(t.id)}
                title={t.hint}
                aria-selected={active}
                role="tab"
                whileTap={{ scale: 0.95 }}
                whileHover={active ? undefined : { y: -2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                className={clsx(
                  'relative tab-label-sm px-3.5 sm:px-4 py-2.5 border-2 border-b-0 transition-colors cursor-pointer whitespace-nowrap',
                  active
                    ? 'bg-cream-50 border-ink-900 text-ink-900 -mb-[2px] pb-[12px]'
                    : 'bg-cream-100 border-ink-700/30 text-text-2 hover:text-text hover:bg-cream-50',
                )}
              >
                {t.label}
                {active && (
                  // Shared layout id slides the highlight between tabs
                  // instead of it blinking out and back in.
                  <motion.div
                    layoutId="detail-tab-underline"
                    className="absolute left-0 right-0 -bottom-[2px] h-[3px] bg-cream-50"
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* ── Panel ── */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 bg-cream-50">
          {/* Keyed remount rather than AnimatePresence+mode="wait": waiting
              for an exit before mounting the next panel costs ~2x the
              duration and flashes an empty panel mid-swap. Re-keying replays
              the enter animation instantly with no gap. */}
          <motion.div
              key={`${tab}-${arch}`}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.18, ease: [0.2, 1, 0.4, 1] }}
            >
              {tab === 'product' && (
                // TWO ROWS, not two columns. Identity reads across the top -
                // art on the left, name / tagline / story on the right - and
                // the two lists you weigh against each other sit side by side
                // beneath it. Stacked in a narrow right-hand column, strengths
                // and weakness could only be compared vertically, which is the
                // one direction you cannot scan two lists in.
                <div className="flex flex-col gap-5">
                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,400px)_1fr] gap-5 items-start">
                    <ProductIdentity arch={arch} view={view} setView={setView} />
                    <ProductCopy arch={arch} />
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                    <ProductStrengths arch={arch} />
                    <ProductWeakness arch={arch} />
                  </div>
                </div>
              )}
              {tab === 'buyers' && <BuyerInterestTab arch={arch} />}
              {tab === 'market' && <MarketDataTab arch={arch} />}
          </motion.div>
        </div>

        {/* ── Footer — the only action this modal offers. Always visible so
             it never hides below a long scroll. ── */}
        {arch !== product.archetype && (
          <div className="shrink-0 flex items-center justify-between gap-3 px-3.5 py-2.5 border-t border-border-soft bg-cream-200">
            <div className="hint text-text-2 leading-snug min-w-0 truncate">
              Currently making <span className="strong text-text">{ARCHETYPE_INFO[product.archetype].title}</span>
            </div>
            <PixelButton
              variant="primary"
              size="md"
              onClick={() => {
                playSfx('coin');
                apply((s) => setProductField(s, 'archetype', arch));
                if (onClose) onClose();
              }}
            >
              Switch to {info.title}
            </PixelButton>
          </div>
        )}
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

/** One notebook in the left rail. */
function RailTile({
  id, active, owned, onPick,
}: { id: Archetype; active: boolean; owned: boolean; onPick: () => void }) {
  const art = ARCHETYPE_INFO[id]?.art;
  return (
    <motion.button
      onClick={onPick}
      aria-pressed={active}
      className={clsx(
        'relative flex flex-col items-center justify-center gap-1 px-1 py-2 border-2 cursor-pointer min-w-0 w-full',
        active
          ? 'border-ink-900 bg-cream-50 shadow-pixel-2 ring-2 ring-ui-primary/40'
          : 'border-ink-700/30 bg-cream-100 hover:bg-cream-50',
      )}
      whileHover={{ y: -3, rotate: -1.5 }}
      whileTap={{ scale: 0.94, rotate: 0 }}
      animate={active ? { scale: 1 } : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 340, damping: 18 }}
    >
      {/* A dot, not a word — the rail is too narrow for a label that would
          wrap, and "which one am I actually producing" still needs an answer. */}
      {owned && (
        <span
          title="You're making this one"
          className="absolute top-1 right-1 w-2 h-2 bg-success border border-ink-900"
        />
      )}
      <img
        src={art}
        alt=""
        className="h-10 sm:h-12 object-contain"
        style={{ imageRendering: 'pixelated' }}
        draggable={false}
      />
      <span
        className={clsx(
          'eyebrow eyebrow-sm truncate max-w-full',
          active ? 'eyebrow-strong' : 'eyebrow-muted',
        )}
      >
        {ARCHETYPE_INFO[id]?.title ?? id}
      </span>
    </motion.button>
  );
}

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

