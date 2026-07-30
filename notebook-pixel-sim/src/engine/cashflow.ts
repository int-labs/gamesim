// Cash flow timing helpers.
// Implements working-capital timing inspired by the reference Excel:
// - Sales revenue is RECOGNISED (revenue ledger entry) on the day of sale,
//   but cash arrives DSO days later for credit-term channels.
// - Supplier payments default to immediate cash but a negotiated term can defer.
//
// This is the engine surface that teaches LP3: "you can have revenue and still
// run out of cash."

export interface PendingCash {
  id: string;
  day: number;       // calendar day when the amount lands in cash
  amount: number;    // signed: +inflow, -outflow
  source: string;    // human-readable cause: "sale-store", "supplier-payment"
}

let pcCounter = 0;
export function makePendingId(): string {
  pcCounter += 1;
  return `pc-${Date.now().toString(36)}-${pcCounter}`;
}

/** Pop and apply any pending cash whose `day` <= today. Returns total applied. */
export function drainCashSchedule(
  schedule: PendingCash[],
  today: number,
): { remaining: PendingCash[]; applied: number; entries: PendingCash[] } {
  const due: PendingCash[] = [];
  const remaining: PendingCash[] = [];
  for (const p of schedule) {
    if (p.day <= today) due.push(p);
    else remaining.push(p);
  }
  const applied = due.reduce((s, p) => s + p.amount, 0);
  return { remaining, applied, entries: due };
}

/** Compute receivables outstanding (positive cash not yet received). */
export function totalReceivables(schedule: PendingCash[]): number {
  return schedule.filter((p) => p.amount > 0).reduce((s, p) => s + p.amount, 0);
}

/** Compute payables outstanding (negative cash not yet sent). */
export function totalPayables(schedule: PendingCash[]): number {
  return Math.abs(schedule.filter((p) => p.amount < 0).reduce((s, p) => s + p.amount, 0));
}
