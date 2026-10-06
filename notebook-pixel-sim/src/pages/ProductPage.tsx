import { useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useGame } from '@/state/store';
import { currentAddOns, placeAddOn, removeAddOn, archetypeLabel } from '@/engine/mockEngine';
import { addOnById } from '@/data/addOns';
import { playSfx } from '@/audio/audioManager';
import { NotebookCanvas } from '@/components/canvas/NotebookCanvas';
import { NotebookGallery } from '@/components/canvas/NotebookGallery';
import { AddOnGallery } from '@/components/panels/ProductPanel';
import { TopHUD } from '@/components/hud/TopHUD';
import type { LiveProjectionState } from '@/gamesim/useLiveProjection';

/**
 * ProductStage — the notebook itself, pinned beside the rail on EVERY section.
 *
 *   [ header: which notebook · Focus/Shelf ]
 *   [ canvas — the drop target            ]
 *   [ add-on strip — the drag source      ]
 *
 * It is a fixed-width column, not the hero it used to be: the decisions moved
 * into the rail and the rail is where the player works, so the stage's job is
 * to show what those decisions are producing. Its width is set by the caller.
 *
 * The add-ons sit under the canvas because they DRAG onto it — source and
 * target in one region. `DndContext` wraps only this column for the same
 * reason; nothing in the rail drags.
 */
export function ProductStage({
  className,
  style,
  liveProjectionState,
  isExpand,
  onToggleExpand,
}: {
  className?: string;
  style?: React.CSSProperties;
  /** For `TopHUD`, which is this column's header since 2026-10-05. */
  liveProjectionState?: LiveProjectionState;
  /** Whether the section rail is showing. Owned by `SimulationScreen`. */
  isExpand?: boolean;
  onToggleExpand?: () => void;
}) {
  const viewMode = useGame((s) => s.ui.viewMode);
  const apply = useGame((s) => s.apply);
  const showToast = useGame((s) => s.showToast);

  // Dragging an add-on tile out of the strip and onto the notebook.
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
          // THE DROP IS A DECISION, so the server has to be told.
          //
          // Add-ons are real spec axes — charms / ribbons / stickers /
          // functional — and each is submitted and costs money, so placing one
          // moves `dynamicCost` and `dynamicPrice`. Nothing subscribes to state
          // on the projection path: a control that changes a decision and does
          // not call `recalc` leaves the projection showing the PREVIOUS spec,
          // and this one never called it. See CLAUDE.md, "triggered on
          // interaction END".
          liveProjectionState?.recalc?.('add-on dropped on notebook');
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
      <section className={className} style={style}>
        {/* The KPI bar. It spanned the whole screen above the tab rail and the
            section rail; here it sits over the notebook whose numbers it
            reports. */}
        <TopHUD liveProjectionState={liveProjectionState} />
        <StageHeader isExpand={isExpand} onToggleExpand={onToggleExpand} />
        <div className="flex-1 min-h-0 flex flex-col">
          {viewMode === 'gallery'
            ? <NotebookGallery />
            : <NotebookCanvas recalc={liveProjectionState?.recalc} />}
        </div>
        {/* ADD-ON STRIP — the drag source, directly under the notebook it
            decorates. `shrink-0` so a long catalogue scrolls SIDEWAYS rather
            than growing downwards and eating the canvas's height. */}
        <div className="shrink-0 border-t border-border-soft bg-surface-2 px-2 py-1.5">
          <AddOnGallery recalc={liveProjectionState?.recalc} />
        </div>

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
      </section>
    </DndContext>
  );
}

/**
 * StageHeader — says WHICH notebook the stage is showing, and carries the one
 * control that acts on the layout as a whole.
 *
 * That control was a Focus/Shelf segmented pair. It is a single HIDE / SHOW
 * button now (owner, 2026-10-05): the rail is where the player works and the
 * canvas is what they are working ON, so the useful toggle is how much room
 * each gets — not which of two canvas renderings is drawn.
 *
 * The Details button that sat beside it is gone — that sheet is the MARKET
 * section now, not an overlay this column opens.
 */
function StageHeader({
  isExpand = true,
  onToggleExpand,
}: {
  isExpand?: boolean;
  onToggleExpand?: () => void;
}) {
  // The ACTIVE line, by id — never `productLines[0]` as the primary read. The
  // `??` tail is the no-selection fallback only, matching `useActiveLine` in
  // ProductPanel so the header and the rail can never name two different
  // notebooks.
  const line = useGame(
    (s) =>
      s.portfolio.productLines.find((l) => l.id === s.portfolio.activeLineId)
      ?? s.portfolio.productLines[0],
  );
  return (
    // `min-h`, not `h`: the two stacked lines here are `item-name` over `hint`,
    // both on the fluid type scale, and at a high resolution they are taller
    // than a fixed 48px box.
    <header className="shrink-0 min-h-[48px] flex items-center gap-2 px-2.5 py-1 border-b border-border-soft bg-surface-2">
      <div className="min-w-0 flex-1 flex flex-col justify-center">
        <span className="item-name text-text truncate leading-tight">
          {line?.name ?? 'No notebook selected'}
        </span>
        <span className="hint truncate leading-tight">
          {line ? archetypeLabel(line.productId) : 'Add one from the Notebook tab'}
        </span>
      </div>
      {/* HIDE collapses the section rail and gives the room to the canvas;
          SHOW brings it back. One button, two states — `isExpand` says which
          word it is currently offering, so the label is the ACTION, not the
          state it reports. */}
      <button
        type="button"
        onClick={() => { playSfx('click-soft'); onToggleExpand?.(); }}
        aria-expanded={isExpand}
        aria-controls="sim-scroll"
        className="shrink-0 pbtn ctl-btn px-2.5 h-[32px] eyebrow eyebrow-sm text-text-2 hover:text-text"
      >
        {isExpand ? 'Hide' : 'Show'}
      </button>
    </header>
  );
}

