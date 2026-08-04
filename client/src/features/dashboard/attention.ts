/**
 * What actually needs the operator right now.
 *
 * The old dashboard led with inventory counts — "Users 4", "Rounds 2" — which
 * answer a question nobody running a room is asking. These items answer the
 * only two that matter mid-session: *is anything blocking me* and *what do I
 * press next*. Each one is derived from live data, states the consequence, and
 * carries the action that resolves it.
 */

export type Severity = "blocked" | "action" | "warning" | "info";

export interface AttentionItem {
  id: string;
  severity: Severity;
  title: string;
  /** One sentence on why it matters — never a restatement of the title. */
  detail: string;
  actionLabel?: string;
  to?: string;
  /** Set when the action is a mutation rather than navigation. */
  action?: "endRound" | "activateRound";
}

const SEVERITY_ORDER: Record<Severity, number> = { blocked: 0, action: 1, warning: 2, info: 3 };

export interface AttentionInput {
  simulationId: string | null;
  rounds: any[];
  teams: any[];
  decisions: any[];
  /** Teams whose passkey user is missing — they cannot sign in at all. */
  teamsWithoutLogin: number;
  playerConfig?: { status?: string; version?: number } | null;
  storage?: { durable?: boolean } | null;
  products: any[];
  baseDataMissing: boolean;
}

export function buildAttention(input: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];
  const {
    rounds, teams, decisions, teamsWithoutLogin, playerConfig, storage, products, baseDataMissing,
  } = input;

  const byNumber = [...rounds].sort((a, b) => b.roundNumber - a.roundNumber);
  const active = byNumber.find((r) => r.status === "Active");
  const pending = [...rounds].sort((a, b) => a.roundNumber - b.roundNumber).find((r) => r.status === "Pending");

  // ── Blocking setup ────────────────────────────────────────────────────
  if (products.length === 0) {
    items.push({
      id: "no-products",
      severity: "blocked",
      title: "This simulation type has no products",
      detail: "Products define the decision form. Teams have nothing to submit until at least one exists.",
      actionLabel: "Add a product",
      to: "/products",
    });
  }
  if (baseDataMissing) {
    items.push({
      id: "no-base-data",
      severity: "blocked",
      title: "No base data for this simulation type",
      detail: "Market sizes and the scoring model live here. A round cannot be scored without them.",
      actionLabel: "Open base data",
      to: "/base-data",
    });
  }
  if (teams.length === 0) {
    items.push({
      id: "no-teams",
      severity: "blocked",
      title: "No teams in this simulation",
      detail: "Add the teams before opening a round, so everyone has a pass key when the session starts.",
      actionLabel: "Add teams",
      to: "/teams",
    });
  }
  if (teamsWithoutLogin > 0) {
    items.push({
      id: "teams-no-login",
      severity: "blocked",
      title: `${teamsWithoutLogin} team${teamsWithoutLogin === 1 ? "" : "s"} cannot sign in`,
      detail: "A team needs a pass key user to reach the player app. Without one they are locked out of the session.",
      actionLabel: "Fix logins",
      to: "/teams",
    });
  }

  // ── The live round ────────────────────────────────────────────────────
  if (active) {
    const submitted = new Set(
      decisions.filter((d) => d.roundNumber === active.roundNumber).map((d) => String(d.teamId))
    );
    const missing = teams.filter((t) => !submitted.has(String(t._id)));

    if (teams.length > 0 && missing.length === 0) {
      items.push({
        id: "round-ready",
        severity: "action",
        title: `Every team has submitted round ${active.roundNumber}`,
        detail: "Ending the round scores all teams against each other and publishes their results.",
        actionLabel: "End round",
        action: "endRound",
      });
    } else if (missing.length > 0 && missing.length <= 3) {
      items.push({
        id: "round-waiting-few",
        severity: "warning",
        title: `Waiting on ${missing.map((t) => t.teamName).join(", ")}`,
        detail: `${teams.length - missing.length} of ${teams.length} teams are in. Ending now scores the round without the rest.`,
        actionLabel: "See submissions",
        to: "/decisions",
      });
    }

    const endsAt = active.timer?.endDate ? new Date(active.timer.endDate).getTime() : null;
    if (endsAt && endsAt < Date.now()) {
      items.push({
        id: "round-overrun",
        severity: "action",
        title: `Round ${active.roundNumber} is past its time`,
        detail: "The timer has run out. Teams can still submit until you end the round.",
        actionLabel: "End round",
        action: "endRound",
      });
    }
  } else if (pending) {
    items.push({
      id: "round-pending",
      severity: "action",
      title: `Round ${pending.roundNumber} is ready to open`,
      detail: "Teams cannot submit anything until a round is active.",
      actionLabel: "Open round",
      action: "activateRound",
    });
  } else if (rounds.length === 0 && teams.length > 0) {
    items.push({
      id: "no-rounds",
      severity: "action",
      title: "No rounds yet",
      detail: "Create the first round to start the session.",
      actionLabel: "Create a round",
      to: "/rounds",
    });
  }

  // ── Content + infrastructure ──────────────────────────────────────────
  if (playerConfig?.status === "draft") {
    items.push({
      id: "config-draft",
      severity: "warning",
      title: "Game content has unpublished edits",
      detail: "Players are still seeing the last published version. Publish when the changes are ready.",
      actionLabel: "Review draft",
      to: "/game-content",
    });
  }
  if (storage && storage.durable === false) {
    items.push({
      id: "storage-local",
      severity: "info",
      title: "Uploads are stored on local disk",
      detail: "Fine for a local run; on a container host uploaded images are lost on the next deploy.",
      actionLabel: "Image assets",
      to: "/image-assets",
    });
  }

  return items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/** Per-team submission state for the live round, ordered so gaps read first. */
export function submissionState(round: any | undefined, teams: any[], decisions: any[]) {
  if (!round) return { submitted: [], missing: teams, pct: 0 };
  const ids = new Set(
    decisions.filter((d) => d.roundNumber === round.roundNumber).map((d) => String(d.teamId))
  );
  const submitted = teams.filter((t) => ids.has(String(t._id)));
  const missing = teams.filter((t) => !ids.has(String(t._id)));
  return {
    submitted,
    missing,
    pct: teams.length === 0 ? 0 : Math.round((submitted.length / teams.length) * 100),
  };
}

/**
 * Cohort standings from the results documents.
 *
 * NOTE ON "SHARE": calcMarketModel multiplies each team's competed share by its
 * own declared `projected_market_share`, itself passed through a diminishing-
 * returns factor — so these values do NOT partition the market and will not sum
 * to 100%. They rank teams correctly, which is what a standings table needs, but
 * they must never be presented as "x% of the market".
 */
export function standings(results: any[], teams: any[], roundNumber?: number) {
  const name = new Map(teams.map((t) => [String(t._id), t.teamName]));
  // Carried through so standings can show the team's face, not its initials.
  const avatar = new Map(teams.map((t) => [String(t._id), t.avatar?.url ?? null]));
  const totals = new Map<string, { score: number; share: number; n: number }>();

  for (const r of results) {
    if (roundNumber !== undefined && r.roundNumber !== roundNumber) continue;
    for (const [teamId, share] of Object.entries(r.marketShares ?? {})) {
      const cur = totals.get(teamId) ?? { score: 0, share: 0, n: 0 };
      cur.share += Number(share) || 0;
      cur.score += Number((r.weightedScores ?? {})[teamId]) || 0;
      cur.n += 1;
      totals.set(teamId, cur);
    }
  }

  return [...totals.entries()]
    .map(([teamId, v]) => ({
      teamId,
      teamName: name.get(teamId) ?? `Team ${teamId.slice(-6)}`,
      avatarUrl: avatar.get(teamId) ?? null,
      index: v.n ? v.share / v.n : 0,
      score: v.n ? v.score / v.n : 0,
    }))
    .sort((a, b) => b.index - a.index);
}
