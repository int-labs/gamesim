import { useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useGame } from '@/state/store';
import { currentAddOns, placeAddOn, removeAddOn, archetypeLabel } from '@/engine/mockEngine';
import { addOnById } from '@/data/addOns';
import { playSfx } from '@/audio/audioManager';
import { NotebookCanvas } from '@/components/canvas/NotebookCanvas';
import { NotebookGallery } from '@/components/canvas/NotebookGallery';
import { AddOnGallery } from '@/components/panels/ProductPanel';
import { ViewToggle } from '@/components/canvas/ViewToggle';
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
}: {
  className?: string;
  style?: React.CSSProperties;
  /** For `TopHUD`, which is this column's header since 2026-10-05. */
  liveProjectionState?: LiveProjectionState;
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
        <StageHeader />
        <div className="flex-1 min-h-0 flex flex-col">
          {viewMode === 'gallery' ? <NotebookGallery /> : <NotebookCanvas />}
        </div>
        {/* ADD-ON STRIP — the drag source, directly under the notebook it
            decorates. `shrink-0` so a long catalogue scrolls SIDEWAYS rather
            than growing downwards and eating the canvas's height. */}
        <div className="shrink-0 border-t border-border-soft bg-surface-2 px-2 py-1.5">
          <AddOnGallery />
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
 * control that acts on the stage as a whole.
 *
 * Focus/Shelf was a floating strip pinned over the canvas's top-right corner,
 * which is why it had to be hoisted out of the two canvas components to
 * survive the empty-portfolio case. In a header row it is simply in the
 * layout: unconditional by construction, with nothing to overlap.
 *
 * The Details button that sat beside it is gone — that sheet is the MARKET tab
 * now, not an overlay this column opens.
 */
function StageHeader() {
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
    <header className="shrink-0 h-[48px] flex items-center gap-2 px-2.5 border-b border-border-soft bg-surface-2">
      <div className="min-w-0 flex-1 flex flex-col justify-center">
        <span className="item-name text-text truncate leading-tight">
          {line?.name ?? 'No notebook selected'}
        </span>
        <span className="hint truncate leading-tight">
          {line ? archetypeLabel(line.productId) : 'Add one from the Notebook tab'}
        </span>
      </div>
      <div className="shrink-0">
        <ViewToggle />
      </div>
    </header>
  );
}

