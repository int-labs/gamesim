// The user projection — what the player expects this phase, as opposed to what
// the server recorded once the round was scored. Lives in `gamesim/` because it
// is a join: the player's own estimates from the Zustand store against the
// server's per-product projection (capacity and selling price).
//
// Kept out of `engine/` on purpose. The local engine models the simulation; this
// models the player's forecast, and the two must not be confused again.

import type { ProductProjectionDto } from './types';

/** What the "User Projection" section reports, rolled up across the portfolio. */
export interface UserProjectionTotals {
  /** Σ per-line price × min(demand estimate, that line's capacity). */
  revenue: number;
  /** Σ per-line produce target, which IS the player's demand estimate. */
  demand: number;
  /**
   * GROSS profit: revenue − COGS, where COGS is the same sellable units the
   * revenue was earned on × the server's unit cost. Null until a projection
   * supplies that unit cost.
   */
  profit: number | null;
}

/**
 * THE one place the user projection is computed. The top-bar chips and the
 * Portfolio sheet both call this, so a figure shown in the HUD and the same
 * figure shown in the section cannot drift — which is exactly what happened
 * while the chips ran the local FinLit engine and the section did not.
 *
 * Revenue clamps each line to its OWN capacity before summing: a shortfall on
 * one line cannot be covered by spare capacity on another, so summing first
 * would overstate the total. With no projection there is no known ceiling, so
 * the estimate stands unclamped rather than being read as zero capacity.
 *
 * Profit is GROSS profit — revenue − COGS — and stops there. It charges cost
 * against the same sellable units the revenue was earned on, so the two figures
 * can never describe different quantities of notebooks. Operating expenses are
 * NOT deducted: holding cost and period costs are the server's to compute, and
 * they belong to the actual result, not to a forecast the player can make from
 * their own inputs.
 *
 * `lines` and `byProduct` are index-aligned, which is the same assumption the
 * rest of the gamesim bridge makes about portfolio order.
 */
export function computeUserProjection(
  lines: Array<{ price: number; targetPerPhase?: number }>,
  byProduct: ProductProjectionDto[] | undefined,
): UserProjectionTotals {
  const bp = byProduct ?? [];
  let revenue = 0;
  let demand = 0;
  let profit = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const p = bp[i];
    // The produce target IS the player's demand estimate — there is no separate
    // estimate any more. Clamped by capacity, matching the server's
    // `produced = min(target, inventoryQty)`.
    const est = l.targetPerPhase ?? 0;
    const cap = p?.inventoryQty;
    const sellable = cap != null ? Math.min(est, cap) : est;
    const price = p?.sellingPrice ?? l.price;
    demand += est;
    revenue += price * sellable;
    // A line the server has not costed yet contributes no COGS, matching how a
    // missing unit cost is treated everywhere else in the display.
    profit += sellable * (price - (p?.dynamicCost ?? 0));
  }
  return { revenue, demand, profit: bp.length ? profit : null };
}
