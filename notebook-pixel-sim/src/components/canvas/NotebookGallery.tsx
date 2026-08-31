import { CSSProperties, ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { useGame } from '@/state/store';
import { setActiveLine } from '@/engine/mockEngine';
import { archetypeLabel } from '@/engine/mockEngine';
import { fmt$ } from '@/utils/format';
import { playSfx } from '@/audio/audioManager';
import { ViewToggle } from './ViewToggle';
import { Notebook, sizeScale } from './Notebook';
import { PixelIcon } from '@/components/icons/PixelIcon';
import { A } from '@/assets';
import { addOnById } from '@/data/addOns';
import { genreById, configOption, type GenreId, type ProductionSpec } from '@/data/finlit';
import { lineSize } from '@/engine/selectors';
import { vocFit } from '@/engine/finlit/fit';
import type { ProductLine, Segment } from '@/types';

const GALLERY_DEFAULT_SPEC: ProductionSpec = {
  type: 'indie', paper: 'cream', size: 'a5', pageDesign: 'lined', addon: 'bookmark', cover: 'plastic',
};

/**
 * NotebookGallery — the SHELF view. Browse every notebook in the portfolio at
 * once, each as a front-facing "book" resting on a wooden ledge, with an
 * insight caption (type, price, segment fit, add-ons, stock). Warm wood-grain
 * backdrop so it reads as a shelf rather than a blank grid. Click a book to
 * focus it; an empty slot adds a new one. Hover lifts the book; a gentle
 * staggered idle sway keeps the shelf alive (reduced-motion aware).
 */
const SHELF_BG: CSSProperties = {
  backgroundColor: '#3a2a1c',
  backgroundImage: [
    'radial-gradient(120% 80% at 50% -10%, rgba(255,236,190,0.10), rgba(0,0,0,0) 60%)',
    'linear-gradient(180deg, rgba(255,240,210,0.05), rgba(0,0,0,0.22))',
    'repeating-linear-gradient(0deg, rgba(0,0,0,0.10) 0 1px, transparent 1px 4px)',
    'repeating-linear-gradient(90deg, rgba(0,0,0,0.05) 0 1px, transparent 1px 7px)',
  ].join(','),
};


export function NotebookGallery() {
  const lines = useGame((s) => s.portfolio.productLines);
  const activeLineId = useGame((s) => s.portfolio.activeLineId);
  const marketTarget = useGame((s) => s.market.targetSegment);
  const fitMap = useGame((s) => s.market.fitBySegmentByLineId);
  const apply = useGame((s) => s.apply);
  const setViewMode = useGame((s) => s.setViewMode);
  const openDrawer = useGame((s) => s.openDrawer);
  const reduced = useReducedMotion();

  const focus = (id: string) => {
    playSfx('click-soft');
    apply((s) => setActiveLine(s, id));
    setViewMode('focus');
  };

  return (
    <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden" style={SHELF_BG}>
      {/* Floating header cards — SAME 48px band + positions as the focus
          view's title card + view controls, so toggling Focus ⇄ Shelf keeps
          every control exactly in place. */}
      <div className="absolute left-3 top-3 z-20 max-w-[calc(50%-120px)]">
        <div className="panel-frame bg-surface h-[48px] pl-2 pr-3 flex items-center gap-2.5 w-fit max-w-full">
          {/* accent chip + eyebrow + arcade-font name — same title-plate
              anatomy as the focus view's notebook title. */}
          <span aria-hidden className="inline-flex items-center justify-center w-8 h-8 border border-primary bg-primary-soft shrink-0">
            <PixelIcon kind="inventory" size={15} color="var(--c-primary)" />
          </span>
          <div className="flex flex-col justify-center gap-[3px] leading-none min-w-0">
            <span className="stat-label leading-none">
              Portfolio
            </span>
            <span className="eyebrow eyebrow-sm text-text truncate leading-none">
              Your Shelf
            </span>
          </div>
          <span aria-hidden className="hidden md:block w-px h-6 bg-border-soft shrink-0" />
          <span className="hidden md:block hint text-text-2 truncate">
            {lines.length} notebook{lines.length === 1 ? '' : 's'} · click one to focus
          </span>
        </div>
      </div>
      <div className="absolute right-3 top-3 z-[45] h-[48px] flex items-center gap-1.5 panel-frame panel-frame--lifted bg-surface px-1.5">
        <ViewToggle />
        {/* Same Details affordance as the focus view, in the same slot, so
            the toggle itself never shifts when switching views. */}
        {/* h matches the ViewToggle's OUTER height so the strip aligns. */}
        <button
          onClick={() => { playSfx('click-soft'); openDrawer('right', 'details'); }}
          className="pbtn ctl-btn px-2.5 h-[32px] eyebrow eyebrow-sm text-text-2 hover:text-text"
        >
          <img src={A.ui.pixel.info} alt="" className="w-[14px] h-[14px] object-contain" style={{ imageRendering: 'pixelated' }} draggable={false} />
          <span className="hidden md:inline">Details</span>
        </button>
      </div>

      {/* Shelf area — padding clears the floating header (top), the left
          dock column (sm+), the phone bottom dock bar, and the bottom-right
          Stats button when scrolled to the end. */}
      <div className="flex-1 min-h-0 overflow-y-auto pt-[76px] pb-[84px] sm:pb-28 px-3 sm:pl-[118px] sm:pr-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {lines.map((l, i) => (
            <BookCard
              key={l.id}
              line={l}
              index={i}
              active={l.id === activeLineId}
              fit={(() => {
                const seg = l.targetSegment ?? marketTarget;
                return seg ? (fitMap[l.id]?.[seg] ?? null) : null;
              })()}
              segment={l.targetSegment ?? marketTarget}
              reduced={!!reduced}
              onClick={() => focus(l.id)}
            />
          ))}
          <AddCard onClick={() => { playSfx('click-soft'); openDrawer('left', 'items'); }} />
        </div>
      </div>
    </div>
  );
}

function BookCard({
  line,
  index,
  active,
  fit,
  segment,
  reduced,
  onClick,
}: {
  line: ProductLine;
  index: number;
  active: boolean;
  fit: number | null;
  segment: Segment | null;
  reduced: boolean;
  onClick: () => void;
}) {
  const instances = line.addOnsByArchetype[line.archetype] ?? [];
  const stock = line.inventory.finished;
  // V3 caption — genre market, VoC fit, spec summary, channels.
  const genre: GenreId = (line.genre ?? 'indie') as GenreId;
  const spec: ProductionSpec = { ...GALLERY_DEFAULT_SPEC, type: genre, ...(line.finlitSpec ?? {}) };
  const stickersSpend = Math.min((line.addOnsByArchetype?.[line.archetype] ?? []).length * 0.15, 100);
  const vfit = vocFit(spec, line.price, stickersSpend, genre);
  const fitPct = Math.round(vfit * 100);
  const fitTone = vfit >= 1.08 ? 'success' : vfit < 0.85 ? 'warn' : 'info';
  const specSummary = `${configOption('paper', spec.paper).name.split(' ')[0]} · ${spec.size.toUpperCase()} · ${configOption('pageDesign', spec.pageDesign).name}`;
  void fit; void segment;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={`${line.name} - open in focus view`}
      className={clsx(
        'group relative flex flex-col text-left border-2 bg-surface overflow-hidden cursor-pointer',
        active ? 'border-primary shadow-[0_6px_0_0_var(--c-shadow)]' : 'border-border-soft hover:border-border',
      )}
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={reduced ? {} : { opacity: 1, y: [14, 0, 0], }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.2, 1, 0.4, 1] }}
      whileHover={reduced ? undefined : { y: -5 }}
      whileTap={{ scale: 0.98 }}
    >
      {active && (
        <span className="absolute top-1.5 left-1.5 z-10 bg-primary-strong text-white item-name px-1.5 py-0.5 border border-border">
          ACTIVE
        </span>
      )}
      {/* Breathing ring so the active book glows softly on the shelf. */}
      {active && !reduced && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 border-2 border-primary"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* The REAL notebook — same renderer as the focus canvas, so cover,
          binding, SIZE and placed add-ons all show true-to-config. */}
      <div className="relative h-[172px] overflow-hidden" style={SHELF_BG}>
        <motion.div
          className="absolute inset-2 transition-[filter] duration-200 group-hover:brightness-110"
          animate={reduced ? {} : { y: [0, -2.5, 0] }}
          transition={reduced ? {} : { duration: 4 + (index % 3), repeat: Infinity, ease: 'easeInOut', delay: index * 0.25 }}
        >
          {/* SQUARE stage (centered) — matches the focus canvas exactly so
              add-on 0..1 positions map onto the notebook, not the wider card. */}
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="relative h-full aspect-square">
              <Notebook
                archetype={line.archetype}
                cover={line.cover}
                binding={line.binding}
                size={lineSize(line)}
              />
              {/* Add-ons scale WITH the notebook (same as focus view) so they
                  sit on the cover identically. */}
              <div
                className="absolute inset-0"
                style={{ transform: `scale(${sizeScale(lineSize(line))})`, transformOrigin: 'center center' }}
              >
                {instances.map((inst) => {
                  const def = addOnById(inst.defId);
                  if (!def) return null;
                  return (
                    <img
                      key={inst.id}
                      src={def.imgPath}
                      alt=""
                      draggable={false}
                      className="absolute object-contain pointer-events-none"
                      style={{
                        left: `${inst.x * 100}%`,
                        top: `${inst.y * 100}%`,
                        width: `${inst.scale * 100}%`,
                        transform: `translate(-50%, -50%) rotate(${inst.rotation}deg)`,
                        zIndex: inst.zIndex,
                        imageRendering: 'pixelated',
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
        {/* soft ground shadow */}
        <div aria-hidden className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[55%] h-3 bg-black/35 blur-[3px] rounded-[50%]" />
      </div>

      {/* Insight caption */}
      <div className="flex flex-col gap-1.5 px-2.5 py-2 border-t border-border-soft bg-surface">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="item-name text-text truncate">{line.name}</span>
          <span className="num-xs text-text shrink-0">{fmt$(line.price)}</span>
        </div>
        <div className="stat-label truncate">
          {genreById(genre).name} · {specSummary}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Chip tone={fitTone}>{fitPct}% fit</Chip>
          <Chip tone="info">{stickersSpend > 0 ? `${stickersSpend.toFixed(0)} stickers` : 'no stickers'}</Chip>
          <Chip tone={stock === 0 ? 'warn' : 'neutral'}>{stock} stock</Chip>
        </div>
      </div>
    </motion.button>
  );
}

function Chip({ children, tone }: { children: ReactNode; tone: 'neutral' | 'success' | 'warn' | 'info' }) {
  const cls =
    tone === 'success' ? 'border-success/50 text-success bg-success-soft/40'
    : tone === 'warn' ? 'border-warning/50 text-warning bg-warning-soft/40'
    : tone === 'info' ? 'border-border-soft text-text-2 bg-surface-2'
    : 'border-border-soft text-text-3 bg-surface-2';
  return (
    <span className={clsx('inline-flex items-center px-1.5 py-0.5 border stat-label leading-none', cls)}>
      {children}
    </span>
  );
}

function AddCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Add a notebook"
      className="group flex flex-col items-center justify-center gap-2 min-h-[190px] border-2 border-dashed border-cream-100/30 bg-ink-900/20 text-cream-100/70 hover:border-primary hover:text-cream-100 hover:bg-ink-900/10 transition-colors cursor-pointer"
    >
      <span className="inline-flex items-center justify-center w-11 h-11 border-2 border-current body-sm leading-none strong group-hover:scale-110 transition-transform">+</span>
      <span className="eyebrow eyebrow-sm">Add notebook</span>
    </button>
  );
}
