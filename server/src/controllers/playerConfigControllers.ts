import { Request, Response } from "express";
import PlayerConfig, { type PlayerConfigEntry } from "../models/playerConfig";
import ImageAsset from "../models/imageAssets";

/** A 24-char hex string is an ImageAsset `_id`; anything else is already a URL. */
const looksLikeAssetId = (v: string): boolean => /^[0-9a-f]{24}$/i.test(v.trim());

/**
 * Replace any `imageAssetId` that is an ImageAsset id with that asset's URL, so
 * the player client can render it directly. Values already holding a URL — which
 * is what the console's picker stores — pass through untouched.
 *
 * One query for the whole document, not one per entry.
 */
async function resolveAssetUrls(
  config: Record<string, PlayerConfigEntry[]>
): Promise<Record<string, PlayerConfigEntry[]>> {
  const ids = new Set<string>();
  for (const rows of Object.values(config ?? {})) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const v = row?.imageAssetId;
      if (typeof v === "string" && looksLikeAssetId(v)) ids.add(v.trim());
    }
  }
  if (ids.size === 0) return config;

  const assets = await ImageAsset.find({ _id: { $in: [...ids] } })
    .select("_id url")
    .lean();
  const urlById = new Map(assets.map((a: any) => [String(a._id), a.url]));

  const out: Record<string, PlayerConfigEntry[]> = {};
  for (const [section, rows] of Object.entries(config ?? {})) {
    out[section] = Array.isArray(rows)
      ? rows.map((row) => {
          const v = row?.imageAssetId;
          if (typeof v !== "string" || !looksLikeAssetId(v)) return row;
          // An id with no matching asset resolves to null rather than being
          // passed through — the client would otherwise put a raw id in <img>.
          return { ...row, imageAssetId: urlById.get(v.trim()) ?? null };
        })
      : [];
  }
  return out;
}

// GET /player-config/:simulationTypeId
export const getPlayerConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await PlayerConfig.findOne({
      simulationTypeId: req.params.simulationTypeId,
    }).lean();

    // 404 is the client's normal "nothing published yet" path, on both the
    // console and the player, so it must stay a 404 and not an empty 200.
    if (!doc) {
      res.status(404).json({ message: "No player config for this simulation type." });
      return;
    }

    res.status(200).json({ ...doc, config: await resolveAssetUrls(doc.config ?? {}) });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch player config." });
  }
};

// POST /player-config
export const createPlayerConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationTypeId, config } = req.body;
    if (!simulationTypeId) {
      res.status(400).json({ message: "simulationTypeId is required." });
      return;
    }
    // Upsert rather than insert: the console has no "does one exist" step, and
    // a second POST for the same type is a re-save, not an error.
    const doc = await PlayerConfig.findOneAndUpdate(
      { simulationTypeId },
      { $set: { config: config ?? {} } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.status(201).json(doc);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to create player config." });
  }
};

// PATCH /player-config/:id
export const updatePlayerConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { config } = req.body;
    if (config === undefined) {
      res.status(400).json({ message: "config is required." });
      return;
    }
    // Whole-document replace of `config`. The console holds the full set in
    // state and sends it back entire, so a deep merge would make deleting an
    // entry impossible.
    const doc = await PlayerConfig.findByIdAndUpdate(
      req.params.id,
      { $set: { config } },
      { new: true, runValidators: true }
    );
    if (!doc) {
      res.status(404).json({ message: "Player config not found." });
      return;
    }
    res.status(200).json(doc);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to update player config." });
  }
};

// DELETE /player-config/:id
export const deletePlayerConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await PlayerConfig.findByIdAndDelete(req.params.id);
    if (!doc) {
      res.status(404).json({ message: "Player config not found." });
      return;
    }
    res.status(200).json({ message: "Player config deleted." });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete player config." });
  }
};
