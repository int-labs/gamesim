import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { ADDONS } from '@/data/addOns';
import { PLACEMENT_BOUNDS } from '@/data/addOnDefaults';
import { useGame } from '@/state/store';
import { updateAddOnPlacement, resetAddOnPlacement, removeAddOn } from '@/engine/mockEngine';
import type { AddOnInstance } from '@/types';
import { PixelIcon } from '@/components/icons/PixelIcon';
import { Tooltip } from '@/components/primitives/Tooltip';

interface Props {
  addOns: AddOnInstance[];
  /** Optional remove hook — kept for prop compatibility with old callers. */
  onRemove?: (instId: string) => void;
}

/**
 * Free-canvas add-on editor.
 *
 * Layer is sized to the NOTEBOOK'S OWN FOOTPRINT (its `absolute inset-0`
 * fills the notebook box it is mounted in — see NotebookCanvas), so
 * coordinates + scale are relative to the notebook, not the whole stage: a
 * charm at x:0.78 sits on the notebook's top-right, and scale:0.18 is 18% of
 * the notebook. Normalized 0..1, clamped to PLACEMENT_BOUNDS so nothing
 * wanders off. The layer rides the notebook's bob/tilt, so add-ons read as
 * stuck ON it.
 *
 * Interactions:
 *   - Click empty stage → deselect
 *   - Click an add-on → select (dashed outline + 4 corner handles + toolbar)
 *   - Drag add-on body → move (clamped to canvas)
 *   - Drag a corner handle → resize aspect-locked
 *       Resize math is distance-from-center based, so dragging OUTWARD
 *       always grows and INWARD always shrinks, regardless of corner.
 *   - Toolbar: Reset · Send back · Bring forward · Remove · ✓ Done
 *   - State commits live during the drag; Done is just an explicit
 *     "deselect" affordance.
 */
export function AddOnLayer({ addOns }: Props) {
  const apply = useGame((s) => s.apply);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  type PointerMode =
    | { kind: 'idle' }
    | { kind: 'drag'; instId: string; startX: number; startY: number; origX: number; origY: number }
    | { kind: 'resize'; instId: string; centerX: number; centerY: number; origDist: number; origScale: number };

  const [pointer, setPointer] = useState<PointerMode>({ kind: 'idle' });

  // Order by zIndex so the painter draws low-z first, high-z last.
  const ordered = [...addOns].sort((a, b) => (a.zIndex ?? 1) - (b.zIndex ?? 1));

  // Drop selection if the selected instance disappears (line/archetype change).
  useEffect(() => {
    if (selectedId && !addOns.find((a) => a.id === selectedId)) setSelectedId(null);
  }, [addOns, selectedId]);

  // Pointer move/up listeners attached at window-level so the gesture
  // continues even if the cursor leaves the stage during a drag/resize.
  useEffect(() => {
    if (pointer.kind === 'idle') return;
    const onMove = (e: PointerEvent) => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      if (pointer.kind === 'drag') {
        const dx = (e.clientX - pointer.startX) / Math.max(1, rect.width);
        const dy = (e.clientY - pointer.startY) / Math.max(1, rect.height);
        apply((s) => updateAddOnPlacement(s, pointer.instId, {
          x: pointer.origX + dx,
          y: pointer.origY + dy,
        }));
      } else if (pointer.kind === 'resize') {
        // Distance-from-center model: how far is the cursor now vs. when
        // the resize gesture began? Ratio applied to original scale gives
        // intuitive outward-grows / inward-shrinks behaviour.
        const dx = e.clientX - pointer.centerX;
        const dy = e.clientY - pointer.centerY;
        const dist = Math.hypot(dx, dy);
        if (pointer.origDist <= 1) return;
        const ratio = dist / pointer.origDist;
        const newScale = pointer.origScale * ratio;
        apply((s) => updateAddOnPlacement(s, pointer.instId, { scale: newScale }));
      }
    };
    const onUp = () => setPointer({ kind: 'idle' });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [pointer, apply]);

  // Re-clamp every selected add-on after window resize so a layout change
  // can't push a sprite off-canvas. The engine already clamps every write,
  // but on resize the rendered position might drift if the layer changes
  // shape — touching x/y triggers the clamp.
  useEffect(() => {
    const onResize = () => {
      for (const inst of addOns) {
        apply((s) => updateAddOnPlacement(s, inst.id, { x: inst.x, y: inst.y, scale: inst.scale }));
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [addOns, apply]);

  const beginDrag = (e: React.PointerEvent, inst: AddOnInstance) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(inst.id);
    setPointer({
      kind: 'drag',
      instId: inst.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: inst.x,
      origY: inst.y,
    });
  };

  const beginResize = (e: React.PointerEvent, inst: AddOnInstance, el: HTMLElement) => {
    e.preventDefault();
    e.stopPropagation();
    // Use the rendered object's center as the resize pivot. Distance from
    // pointer to that center grows when dragged outward, shrinks when
    // dragged inward — so the gesture always feels right regardless of
    // which corner is grabbed.
    const r = el.getBoundingClientRect();
    const centerX = r.left + r.width / 2;
    const centerY = r.top + r.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const origDist = Math.max(1, Math.hypot(dx, dy));
    setSelectedId(inst.id);
    setPointer({
      kind: 'resize',
      instId: inst.id,
      centerX,
      centerY,
      origDist,
      origScale: inst.scale,
    });
  };

  const onStagePointerDown = (e: React.PointerEvent) => {
    // Only deselect when the user clicks the empty stage (not an add-on
    // child or its handles/toolbar). target === currentTarget is the
    // standard guard for "the click landed on this element directly".
    if (e.target === e.currentTarget) {
      setSelectedId(null);
    }
  };

  const bringForward = (instId: string, current: number) =>
    apply((s) => updateAddOnPlacement(s, instId, { zIndex: Math.min(9, current + 1) }));
  const sendBackward = (instId: string, current: number) =>
    apply((s) => updateAddOnPlacement(s, instId, { zIndex: Math.max(1, current - 1) }));
  const reset = (instId: string) => apply((s) => resetAddOnPlacement(s, instId));
  const remove = (instId: string) => {
    setSelectedId((cur) => (cur === instId ? null : cur));
    apply((s) => removeAddOn(s, instId));
  };
  const done = () => setSelectedId(null);

  return (
    <div
      ref={stageRef}
      onPointerDown={onStagePointerDown}
      className="absolute inset-0 select-none"
      style={{ touchAction: 'none' }}
    >
      <AnimatePresence>
        {ordered.map((inst) => {
          const def = ADDONS.find((d) => d.id === inst.defId);
          if (!def) return null;
          const isSelected = selectedId === inst.id;
          const z = Math.min(9, Math.max(1, inst.zIndex ?? 5));
          return (
            <AddOnObject
              key={inst.id}
              inst={inst}
              imgSrc={def.imgPath}
              imgAlt={def.name}
              isSelected={isSelected}
              z={z}
              onPointerDown={(e) => beginDrag(e, inst)}
              onResizeStart={(e, el) => beginResize(e, inst, el)}
              onSendBackward={() => sendBackward(inst.id, z)}
              onBringForward={() => bringForward(inst.id, z)}
              onScaleStep={(by) =>
                // Read scale from live state (not the closure), so rapid
                // successive clicks of +/- compound correctly. Closure-
                // captured `inst.scale` would stale-batch updates and only
                // step once per render.
                apply((s) => {
                  const ln = s.portfolio.productLines.find((l) => l.id === s.portfolio.activeLineId);
                  if (!ln) return;
                  const cur = ln.addOnsByArchetype[ln.archetype]?.find((a) => a.id === inst.id)?.scale ?? inst.scale;
                  updateAddOnPlacement(s, inst.id, { scale: cur + by });
                })
              }
              onRotateStep={(by) =>
                // Same live-state pattern as scale — rotation is the
                // sum of past clicks, not the closure value.
                apply((s) => {
                  const ln = s.portfolio.productLines.find((l) => l.id === s.portfolio.activeLineId);
                  if (!ln) return;
                  const cur = ln.addOnsByArchetype[ln.archetype]?.find((a) => a.id === inst.id)?.rotation ?? inst.rotation ?? 0;
                  // Wrap into [-180, 180) so the value stays sane after
                  // many clicks.
                  let next = cur + by;
                  while (next > 180) next -= 360;
                  while (next <= -180) next += 360;
                  updateAddOnPlacement(s, inst.id, { rotation: next });
                })
              }
              onReset={() => reset(inst.id)}
              onRemove={() => remove(inst.id)}
              onDone={done}
              dragging={pointer.kind === 'drag' && pointer.instId === inst.id}
            />
          );
        })}
      </AnimatePresence>

      {/* Bounds guide while dragging/resizing — faint dashed rectangle
          showing the safe-area inside which add-ons are clamped. */}
      {pointer.kind !== 'idle' && (
        <div
          aria-hidden
          className="absolute pointer-events-none border border-dashed"
          style={{
            left: `${PLACEMENT_BOUNDS.xMin * 100}%`,
            top: `${PLACEMENT_BOUNDS.yMin * 100}%`,
            right: `${(1 - PLACEMENT_BOUNDS.xMax) * 100}%`,
            bottom: `${(1 - PLACEMENT_BOUNDS.yMax) * 100}%`,
            borderColor: 'rgba(0,0,0,0.18)',
          }}
        />
      )}
    </div>
  );
}

// ---- One add-on object on the canvas ------------------------------------

interface ObjectProps {
  inst: AddOnInstance;
  imgSrc: string;
  imgAlt: string;
  isSelected: boolean;
  z: number;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onResizeStart: (e: React.PointerEvent, el: HTMLElement) => void;
  onSendBackward: () => void;
  onBringForward: () => void;
  onScaleStep: (by: number) => void;
  onRotateStep: (byDeg: number) => void;
  onReset: () => void;
  onRemove: () => void;
  onDone: () => void;
}

function AddOnObject({
  inst,
  imgSrc,
  imgAlt,
  isSelected,
  z,
  dragging,
  onPointerDown,
  onResizeStart,
  onSendBackward,
  onBringForward,
  onScaleStep,
  onRotateStep,
  onReset,
  onRemove,
  onDone,
}: ObjectProps) {
  const objRef = useRef<HTMLDivElement | null>(null);
  return (
    <motion.div
      ref={objRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: [0.2, 1.4, 0.4, 1] }}
      onPointerDown={onPointerDown}
      className="absolute select-none"
      // OUTER layer owns position + scale via raw CSS. Framer-motion
      // is restricted to opacity (entry/exit) so it doesn't clobber
      // the inline transform with its own translate/scale matrix.
      // Rotation lives on an INNER wrapper — see below — so it
      // renders independently of motion's animation pipeline.
      style={{
        left: `${inst.x * 100}%`,
        top: `${inst.y * 100}%`,
        width: `${inst.scale * 100}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: z,
        cursor: dragging ? 'grabbing' : 'grab',
      }}
    >
      {/* Inner wrapper holds the rotation. Separate from the outer
          motion layer so motion's animations can't override it. */}
      <div
        className="w-full h-full"
        style={{
          transform: `rotate(${inst.rotation ?? 0}deg)`,
          transformOrigin: 'center center',
          transition: 'transform 80ms ease-out',
        }}
      >
      <img
        src={imgSrc}
        alt={imgAlt}
        className="w-full h-auto object-contain pointer-events-none"
        style={{ filter: 'drop-shadow(1px 2px 0 rgba(42,32,23,0.28))', imageRendering: 'pixelated' }}
        draggable={false}
      />

      {/* Selection ring + handles — INSIDE the rotation div so they
          stay aligned with the rotated image's corners. */}
      {isSelected && (
        <>
          <div
            aria-hidden
            className="absolute inset-[-6px] border-2 border-dashed pointer-events-none"
            style={{ borderColor: 'var(--c-primary)' }}
          />
          <ResizeHandle
            position="tl"
            onDown={(e) => objRef.current && onResizeStart(e, objRef.current)}
          />
          <ResizeHandle
            position="tr"
            onDown={(e) => objRef.current && onResizeStart(e, objRef.current)}
          />
          <ResizeHandle
            position="bl"
            onDown={(e) => objRef.current && onResizeStart(e, objRef.current)}
          />
          <ResizeHandle
            position="br"
            onDown={(e) => objRef.current && onResizeStart(e, objRef.current)}
          />
        </>
      )}
      </div>

      {/* Floating toolbar — sibling to the rotation div, so it stays
          horizontal regardless of the image's rotation. */}
      {isSelected && (
        <>
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute left-1/2 -translate-x-1/2 -top-10 flex items-center gap-0.5 bg-surface border-2 border-border shadow-[2px_2px_0_0_var(--c-shadow)] px-1 py-0.5"
          >
            <ToolBtn title="Smaller" onClick={() => onScaleStep(-0.05)} disabled={inst.scale <= 0.10 + 0.001} icon={<PixelIcon kind="minus" size={10} />} />
            <ToolBtn title="Larger" onClick={() => onScaleStep(+0.05)} disabled={inst.scale >= 0.90 - 0.001} icon={<PixelIcon kind="plus" size={10} />} />
            <Divider />
            <ToolBtn
              title="Rotate left (15°)"
              onClick={() => onRotateStep(-15)}
              icon={<PixelIcon kind="rotate-ccw" size={10} />}
            />
            <ToolBtn
              title="Rotate right (15°)"
              onClick={() => onRotateStep(+15)}
              icon={<PixelIcon kind="rotate-cw" size={10} />}
            />
            <Divider />
            <ToolBtn title="Reset placement (recenter + reset scale/rotation)" onClick={onReset} icon={<PixelIcon kind="crosshair" size={10} />} />
            <ToolBtn title="Send backward (lower z-index)" onClick={onSendBackward} disabled={z <= 1} icon={<PixelIcon kind="send-back" size={11} />} />
            <ToolBtn title="Bring forward (raise z-index)" onClick={onBringForward} disabled={z >= 9} icon={<PixelIcon kind="bring-front" size={11} />} />
            <Divider />
            <ToolBtn title="Remove this add-on" onClick={onRemove} tone="danger" icon={<PixelIcon kind="trash" size={10} color="var(--c-danger)" />} />
            <ToolBtn title="Done - deselect this add-on" onClick={onDone} tone="primary" icon={<PixelIcon kind="check" size={10} color="#0F2A19" />} />
          </div>
        </>
      )}
    </motion.div>
  );
}

function ResizeHandle({
  position,
  onDown,
}: {
  position: 'tl' | 'tr' | 'bl' | 'br';
  onDown: (e: React.PointerEvent) => void;
}) {
  // Touch devices (`pointer: coarse`) get a larger 22px handle so it's
  // easy to grab with a finger. Desktop keeps the slim 12px handle.
  const cls =
    position === 'tl' ? 'left-[-7px] top-[-7px] cursor-nwse-resize' :
    position === 'tr' ? 'right-[-7px] top-[-7px] cursor-nesw-resize' :
    position === 'bl' ? 'left-[-7px] bottom-[-7px] cursor-nesw-resize' :
                        'right-[-7px] bottom-[-7px] cursor-nwse-resize';
  return (
    <button
      type="button"
      onPointerDown={onDown}
      className={clsx(
        'absolute bg-surface border-2 border-border z-10',
        'w-3 h-3 [@media(pointer:coarse)]:w-[22px] [@media(pointer:coarse)]:h-[22px]',
        cls,
      )}
      style={{ touchAction: 'none' }}
      aria-label={`Resize ${position}`}
    />
  );
}

function ToolBtn({
  icon,
  title,
  onClick,
  disabled,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'danger' | 'primary';
}) {
  return (
    <Tooltip content={title} placement="top">
    <button
      type="button"
      onClick={onClick}
      aria-label={title}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center justify-center w-6 h-6 btn-label-sm cursor-pointer',
        'hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed',
        tone === 'danger' && 'text-danger hover:bg-danger-soft',
        tone === 'primary' && 'bg-primary hover:brightness-110',
      )}
      style={tone === 'primary' ? { color: '#0F2A19' } : undefined}
    >
      {icon}
    </button>
    </Tooltip>
  );
}

function Divider() {
  return <div aria-hidden className="w-px h-4 bg-border-soft mx-0.5" />;
}
