/**
 * The numbers behind a debrief.
 *
 * A debrief that is only prose asks a room to take the facilitator's word for
 * it. These derivations turn the same claims into something a team can check
 * against their own run — which is the difference between being told a lesson
 * and seeing it.
 *
 * ── WHERE THE DATA ACTUALLY LIVES ───────────────────────────────────────────
 * `Projection.pnl` / `.bizperf` / `.cashflow` / `.balanceSheet` are all NULL in
 * practice — the round-close writes per-product numbers into
 * `projections.<productId>` instead. So every money figure here is aggregated
 * across a team's products rather than read from a top-level total, and a
 * chart built against `pnl` would silently render nothing.
 *
 * `Results` is the other half: `weightedScores` and `marketShares` keyed by
 * teamId, per product × segment × round.
 */

export interface TeamRef {
  _id: string;
  teamName: string;
  avatar?: { url?: string } | null;
}

/** One team's aggregated money for one round. */
export interface RoundMoney {
  roundNumber: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  customers: number;
}

export interface TeamMoney {
  teamId: string;
  teamName: string;
  avatarUrl?: string | null;
  byRound: RoundMoney[];
  revenue: number;
  cogs: number;
  grossProfit: number;
  customers: number;
  /** Gross profit as a share of revenue. 0 when a team made no revenue. */
  margin: number;
}

const n = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * Aggregate every team's per-product projections into per-round money.
 *
 * Teams with no projections at all are omitted rather than charted as zeroes —
 * a flat line at the bottom reads as "this team earned nothing", which is a
 * different and much harsher claim than "this team has no scored round yet".
 */
export function cohortMoney(projections: any[], teams: TeamRef[]): TeamMoney[] {
  const nameOf = new Map(teams.map((t) => [String(t._id), t.teamName]));
  const avatarOf = new Map(teams.map((t) => [String(t._id), t.avatar?.url ?? null]));
  const byTeam = new Map<string, Map<number, RoundMoney>>();

  for (const p of projections) {
    const teamId = String(p?.teamId ?? "");
    if (!teamId) continue;
    const round = n(p.roundNumber);

    const rounds = byTeam.get(teamId) ?? new Map<number, RoundMoney>();
    const acc: RoundMoney =
      rounds.get(round) ?? { roundNumber: round, revenue: 0, cogs: 0, grossProfit: 0, customers: 0 };

    // `projections` is a map keyed by productId — one entry per product the
    // team sells, each carrying that product's own revenue/COGS.
    for (const line of Object.values(p?.projections ?? {}) as any[]) {
      acc.revenue += n(line?.revenue);
      acc.cogs += n(line?.COGS);
      acc.grossProfit += n(line?.grossProfit);
      acc.customers += n(line?.customersObtained);
    }

    rounds.set(round, acc);
    byTeam.set(teamId, rounds);
  }

  return [...byTeam.entries()]
    .map(([teamId, rounds]) => {
      const byRound = [...rounds.values()].sort((a, b) => a.roundNumber - b.roundNumber);
      const revenue = byRound.reduce((s, r) => s + r.revenue, 0);
      const cogs = byRound.reduce((s, r) => s + r.cogs, 0);
      const grossProfit = byRound.reduce((s, r) => s + r.grossProfit, 0);
      const customers = byRound.reduce((s, r) => s + r.customers, 0);
      return {
        teamId,
        teamName: nameOf.get(teamId) ?? `Team ${teamId.slice(-6)}`,
        avatarUrl: avatarOf.get(teamId),
        byRound,
        revenue,
        cogs,
        grossProfit,
        customers,
        margin: revenue > 0 ? grossProfit / revenue : 0,
      };
    })
    .sort((a, b) => b.grossProfit - a.grossProfit);
}

export interface StrengthPoint {
  roundNumber: number;
  /** Averaged competed strength — see the caveat below. */
  value: number;
  rank: number;
}

export interface TeamStrength {
  teamId: string;
  teamName: string;
  points: StrengthPoint[];
}

/**
 * Each team's competed strength per round, and where that put them.
 *
 * ── NOT A MARKET SHARE ──────────────────────────────────────────────────────
 * `marketShares` does not partition the market: the engine multiplies a team's
 * competed share by the share that team itself declared, so a twelve-team
 * round sums to well over 100%. The values RANK correctly, which is all a
 * standings chart needs — but nothing here may be labelled a percentage of the
 * market, because an operator will repeat that to a room.
 */
export function cohortStrength(results: any[], teams: TeamRef[]): TeamStrength[] {
  const nameOf = new Map(teams.map((t) => [String(t._id), t.teamName]));
  const perRound = new Map<number, Map<string, { sum: number; n: number }>>();

  for (const r of results) {
    const round = n(r?.roundNumber);
    const bucket = perRound.get(round) ?? new Map();
    for (const [teamId, share] of Object.entries(r?.marketShares ?? {})) {
      const cur = bucket.get(teamId) ?? { sum: 0, n: 0 };
      cur.sum += n(share);
      cur.n += 1;
      bucket.set(teamId, cur);
    }
    perRound.set(round, bucket);
  }

  // Rank within each round first, so a team's line carries its position.
  const rankByRound = new Map<number, Map<string, number>>();
  for (const [round, bucket] of perRound) {
    const ordered = [...bucket.entries()]
      .map(([teamId, v]) => ({ teamId, value: v.n ? v.sum / v.n : 0 }))
      .sort((a, b) => b.value - a.value);
    rankByRound.set(round, new Map(ordered.map((o, i) => [o.teamId, i + 1])));
  }

  const teamIds = new Set<string>();
  for (const bucket of perRound.values()) for (const id of bucket.keys()) teamIds.add(id);

  return [...teamIds]
    .map((teamId) => ({
      teamId,
      teamName: nameOf.get(teamId) ?? `Team ${teamId.slice(-6)}`,
      points: [...perRound.entries()]
        .sort(([a], [b]) => a - b)
        .flatMap(([round, bucket]) => {
          const v = bucket.get(teamId);
          if (!v) return [];
          return [
            {
              roundNumber: round,
              value: v.n ? v.sum / v.n : 0,
              rank: rankByRound.get(round)?.get(teamId) ?? 0,
            },
          ];
        }),
    }))
    .filter((t) => t.points.length > 0)
    .sort((a, b) => (a.points.at(-1)?.rank ?? 99) - (b.points.at(-1)?.rank ?? 99));
}

/**
 * The one line a facilitator opens the debrief with.
 *
 * Deliberately about the SPREAD rather than the winner: "the top team earned
 * X" is a fact about one team, while "the same revenue produced twice the
 * profit" is the lesson the whole room is there for.
 */
export function headlineSpread(money: TeamMoney[]): {
  bestMargin?: TeamMoney;
  worstMargin?: TeamMoney;
  /** Two teams whose revenue is closest, to contrast what they kept. */
  comparable?: [TeamMoney, TeamMoney];
} {
  const scored = money.filter((m) => m.revenue > 0);
  if (scored.length < 2) return {};

  const byMargin = [...scored].sort((a, b) => b.margin - a.margin);

  let comparable: [TeamMoney, TeamMoney] | undefined;
  let closest = Infinity;
  for (let i = 0; i < scored.length; i++) {
    for (let j = i + 1; j < scored.length; j++) {
      const a = scored[i];
      const b = scored[j];
      const revGap = Math.abs(a.revenue - b.revenue) / Math.max(a.revenue, b.revenue);
      const marginGap = Math.abs(a.margin - b.margin);
      // Similar revenue, different margin — that pair IS the lesson.
      if (revGap < 0.15 && marginGap > 0.05 && revGap < closest) {
        closest = revGap;
        comparable = a.margin > b.margin ? [a, b] : [b, a];
      }
    }
  }

  return { bestMargin: byMargin[0], worstMargin: byMargin.at(-1), comparable };
}


/**
 * Is the cohort's revenue structurally zero?
 *
 * `calcFinancials` derives a reference price (`dynamicPrice`) by summing the
 * product's money fields with `direction > 0`, EXCLUDING `selling_price`. With
 * no such field there is nothing to judge the selling price against, so
 * `calcPricingScore` returns 0 → no customers → no revenue — while COGS is
 * still charged. Every team then posts a pure loss no matter what they did.
 *
 * That is a misconfigured product, not twelve bad teams, and a facilitator
 * looking at "-$40,000" needs to be told which. Detecting it from the OUTPUT
 * (revenue zero everywhere while costs are real) keeps this honest even if the
 * cause later changes.
 */
export function revenueLooksMisconfigured(money: TeamMoney[]): boolean {
  if (money.length < 2) return false;
  const anyCost = money.some((m) => m.cogs > 0);
  const allZeroRevenue = money.every((m) => m.revenue === 0);
  return anyCost && allZeroRevenue;
}
