import { useState, useEffect } from 'react';
import clsx from 'clsx';
import {
  BookOpen,
  Boxes,
  Factory,
  Megaphone,
  ReceiptText,
  Store,
} from 'lucide-react';
import type { MainPage } from '@/components/hud/MainNav';
import { PhaseActionBar } from '@/components/hud/PhaseActionBar';
import { BottomStats } from '@/components/hud/MetricsTable';
import { NavIcon } from '@/components/icons/NavIcon';
import { playSfx } from '@/audio/audioManager';
import { ProductStage } from '@/pages/ProductPage';
import { ProductLineList } from '@/components/panels/ProductLineList';
import { FinlitDesignControls } from '@/components/panels/FinlitDesignControls';
import { InventoryPanel } from '@/components/panels/InventoryPanel';
import { StudioPanel } from '@/components/panels/StudioPanel';
import { ArchetypeDetailModal } from '@/components/canvas/ArchetypeDetailModal';
import { useGame } from '@/state/store';
import { useLiveProjection, type LiveProjectionState } from '@/gamesim/useLiveProjection';
import {
  expandScript,
  SCRIPT_FIRST_PRODUCT_PAGE,
  SCRIPT_FIRST_BUSINESS_PAGE,
} from '@/content/mascotScripts';

/** Widest the rail may grow. The stage takes everything it leaves. */
const RAIL_MAX = '40vw';
/**
 * Flat fill behind the rail's sections — `cream-100`, the same paper tone the
 * HUD and the desk dressing are drawn in.
 *
 * The rail had no background of its own, so it showed `--c-bg`: the deep-walnut
 * SCENE colour, meant for the canvas, not for a column of forms.
 */
const RAIL_BG = '#F5EED8';

/**
 * Top-level layout for the playable run.
 *
 *   [TopHUD]
 *   [PageTabs — six sections]
 *   [rail (the active section)  |  stage (the notebook)]
 *   [footer compartment — PhaseActionBar]
 *
 * The rail is the page: every decision lives there and the stage beside it
 * never changes, so the notebook stays in view while the player works on it.
 */
export function SimulationScreen() {
  const [page, setPage] = useState<MainPage>('notebook');
  // Is the section rail showing? Local, like `page` — it is pure layout, it
  // must not survive a reload, and nothing outside this screen reads it. The
  // Hide / Show button lives in the stage header and toggles this.
  const [isExpand, setIsExpand] = useState(true);
  const pushMascotSequence = useGame((s) => s.pushMascotSequence);
  const liveProjectionState = useLiveProjection();

  // First-visit guidance scripts. Each script de-dupes via id, so once a
  // player has seen an intro it won't fire again — even across phase
  // transitions. The two scripts predate the six-section split; `notebook`
  // and `sales` are the nearest heirs of the old Product and Business pages.
  useEffect(() => {
    if (page === 'notebook') {
      pushMascotSequence(expandScript(SCRIPT_FIRST_PRODUCT_PAGE));
    } else if (page === 'sales') {
      pushMascotSequence(expandScript(SCRIPT_FIRST_BUSINESS_PAGE));
    }
  }, [page, pushMascotSequence]);

  // Cross-component navigation — listen for `intlabs:goto` events
  // dispatched by validation pills (e.g. PhaseActionBar's "Pick an
  // audience" warning chip) so any deep-linked nudge can move the
  // player to the right page without lifting state into the store.
  useEffect(() => {
    const onGoto = (e: Event) => {
      const detail = (e as CustomEvent).detail as { page?: MainPage } | undefined;
      if (detail?.page) setPage(detail.page);
    };
    window.addEventListener('intlabs:goto', onGoto);
    return () => window.removeEventListener('intlabs:goto', onGoto);
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* `TopHUD` MOVED into `ProductStage` on 2026-10-05 — it is the stage's
          own header now, over the notebook it reports on, rather than a bar
          spanning the tab rail and the section rail as well.

          `AmeliaReactions` was REMOVED here on 2026-09-14. Its three live
          reactions were scored off the obsolete local `vocFit` model, and the
          trigger is being redesigned with the wider UX pass. */}

      {/* ── BODY — tab rail | section rail | stage ───────────────────────── */}
      <div className="flex-1 min-h-0 flex">
        {/* The section switch. It was a horizontal row of labelled buttons
            above this body; six labels, two of them two words long, ran most
            of the way across the screen for a control the player uses a handful
            of times a round. On the edge it costs one icon's width. */}
        <PageTabs page={page} onChange={setPage} />

        {/* The rail holds every decision. Capped at RAIL_MAX so it stops
            growing on a wide screen and the stage takes the rest. It scrolls
            DOWN only: the sections inside are single-column grids, so content
            that does not fit the cap grows taller rather than wider. */}
        {/* UNMOUNTED when hidden, not just visually collapsed: a rail kept in
            the tree would keep its subscriptions live and keep re-rendering
            panels nobody can see. The sections hold no local state worth
            preserving across a hide — each reads the store. */}
        {isExpand && (
          <main
            id="sim-scroll"
            className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden border-r border-black/40"
            style={{ maxWidth: RAIL_MAX, backgroundColor: RAIL_BG, scrollPaddingTop: 16 }}
          >
            <PageRail page={page} liveProjectionState={liveProjectionState} />
          </main>
        )}

        {/* The notebook, on every section. Takes whatever the capped rail
            leaves — or the whole body once the rail is hidden. */}
        <ProductStage
          className="flex-1 min-w-0 min-h-0 flex flex-col bg-surface"
          liveProjectionState={liveProjectionState}
          isExpand={isExpand}
          onToggleExpand={() => setIsExpand((v) => !v)}
        />
      </div>

      {/* ── FOOTER COMPARTMENT ──────────────────────────────────────────────
          Spans the full width, under BOTH columns. `PhaseActionBar` is the only
          occupant today and carries the round-advance control; it is already
          `shrink-0`, so this region is the place further buttons go rather than
          a wrapper that re-does its layout.

          Same reason as AmeliaReactions above: the modal it opens shows the
          projected cash figure, which must be the SAME instance the HUD chip
          reads or the two disagree. */}
      <PhaseActionBar liveProjection={liveProjectionState.liveProjection} />
    </div>
  );
}

/**
 * PageRail — the active section's contents. ONE level of tabs: each of the six
 * is a set of decisions, not a container of further tabs.
 *
 * `p-3.5` is load-bearing on the padded branch: `ProductLineList`'s sticky
 * "Add Notebook" footer bleeds over it with `-mx-3.5 -mb-3.5`, inherited from
 * the drawer body it used to live in.
 *
 * MARKET is unpadded and `h-full` — `ArchetypeDetailModal` is a filled sheet
 * that owns its own rail, panel and scroll regions, so padding it would put a
 * scrollbar inside a scrollbar.
 */
function PageRail({
  page,
  liveProjectionState,
}: {
  page: MainPage;
  liveProjectionState: LiveProjectionState;
}) {
  const { liveProjection, recalc } = liveProjectionState;

  if (page === 'market') {
    return (
      <div className="h-full min-h-0 p-3.5">
        {/* `overflow-hidden` is safe HERE and nowhere else in this component —
            this sheet owns its own scroll regions. On the padded branch below
            it would make the section a scroll container and break
            ProductLineList's sticky "Add Notebook" footer, which needs the
            rail's own scroller to be its nearest one. */}
        <div className="h-full min-h-0 panel-frame panel-frame--lifted overflow-hidden">
          {/* No `onClose`: it is optional and only fires after "Switch to …",
              which still applies. This is a tab, not an overlay — there is
              nothing to close it back to. */}
          <ArchetypeDetailModal fill open />
        </div>
      </div>
    );
  }

  return (
    // `grid grid-cols-1` rather than a flex column: ONE section per row, each
    // taking the full track width and growing downwards. A flex row would let
    // siblings sit side by side and share a column the cap already made
    // narrow.
    <div className="grid grid-cols-1 p-3.5">
      {/* Each section is a LIFTED PANEL so it reads as a sheet laid on the
          cream rail rather than ink printed straight onto it.
          `panel-frame--lifted` casts straight DOWN (`0 3px 0`), never
          diagonally — in this codebase a diagonal cast means "pressable", and
          a section is a container.

          `p-3.5` on the panel, not the wrapper: ProductLineList's sticky "Add
          Notebook" footer bleeds over exactly that much with `-mx-3.5 -mb-3.5`. */}
      <section className="panel-frame panel-frame--lifted p-3.5">
      {page === 'notebook' && (
        <div className="grid grid-cols-1 gap-6">
          <ProductLineList />
          <FinlitDesignControls liveProjection={liveProjection} recalc={recalc} />
        </div>
      )}
      {page === 'financial' && <BottomStats liveProjectionState={liveProjectionState} />}
      {page === 'inventory' && <InventoryPanel liveProjection={liveProjection} recalc={recalc} />}
      {/* The two halves of StudioPanel. It stays ONE component behind a filter
          because the energy gate, the cash gate, the case-study modal and the
          reference sheet are shared by all four blocks. */}
      {page === 'capacity' && (
        <StudioPanel liveProjection={liveProjection} recalc={recalc} sections={['hiring', 'vendor']} />
      )}
      {page === 'sales' && (
        <StudioPanel liveProjection={liveProjection} recalc={recalc} sections={['channels', 'budget']} />
      )}
      </section>
    </div>
  );
}

/**
 * PageTabs — the section switch, a VERTICAL rail on the left edge.
 *
 * At rest each tab is its icon alone. On HOVER it becomes a RIBBON: the icon
 * box stays put and the title unrolls to the right of it. The ribbon is
 * ABSOLUTE, so it overlays the section rail instead of widening this one —
 * expanding in flow would reflow the whole page under the cursor, which is the
 * worst thing a hover can do.
 *
 * `title` + `aria-label` stay on the button regardless: the ribbon is a
 * pointer affordance, and a touch device or a screen reader never sees it.
 */
function PageTabs({ page, onChange }: { page: MainPage; onChange: (p: MainPage) => void }) {
  const TABS = [
    { id: 'market' as const, label: 'Market', icon: Store },
    { id: 'financial' as const, label: 'Financial', icon: ReceiptText },
    { id: 'notebook' as const, label: 'Notebook', icon: BookOpen },
    { id: 'inventory' as const, label: 'Inventory & Production', icon: Boxes },
    { id: 'capacity' as const, label: 'Capacity & RnD', icon: Factory },
    { id: 'sales' as const, label: 'Sales & Marketing', icon: Megaphone },
  ];
  return (
    <div
      role="tablist"
      aria-orientation="vertical"
      aria-label="Sections"
      className="shrink-0 w-[60px] flex flex-col items-center gap-1 py-2 bg-[#221710] border-r border-black/50"
    >
      {TABS.map((t) => {
        const active = page === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            // Kept even though the ribbon shows the title: the ribbon is a
            // POINTER affordance. A screen reader never sees it, and this is a
            // tablet tool where a large share of players have no hover at all.
            title={t.label}
            aria-label={t.label}
            onClick={() => { if (!active) playSfx('click-soft'); onChange(t.id); }}
            className={clsx(
              'group relative flex items-center transition-colors duration-150 active:scale-95 cursor-pointer',
              active ? 'text-cream-100' : 'text-[#D9B57A] hover:text-cream-100',
            )}
          >
            {/* ICON BOX — the only part that occupies rail width. */}
            <div
              className={clsx(
                'w-[48px] h-[48px] inline-flex items-center justify-center border transition-colors duration-150',
                active
                  ? 'bg-surface border-primary'
                  : 'border-transparent group-hover:bg-white/10',
              )}
            >
              <NavIcon icon={t.icon} size={24} color={active ? 'var(--c-primary)' : 'currentColor'} />
            </div>

            {/* RIBBON — unrolls to the RIGHT on hover, over the section rail.
                `pointer-events-none` so it can never sit between the cursor and
                whatever is underneath; the button already owns the click. */}
            {/* Cream, not the rail's near-black: the ribbon reads as a label
                laid ON the dark rail rather than more of the rail itself. Its
                text is ink, since the button's own colour is set for a dark
                ground and would be invisible here. */}
            <div
              aria-hidden
              className={clsx(
                'pointer-events-none absolute left-full top-0 h-[48px] z-50 flex items-center whitespace-nowrap',
                'border border-l-0 border-black/50 bg-cream-100 pr-4 pl-3 shadow-[2px_2px_0_0_rgba(0,0,0,0.35)]',
                'opacity-0 -translate-x-2 transition-[opacity,transform] duration-150',
                'group-hover:opacity-100 group-hover:translate-x-0',
              )}
            >
              <h4 className="eyebrow eyebrow-sm leading-none text-ink-900">{t.label}</h4>
            </div>
          </button>
        );
      })}
    </div>
  );
}
