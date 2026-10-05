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
        <main
          id="sim-scroll"
          className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden border-r border-black/40"
          style={{ maxWidth: RAIL_MAX, scrollPaddingTop: 16 }}
        >
          <PageRail page={page} liveProjectionState={liveProjectionState} />
        </main>

        {/* The notebook, on every section. Takes whatever the capped rail
            leaves. */}
        <ProductStage
          className="flex-1 min-w-0 min-h-0 flex flex-col bg-surface"
          liveProjectionState={liveProjectionState}
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
      <div className="h-full min-h-0">
        {/* No `onClose`: it is optional and only fires after "Switch to …",
            which still applies. This is a tab, not an overlay — there is
            nothing to close it back to. */}
        <ArchetypeDetailModal fill open />
      </div>
    );
  }

  return (
    // `grid grid-cols-1` rather than a flex column: ONE section per row, each
    // taking the full track width and growing downwards. A flex row would let
    // siblings sit side by side and share a column the cap already made
    // narrow.
    <div className="grid grid-cols-1 p-3.5">
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
    </div>
  );
}

/**
 * PageTabs — the section switch, a VERTICAL rail of icons on the left edge.
 *
 * The labels are gone from the face of each button and live in `title` +
 * `aria-label`, so the control is still named for a screen reader and still
 * explains itself on hover. Same icons as the labelled row it replaces.
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
      className="shrink-0 w-[52px] flex flex-col items-center gap-1 py-2 bg-[#221710] border-r border-black/50"
    >
      {TABS.map((t) => {
        const active = page === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            // The label the face no longer carries. `title` for a pointer,
            // `aria-label` for a screen reader — an icon-only button with
            // neither is unnamed.
            title={t.label}
            aria-label={t.label}
            onClick={() => { if (!active) playSfx('click-soft'); onChange(t.id); }}
            className={clsx(
              'w-[40px] h-[40px] inline-flex items-center justify-center border transition-all duration-150 active:scale-95 cursor-pointer',
              active
                ? 'bg-surface border-primary'
                : 'border-transparent text-[#D9B57A] hover:bg-white/5 hover:text-cream-100',
            )}
          >
            <NavIcon icon={t.icon} size={18} color={active ? 'var(--c-primary)' : 'currentColor'} />
          </button>
        );
      })}
    </div>
  );
}
