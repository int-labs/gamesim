import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { PixelIcon } from '@/components/icons/PixelIcon';
import { playSfx } from '@/audio/audioManager';

export interface PixelSelectOption {
  id: string;
  label: string;
  /** Optional right-aligned hint (e.g. a cost/rate). */
  hint?: string;
}

/**
 * PixelSelect — the app's own dropdown, replacing the native <select>. A styled
 * button opens a body-portaled menu (so it's never clipped by drawer overflow),
 * flips UP when there isn't room below, closes on outside-click / Esc, and keeps
 * the pixel look. Keyboard: Enter/Space opens, arrows move, Enter picks, Esc closes.
 */
export function PixelSelect({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  value: string;
  options: PixelSelectOption[];
  onChange: (id: string) => void;
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [flipUp, setFlipUp] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();

  const current = options.find((o) => o.id === value) ?? options[0];

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setRect(r);
    // Flip up when the menu (≈ min(options, 6) rows) would overflow the viewport.
    const estH = Math.min(options.length, 6) * 40 + 8;
    setFlipUp(window.innerHeight - r.bottom < estH && r.top > estH);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (document.getElementById(menuId)?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = () => { place(); setOpen((v) => !v); };
  const pick = (id: string) => { if (id !== value) { playSfx('click-soft'); onChange(id); } setOpen(false); };

  return (
    <div className={clsx('relative', className)}>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={toggle}
        className={clsx(
          'w-full inline-flex items-center gap-2 px-2 py-1.5 border bg-surface text-text cursor-pointer body-xs transition-colors',
          open ? 'border-primary' : 'border-border-soft hover:border-border',
        )}
      >
        <span className="flex-1 min-w-0 text-left truncate">{current?.label}</span>
        <PixelIcon kind="chevron-down" size={10} color="var(--c-text-3)" />
      </button>

      {open && rect && createPortal(
        <div
          id={menuId}
          role="listbox"
          className="z-[130] panel-frame bg-surface border border-border shadow-[3px_3px_0_0_var(--c-shadow)] max-h-[240px] overflow-y-auto"
          style={{
            position: 'fixed',
            left: rect.left,
            width: rect.width,
            ...(flipUp ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
          }}
        >
          {options.map((o) => {
            const sel = o.id === value;
            return (
              <button
                key={o.id}
                role="option"
                aria-selected={sel}
                onClick={() => pick(o.id)}
                className={clsx(
                  'w-full flex items-center gap-2 px-2.5 py-2 text-left cursor-pointer border-b border-border-soft last:border-b-0 body-xs',
                  sel ? 'bg-primary-soft' : 'hover:bg-surface-2',
                )}
              >
                <span className="flex-1 min-w-0 truncate text-text">{o.label}</span>
                {o.hint && <span className="num-xs text-text-3 shrink-0">{o.hint}</span>}
                {sel && <PixelIcon kind="check" size={10} color="var(--c-primary)" />}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
