import { useState } from 'react';
import { motion } from 'framer-motion';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useGame } from '@/state/store';
import { currentAddOns, placeAddOn, removeAddOn } from '@/engine/mockEngine';
import { addOnById } from '@/data/addOns';
import { playSfx } from '@/audio/audioManager';
import { A } from '@/assets';
import { NotebookCanvas } from '@/components/canvas/NotebookCanvas';
import { NotebookGallery } from '@/components/canvas/NotebookGallery';
import { ArchetypeDetailModal } from '@/components/canvas/ArchetypeDetailModal';
import { AddOnGallery } from '@/components/panels/ProductPanel';
import { FinlitDesignControls } from '@/components/panels/FinlitDesignControls';
import { ProductLineList } from '@/components/panels/ProductLineList';
import { EdgeDock, type DockItem } from '@/components/hud/EdgeDock';
import { Drawer } from '@/components/hud/Drawer';

/**
 * Product page — WIDE CANVAS shell.
 *
 *   [LEFT DOCK · inputs]  ·  ★ notebook canvas (hero) ★
 *
 * Left dock → Items / Design / Add-ons / Details (what you change); each icon
 * slides a drawer over the canvas without reflowing it. The numbers live in
 * the in-flow Stats & P&L tables BELOW the canvas (SimulationScreen renders
 * them; the canvas "Stats ↓" chip scrolls there). On phones the dock becomes
 * a bottom control bar.
 *
 * Add-ons are TOGGLES: tapping one in the drawer drops it onto the notebook at
 * its default slot (cosmetic only — no drag/resize, no score impact), so no
 * drag-and-drop context is needed here anymore.
 */
const LEFT_META: Record<string, { title: string; icon: string }> = {
  items: { title: 'Notebook Items', icon: A.ui.sidebar.product },
  design: { title: 'Design', icon: A.ui.config.notebook_type },
  addons: { title: 'Add-ons', icon: A.ui.sidebar.addons },
};

/**
 * `details` shares the left-drawer slot in state (the canvas/gallery Details
 * buttons still call `openDrawer('left', 'details')`) but renders as a
 * near-fullscreen modal rather than a 384px drawer — it's a reference sheet
 * with hero art, not a control panel.
 */
const DETAILS_ID = 'details';

export function ProductPage() {
  const leftDrawer = useGame((s) => s.ui.leftDrawer);
  const viewMode = useGame((s) => s.ui.viewMode);
  const toggleDrawer = useGame((s) => s.toggleDrawer);
  const closeDrawer = useGame((s) => s.closeDrawer);
  const lineCount = useGame((s) => s.portfolio.productLines.length);
  const addOnCount = useGame((s) => (s.portfolio.productLines.length ? currentAddOns(s).length : 0));
  const apply = useGame((s) => s.apply);
  const showToast = useGame((s) => s.showToast);

  // Dragging an add-on tile out of the drawer and onto the notebook.
  const [activeDrag, setActiveDrag] = useState<string | null>(null);
  // Keeps the drawer MOUNTED but invisible during a drag. Actually closing it
  // would unmount the drag source and dnd-kit would cancel the gesture.
  const [dragHiding, setDragHiding] = useState(false);
  // 4px before a press becomes a drag, so plain clicks still toggle the tile.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // No "Details" tile — the Details button in the top-right view controls
  // (both focus + shelf) already opens that drawer; a dock twin was redundant.
  const leftItems: DockItem[] = [
    { id: 'items', label: 'Items', icon: A.ui.sidebar.product, tip: 'Notebook Items - add & pick your notebooks', badge: lineCount || null },
    { id: 'design', label: 'Design', icon: A.ui.config.notebook_type, tip: 'Design - genre, spec, channels, price' },
    { id: 'addons', label: 'Add-ons', icon: A.ui.sidebar.addons, tip: 'Add-ons - toggle decorations on the notebook', badge: addOnCount || null },
  ];

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(ev) => {
        setActiveDrag((ev.active.data.current as { defId?: string } | undefined)?.defId ?? null);
        setDragHiding(true);
      }}
      onDragCancel={() => { setActiveDrag(null); setDragHiding(false); }}
      onDragEnd={(ev) => {
        const defId = (ev.active.data.current as { defId?: string } | undefined)?.defId;
        const overId = ev.over?.id;
        setActiveDrag(null);
        setDragHiding(false);
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
          closeDrawer('left');            // so the player SEES it land
          window.dispatchEvent(new CustomEvent('intlabs:burst', { detail: { x: 0.5, y: 0.5 } }));
        } else {
          // Post-swap the only remaining failure is the 3-add-on cap.
          showToast({ kind: 'warning', text: 'Max 3 add-ons. Remove one to add another.', ms: 1700 });
          playSfx('fail');
        }
      }}
    >
      {/* FULL-BLEED CANVAS REGION — the stage fills everything; docks FLOAT
          over its edges and drawers slide over it. `relative overflow-hidden`
          = positioning context for docks + drawers. */}
      <div className="relative flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col">
        {viewMode === 'gallery' ? <NotebookGallery /> : <NotebookCanvas />}
      </div>

      {/* Floating dock — inputs, left edge (bottom bar on phones). */}
      <EdgeDock
        side="left"
        items={leftItems}
        activeId={leftDrawer}
        onSelect={(id) => {
          playSfx(leftDrawer === id ? 'click-soft' : 'whoosh');
          toggleDrawer('left', id);
        }}
      />

      <Drawer
        side="left"
        open={!!leftDrawer && leftDrawer !== DETAILS_ID}
        title={leftDrawer ? LEFT_META[leftDrawer]?.title : ''}
        icon={leftDrawer ? LEFT_META[leftDrawer]?.icon : undefined}
        onClose={() => closeDrawer('left')}
        // Slide in BESIDE the floating dock (sm+) so the dock stays a live
        // tab rail; on phones the dock is a bottom bar → panel pads for it.
        stealth={dragHiding}
        panelOffsetClassName="left-0 sm:left-[104px]"
        bodyClassName="pb-[84px] sm:pb-3.5"
      >
        {/* Keyed fade so switching sections (Items → Design → …) while the
            drawer stays open reads as a smooth swap, not a hard cut. */}
        <motion.div
          key={leftDrawer}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.16, ease: [0.2, 1, 0.4, 1] }}
        >
          {leftDrawer === 'items' && <ProductLineList />}
          {leftDrawer === 'design' && <FinlitDesignControls />}
          {leftDrawer === 'addons' && <AddOnGallery />}
        </motion.div>
      </Drawer>

      <ArchetypeDetailModal
        open={leftDrawer === DETAILS_ID}
        onClose={() => closeDrawer('left')}
      />

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
