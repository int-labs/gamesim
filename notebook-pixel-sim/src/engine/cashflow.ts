// Cash flow timing types.
//
// This was the working-capital layer: pending cash was scheduled on a future
// day, `drainCashSchedule` popped whatever was due each tick, and `makePendingId`
// tagged the rows. There is no tick, and nothing has written a `PendingCash`
// row since the day loop was removed — so the scheduler, the id generator and
// the payables total were declarations with no reader and are gone.
//
// `PendingCash` stays because `GameState.cashSchedule` is still persisted with
// that shape, and `totalReceivables` stays because `scoring.ts` reads it.

export interface PendingCash {
  id: string;
  day: number;       // calendar day when the amount lands in cash
  amount: number;    // signed: +inflow, -outflow
  source: string;    // human-readable cause: "sale-store", "supplier-payment"
}

/** Compute receivables outstanding (positive cash not yet received). */
export function totalReceivables(schedule: PendingCash[]): number {
  return schedule.filter((p) => p.amount > 0).reduce((s, p) => s + p.amount, 0);
}
