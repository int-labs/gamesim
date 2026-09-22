import { Request, Response } from "express";
import LeaderboardConfig, {
  SERVER_SOURCES,
  METRIC_ORIGINS,
  CLIENT_SOURCE_PATTERN,
} from "../models/leaderboardConfig";

/**
 * The leaderboard weighting, one document per simulationType.
 *
 * `PUT /leaderboard-config/:simulationTypeId` UPSERTS, because the admin page
 * edits ONE document per type and should not have to know whether it exists
 * yet — a create/update split there is a distinction the operator cannot see.
 */

/**
 * ONE validator, shared by PUT and PATCH.
 *
 * Returns the operator-facing message, or `null` when the set is legal. It
 * exists so the two write paths cannot drift into disagreeing about what a
 * valid config is — PATCH validates the MERGED result, which is the only shape
 * that has to hold.
 *
 * Messages return the arithmetic and the allowed values, because "weights sum
 * to 97" and "pick one of these ten" are actionable where a Mongoose path is
 * not.
 */
function validateMetrics(metrics: any[]): string | null {
  const total = metrics.reduce((a, m) => a + (Number(m?.weight) || 0), 0);
  if (metrics.length > 0 && Math.abs(total - 100) > 1e-9) {
    return `Metric weights must sum to 100 — they currently sum to ${total}.`;
  }

  const keys = metrics.map((m) => m?.key);
  if (new Set(keys).size !== keys.length) {
    return "Two metrics share a key — each metric key must be unique.";
  }

  const badOrigin = metrics.find((m) => !METRIC_ORIGINS.includes(m?.origin));
  if (badOrigin) {
    return `Metric "${badOrigin.key ?? "?"}" has origin "${badOrigin.origin}". Allowed: ${METRIC_ORIGINS.join(", ")}.`;
  }

  // Validated AGAINST `origin`: a server metric must name a field
  // calcFinancials produces; a client metric declares its own key and the
  // player fills it. Two messages, because the two fixes differ.
  const badServer = metrics.find(
    (m) => m.origin === "server" && !(SERVER_SOURCES as readonly string[]).includes(m?.source),
  );
  if (badServer) {
    return `"${badServer.source}" is not a calcFinancials field. ` +
      `Server-origin metrics must use one of: ${SERVER_SOURCES.join(", ")}.`;
  }

  const badClient = metrics.find(
    (m) => m.origin === "client" && !CLIENT_SOURCE_PATTERN.test(String(m?.source ?? "")),
  );
  if (badClient) {
    return `Client-origin metric key "${badClient.source}" is not a valid key — ` +
      `letters, digits and underscore, starting with a letter, max 40 chars.`;
  }

  return null;
}

// GET /leaderboard-config/:simulationTypeId
//
// 200 with `metrics: []` rather than 404 when nothing is configured: "no
// weighting yet" is a legitimate state the admin page renders as an empty
// editor, and a 404 would have every caller special-case a first run.
export const getLeaderboardConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;
    const doc = await LeaderboardConfig.findOne({ simulationTypeId });
    res.status(200).json(doc ?? { simulationTypeId, metrics: [] });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch leaderboard config." });
  }
};

// PUT /leaderboard-config/:simulationTypeId
export const upsertLeaderboardConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;
    const metrics = req.body?.metrics;

    if (!Array.isArray(metrics)) {
      res.status(400).json({ message: "metrics[] is required." });
      return;
    }

    // Checked here as well as in the schema so the operator gets the
    // arithmetic and the allowed values back, not a Mongoose path. Shared with
    // PATCH so the two writes cannot disagree about what is legal.
    const invalid = validateMetrics(metrics);
    if (invalid) {
      res.status(400).json({ message: invalid });
      return;
    }

    const doc = await LeaderboardConfig.findOneAndUpdate(
      { simulationTypeId },
      { simulationTypeId, metrics },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
    res.status(200).json(doc);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to save leaderboard config." });
  }
};

/**
 * PATCH /leaderboard-config/:simulationTypeId — edit an EXISTING weighting
 * without resending all of it.
 *
 * `PUT` replaces the whole `metrics` array, which is right when the page has
 * just loaded and holds the truth, and wrong for anything else: two operators
 * on the same type, or a caller that only wants to bump one weight, would
 * silently drop every metric they did not happen to send.
 *
 * So this MERGES BY `key`:
 *
 *   • a metric whose `key` already exists has the supplied fields overwritten
 *     and the rest left alone — send `{ key, weight }` to change only a weight
 *   • a metric whose `key` is new is APPENDED
 *   • `removeKeys` deletes by key
 *
 * The weights must still sum to 100 AFTER the merge, not in the payload —
 * otherwise every partial edit would be rejected for being partial.
 *
 * 404 rather than upserting: PATCH means "change the thing that is there", and
 * creating one from a fragment would produce a config nobody wrote in full.
 * Use PUT for the first save.
 */
export const patchLeaderboardConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;
    const patches = req.body?.metrics;
    const removeKeys: string[] = Array.isArray(req.body?.removeKeys) ? req.body.removeKeys : [];

    if (patches !== undefined && !Array.isArray(patches)) {
      res.status(400).json({ message: "metrics must be an array when supplied." });
      return;
    }
    if (patches === undefined && removeKeys.length === 0) {
      res.status(400).json({ message: "Nothing to patch — supply metrics[] and/or removeKeys[]." });
      return;
    }

    const existing = await LeaderboardConfig.findOne({ simulationTypeId });
    if (!existing) {
      res.status(404).json({
        message: "No leaderboard config for that simulation type — create one with PUT first.",
      });
      return;
    }

    const byKey = new Map<string, any>(
      (existing.metrics ?? []).map((m: any) => [m.key, (m.toObject?.() ?? { ...m })]),
    );

    for (const p of (patches ?? []) as any[]) {
      if (!p?.key) {
        res.status(400).json({ message: "Every patched metric needs a `key` to match on." });
        return;
      }
      // Merge, so an omitted field keeps its stored value rather than becoming
      // undefined — the whole reason to have PATCH at all.
      byKey.set(p.key, { ...(byKey.get(p.key) ?? {}), ...p });
    }
    for (const k of removeKeys) byKey.delete(k);

    const merged = [...byKey.values()];

    const invalid = validateMetrics(merged);
    if (invalid) {
      res.status(400).json({ message: invalid });
      return;
    }

    existing.set("metrics", merged);
    await existing.save();
    res.status(200).json(existing);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to patch leaderboard config." });
  }
};

// GET /leaderboard-config/sources
//
// What the admin page's dropdowns are built from, and what the PLAYER reads to
// learn which metric keys it is responsible for reporting. Served by the server
// so neither client keeps a second copy that can drift from what the scorer
// accepts.
export const getLeaderboardSources = async (_req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    origins: METRIC_ORIGINS,
    /** calcFinancials fields a server-origin metric may name. */
    serverSources: SERVER_SOURCES,
    /** Client-origin keys are declared per config, not enumerated here — this
     *  is the shape one has to satisfy. */
    clientSourcePattern: CLIENT_SOURCE_PATTERN.source,
    // Kept so an older admin build that reads `sources` still renders.
    sources: SERVER_SOURCES,
  });
};

// DELETE /leaderboard-config/:simulationTypeId
export const deleteLeaderboardConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;
    const doc = await LeaderboardConfig.findOneAndDelete({ simulationTypeId });
    if (!doc) {
      res.status(404).json({ message: "No leaderboard config for that simulation type." });
      return;
    }
    res.status(200).json({ message: "Leaderboard config deleted." });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete leaderboard config." });
  }
};
