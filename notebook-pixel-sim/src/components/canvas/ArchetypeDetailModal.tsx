import { BuyerInterestTab, MarketDataTab } from './NotebookMarketTabs';

/**
 * THE MARKET SHEET — every chart for every notebook, one scroll, nothing to
 * select. It is the whole content of the rail's Market section.
 *
 * NO TABS AND NO RAIL. Reaching a chart used to mean picking a notebook from a
 * left rail AND then picking one of four lenses, so the market numbers a player
 * decides FROM sat two clicks deep. Owner, 2026-10-05: Product and Segments
 * out, every chart for every notebook on arrival, and nothing highlighted —
 * marking the player's own market would say the others matter less.
 *
 * ── IT IS NOT A MODAL, DESPITE THE NAME ─────────────────────────────────────
 * Stripped to this on 2026-10-13. The file carried three render paths and only
 * one caller, `SimulationScreen`'s `<ArchetypeDetailModal />`, so the other two
 * could never run:
 *
 *   `inline`  — the narrow-drawer column. The drawer was demolished in Block 4.
 *   default   — a `PixelModal` titled "Notebook Details", reachable only from
 *               the Details buttons the owner removed on 2026-10-05.
 *
 * Going with them: `ProductGallery`, `ProductIdentity`, `ProductCopy`,
 * `ProductStrengths`, `ProductWeakness`, `Card`, the `VIEWS` angle switcher and
 * the `open` / `onClose` / `inline` / `fill` / `hideViews` props. The strengths
 * and tradeoffs copy they rendered still lives on `ARCHETYPE_INFO`, which the
 * market cards read; nothing authored was lost.
 *
 * The filename is now a misnomer and the rename is the owner's call.
 */
export function ArchetypeDetailModal() {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex h-full min-h-0">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 bg-cream-50">
            <div className="grid grid-cols-1 gap-6">
              <BuyerInterestTab />
              <MarketDataTab />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
