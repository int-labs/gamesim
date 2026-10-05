import { useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useGame } from '@/state/store';
import { currentAddOns, placeAddOn, removeAddOn, archetypeLabel } from '@/engine/mockEngine';
import { addOnById } from '@/data/addOns';
import { playSfx } from '@/audio/audioManager';
import { A } from '@/assets';
import { NotebookCanvas } from '@/components/canvas/NotebookCanvas';
import { NotebookGallery } from '@/components/canvas/NotebookGallery';
import { ArchetypeDetailModal } from '@/components/canvas/ArchetypeDetailModal';
import { AddOnGallery } from '@/components/panels/ProductPanel';
import { FinlitDesignControls } from '@/components/panels/FinlitDesignControls';
import type { LiveProjectionState } from '@/gamesim/useLiveProjection';
import { ProductLineList } from '@/components/panels/ProductLineList';
import { ViewToggle } from '@/components/canvas/ViewToggle';
import { Drawer } from '@/components/hud/Drawer';

/** Rail width + the gutter the Details drawer must leave clear. The rail is
 *  PERMANENT now, so Details subtracts this unconditionally — there is no
 *  "left drawer closed" case in which it could use the full width. */
const RAIL_W = 360;
const RAIL_RESERVE = RAIL_W + 24;

/**
 * Product page — RAIL + STAGE.
 *
 *   [RAIL · sub-tabs + stacked sections]  ·  ★ stage ★
 *
 * The rail's three sections were a floating EdgeDock and a sliding left
 * Drawer: an icon slid a panel OVER the canvas, so the thing you were editing
 * covered the thing you were editing it for. Docked, they are always on and
 * the stage reflows beside them instead of being obscured.
 *
 * The stage is a context header, the canvas, and the add-on strip beneath it —
 * all three in the centre, because the add-ons DRAG onto the notebook and a
 * drag whose source is in another column is a gesture across the page. Details
 * stays a wide RIGHT drawer: it is a reference sheet read at 1040px, which the
 * rail cannot give it.
 */
const RAIL_TABS = [
  { id: 'items' as const, label: 'Notebook', icon: A.ui.sidebar.product },
  { id: 'design' as const, label: 'Design', icon: A.ui.config.notebook_type },
];
type RailTab = (typeof RAIL_TABS)[number]['id'];

/**
 * `details` owns the RIGHT drawer slot. It used to share the left slot, which
 * is why opening Details closed whatever you were editing and vice versa —
 * exactly the two panels you want side by side, since Details is the reference
 * sheet you read WHILE designing.
 */
const DETAILS_ID = 'details';

export function ProductPage({ liveProjectionState }: { liveProjectionState?: LiveProjectionState }) {
  const rightDrawer = useGame((s) => s.ui.rightDrawer);
  const viewMode = useGame((s) => s.ui.viewMode);
  const closeDrawer = useGame((s) => s.closeDrawer);
  // The page owns the Details trigger now, so it needs the opener the two
  // canvas components used to hold.
  const openDrawer = useGame((s) => s.openDrawer);
  const lineCount = useGame((s) => s.portfolio.productLines.length);
  const apply = useGame((s) => s.apply);
  const showToast = useGame((s) => s.showToast);

  // Which rail section is showing. Local, not `ui.leftDrawer`: the rail is
  // always open, so there is no closed state for the store to hold.
  const [railTab, setRailTab] = useState<RailTab>('items');

  // Dragging an add-on tile out of the rail and onto the notebook.
  const [activeDrag, setActiveDrag] = useState<string | null>(null);
  // 4px before a press becomes a drag, so plain clicks still toggle the tile.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(ev) => {
        setActiveDrag((ev.active.data.current as { defId?: string } | undefined)?.defId ?? null);
      }}
      onDragCancel={() => setActiveDrag(null)}
      onDragEnd={(ev) => {
        const defId = (ev.active.data.current as { defId?: string } | undefined)?.defId;
        const overId = ev.over?.id;
        setActiveDrag(null);
        if (!defId) return;
        if (overId !== 'notebook-canvas') {
          // Shelf view has no canvas droppable — say so rather than letting the
          // drag silently evaporate.
          if (viewMode === 'gallery') {
            showToast({ kind: 'warning', text: 'Switch to Focus view to place add-ons on the notebook', ms: 2000 });
          }
          return;
        }
        // Dropping ANYWHERE on the notebook lands the add-on at its category
        // default, not the pixel drop point: the add-on layer is the notebook's
        // own footprint — small, and it bobs — so aiming at a moving target was
        // fiddly. Land it sensibly, then let the player nudge the PLACED add-on,
        // which is pixel-precise.
        let placed = false;
        apply((s) => {
          // A sibling of an already-placed add-on swaps in: placeAddOn keeps its
          // strict same-category rejection, so evict the old one first.
          const newCat = addOnById(defId)?.category;
          if (newCat) {
            const sameCat = currentAddOns(s).find(
              (pIn) => addOnById(pIn.defId)?.category === newCat && pIn.defId !== defId,
            );
            if (sameCat) removeAddOn(s, sameCat.id);
          }
          placed = placeAddOn(s, defId);
        });
        if (placed) {
          playSfx('pop');
          // No drawer to close any more — the rail sits BESIDE the canvas, so
          // the add-on lands in full view without dismissing anything.
          window.dispatchEvent(new CustomEvent('intlabs:burst', { detail: { x: 0.5, y: 0.5 } }));
        } else {
          // Post-swap the only remaining failure is the 3-add-on cap.
          showToast({ kind: 'warning', text: 'Max 3 add-ons. Remove one to add another.', ms: 1700 });
          playSfx('fail');
        }
      }}
    >
      {/* PAGE REGION — rail + stage. `relative overflow-hidden` is the
          positioning context the Details drawer is clipped by as it slides. */}
      <div className="relative flex-1 min-h-0 min-w-0 flex overflow-hidden">
        {/* ── RAIL — the page's own stacked sections ────────────────────── */}
        <aside
          className="shrink-0 flex flex-col border-r border-black/40 bg-surface"
          style={{ width: RAIL_W }}
          aria-label="Notebook controls"
        >
          <div role="tablist" aria-label="Notebook controls" className="shrink-0 flex items-stretch border-b border-border-soft bg-surface-2">
            {RAIL_TABS.map((t) => {
              const active = railTab === t.id;
              const badge = t.id === 'items' ? lineCount : 0;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => { if (!active) playSfx('click-soft'); setRailTab(t.id); }}
                  className={clsx(
                    'flex-1 min-w-0 h-[40px] inline-flex items-center justify-center gap-1.5 px-1.5 border-b-2 eyebrow eyebrow-sm cursor-pointer transition-colors',
                    active
                      ? 'border-primary bg-surface text-text'
                      : 'border-transparent text-text-2 hover:bg-surface hover:text-text',
                  )}
                >
                  <img
                    src={t.icon}
                    alt=""
                    className={clsx('w-[15px] h-[15px] object-contain shrink-0', !active && 'opacity-60 grayscale-[35%]')}
                    style={{ imageRendering: 'pixelated' }}
                    draggable={false}
                  />
                  <span className="truncate">{t.label}</span>
                  {badge > 0 && (
                    <span className="shrink-0 num-xs leading-none px-1 py-px border border-border-soft bg-surface-2">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* `p-3.5` matches what the Drawer body used to supply: ProductLineList's
              sticky "Add Notebook" footer bleeds over it with -mx-3.5/-mb-3.5, so
              changing this padding breaks that footer's alignment. */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5">
            {/* Keyed fade so switching sections reads as a swap, not a cut. */}
            <motion.div
              key={railTab}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.16, ease: [0.2, 1, 0.4, 1] }}
            >
              {railTab === 'items' && <ProductLineList />}
              {railTab === 'design' && (
                <FinlitDesignControls
                  liveProjection={liveProjectionState?.liveProjection ?? null}
                  recalc={liveProjectionState?.recalc}
                />
              )}
            </motion.div>
          </div>
        </aside>

        {/* ── STAGE — context header, chip row, canvas ──────────────────── */}
        <section className="flex-1 min-w-0 min-h-0 flex flex-col">
          <StageHeader
            detailsOpen={rightDrawer === DETAILS_ID}
            onOpenDetails={() => {
              playSfx('click-soft');
              openDrawer('right', DETAILS_ID);
            }}
          />
          <div className="flex-1 min-h-0 flex flex-col">
            {viewMode === 'gallery' ? <NotebookGallery /> : <NotebookCanvas />}
          </div>
          {/* ADD-ON STRIP — the drag source, directly under the notebook it
              decorates and above the footer. `shrink-0` so a long catalogue
              scrolls sideways rather than eating the canvas's height. */}
          <div className="shrink-0 border-t border-border-soft bg-surface-2 px-3 py-2">
            <AddOnGallery />
          </div>
        </section>

      {/* Details - a wide RIGHT drawer, no backdrop. It stays a drawer rather
          than a fourth rail section because it is a reference sheet with its
          own internal rail, read at ~1040px; at the rail's 360px it is
          unreadable. The cap below keeps it clear of the rail, so you read the
          market data while the spec controls stay live beside it. */}
      <Drawer
        side="right"
        open={rightDrawer === DETAILS_ID}
        title="Notebook Details"
        onClose={() => closeDrawer('right')}
        // "As wide as you like, but never over the rail." The 520px floor wins
        // on a small screen, where the two genuinely do not both fit — it
        // overlaps there, which is the best available on that width.
        width={`min(1040px, max(520px, calc(100% - ${RAIL_RESERVE}px)))`}
        backdrop={false}
        closeOnOutsidePointer
        zClassName="z-[60]"
        // The sheet owns its own scroll regions (rail, panel), so the drawer
        // body neither pads nor scrolls - otherwise you get a scrollbar inside
        // a scrollbar and the rail scrolls away from its tabs.
        bodyFill
      >
        <ArchetypeDetailModal fill open onClose={() => closeDrawer('right')} />
      </Drawer>

      {/* The dragged tile's ghost. dropAnimation={null} because the add-on
          lands at its category default, not under the cursor — animating the
          ghost "home" would point at the wrong place. */}
      <DragOverlay dropAnimation={null}>
        {activeDrag ? (
          <div className="pointer-events-none border-2 border-success bg-surface p-2 shadow-pixel-2">
            <img
              src={addOnById(activeDrag)?.thumbPath ?? addOnById(activeDrag)?.imgPath}
              alt=""
              className="w-14 h-14 object-contain"
              draggable={false}
            />
          </div>
        ) : null}
      </DragOverlay>
    </div>
    </DndContext>
  );
}

/**
 * The ACTIVE line, by id — never `productLines[0]` as the primary read. The
 * `??` tail is the no-selection fallback only, matching `useActiveLine` in
 * ProductPanel so the header and the rail panels can never name two different
 * notebooks.
 */
const useActiveLine = () =>
  useGame(
    (s) =>
      s.portfolio.productLines.find((l) => l.id === s.portfolio.activeLineId)
      ?? s.portfolio.productLines[0],
  );

/**
 * StageHeader — says WHICH notebook the stage is showing, and carries the
 * controls that act on the stage as a whole.
 *
 * Focus/Shelf and Details were a floating strip pinned over the canvas's
 * top-right corner, which is why they had to be hoisted out of the two canvas
 * components to survive the empty-portfolio case. In a header row they are
 * simply in the layout: unconditional by construction, with nothing to
 * overlap.
 */
function StageHeader({
  detailsOpen,
  onOpenDetails,
}: {
  detailsOpen: boolean;
  onOpenDetails: () => void;
}) {
  const line = useActiveLine();
  return (
    <header className="shrink-0 h-[52px] flex items-center gap-3 px-3 border-b border-border-soft bg-surface-2">
      <div className="min-w-0 flex-1 flex flex-col justify-center">
        <span className="item-name text-text truncate leading-tight">
          {line?.name ?? 'No notebook selected'}
        </span>
        <span className="hint truncate leading-tight">
          {line ? archetypeLabel(line.productId) : 'Add one from the Notebook tab'}
        </span>
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        <ViewToggle />
        <button
          // Marks the trigger so the drawer's outside-pointer close ignores it
          // — otherwise the same press that opens Details also dismisses it.
          data-drawer-trigger
          aria-expanded={detailsOpen}
          onClick={onOpenDetails}
          className="pbtn ctl-btn px-2.5 h-[32px] eyebrow eyebrow-sm text-text-2 hover:text-text"
        >
          <img src={A.ui.pixel.info} alt="" className="w-[14px] h-[14px] object-contain" style={{ imageRendering: 'pixelated' }} draggable={false} />
          <span className="hidden md:inline">Details</span>
        </button>
      </div>
    </header>
  );
}

