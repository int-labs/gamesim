import { Request, Response } from "express";
import mongoose from "mongoose";
import PlayerConfig, {
  PLAYER_CONFIG_SECTIONS,
  toSnapshot,
  type PlayerConfigSection,
} from "../models/PlayerConfig";
import SimulationType from "../models/simulationTypes";
import {
  SECTION_SCHEMAS,
  formatZodIssues,
  fullConfigSchema,
  validateFullConfig,
} from "../validators/playerConfig";

const isSection = (s: string): s is PlayerConfigSection =>
  (PLAYER_CONFIG_SECTIONS as readonly string[]).includes(s);

const isAdmin = (req: Request) => {
  const role = (req as any).user?.role;
  return role === "admin" || role === "operator";
};

/**
 * GET /player-config/:simulationTypeId
 *
 * Serves the PUBLISHED snapshot. This is what the player reads, so it must
 * never expose a half-finished edit — drafts are invisible here by design.
 * A 404 is a supported answer: the player falls back to its bundled catalog.
 *
 * `?draft=true` (admin/operator only) serves the live draft for console preview.
 */
export const getPlayerConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;
    if (!mongoose.isValidObjectId(simulationTypeId)) {
      res.status(400).json({ message: "simulationTypeId must be a valid id." });
      return;
    }

    const doc = await PlayerConfig.findOne({ simulationTypeId });
    if (!doc) {
      res.status(404).json({
        message: "No player config for this simulation type. The player will use its bundled defaults.",
      });
      return;
    }

    const wantsDraft = req.query.draft === "true";
    if (wantsDraft && !isAdmin(req)) {
      res.status(403).json({ message: "Only admins and operators can read the draft." });
      return;
    }

    if (wantsDraft) {
      res.status(200).json({
        simulationTypeId,
        version: doc.version,
        status: doc.status,
        publishedAt: doc.publishedAt,
        draft: true,
        config: toSnapshot(doc),
      });
      return;
    }

    if (!doc.publishedSnapshot) {
      res.status(404).json({
        message: "This config has never been published. The player will use its bundled defaults.",
      });
      return;
    }

    res.status(200).json({
      simulationTypeId,
      version: doc.version,
      publishedAt: doc.publishedAt,
      draft: false,
      config: doc.publishedSnapshot,
    });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch player config." });
  }
};

/**
 * PUT /player-config/:simulationTypeId
 * Upserts the DRAFT wholesale. Sections omitted from the body are left alone,
 * so this doubles as the seed path and as "replace several sections at once".
 */
export const putPlayerConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;
    if (!mongoose.isValidObjectId(simulationTypeId)) {
      res.status(400).json({ message: "simulationTypeId must be a valid id." });
      return;
    }

    const simType = await SimulationType.findById(simulationTypeId);
    if (!simType) {
      res.status(404).json({ message: "Simulation type not found." });
      return;
    }

    const parsed = fullConfigSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        message: "Player config is invalid.",
        issues: formatZodIssues(parsed.error),
      });
      return;
    }

    const doc =
      (await PlayerConfig.findOne({ simulationTypeId })) ??
      new PlayerConfig({ simulationTypeId });

    for (const [section, value] of Object.entries(parsed.data)) {
      if (value !== undefined) (doc as any)[section] = value;
    }

    // Cross-section rules are advisory on save (an operator mid-build will
    // legitimately have dangling references) but blocking on publish.
    const crossIssues = validateFullConfig(toSnapshot(doc));

    doc.status = "draft";
    await doc.save();

    res.status(200).json({
      message: "Draft saved.",
      version: doc.version,
      status: doc.status,
      sectionsUpdated: Object.keys(parsed.data).filter(
        (k) => (parsed.data as any)[k] !== undefined
      ),
      warnings: crossIssues,
    });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to save player config." });
  }
};

/**
 * PATCH /player-config/:simulationTypeId/:section
 * Replaces exactly one section — the editors' workhorse.
 */
export const patchPlayerConfigSection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationTypeId, section } = req.params;
    if (!mongoose.isValidObjectId(simulationTypeId)) {
      res.status(400).json({ message: "simulationTypeId must be a valid id." });
      return;
    }
    if (!isSection(section)) {
      res.status(400).json({
        message: `Unknown section "${section}".`,
        allowed: PLAYER_CONFIG_SECTIONS,
      });
      return;
    }

    const parsed = SECTION_SCHEMAS[section].safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: `Section "${section}" is invalid.`,
        issues: formatZodIssues(parsed.error),
      });
      return;
    }

    const doc =
      (await PlayerConfig.findOne({ simulationTypeId })) ??
      new PlayerConfig({ simulationTypeId });

    (doc as any)[section] = parsed.data;
    doc.status = "draft";
    await doc.save();

    res.status(200).json({
      message: `Section "${section}" saved to draft.`,
      version: doc.version,
      status: doc.status,
      warnings: validateFullConfig(toSnapshot(doc)),
    });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to save section." });
  }
};

/**
 * POST /player-config/:simulationTypeId/publish
 * Freezes the draft into `publishedSnapshot` and bumps the version. This is
 * the only moment players see a change, so cross-section rules are enforced
 * here rather than warned about.
 *
 * Publishing an unchanged draft is a no-op (content hash) so re-running the
 * provisioning script doesn't inflate the version number.
 */
export const publishPlayerConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;
    const doc = await PlayerConfig.findOne({ simulationTypeId });
    if (!doc) {
      res.status(404).json({ message: "No player config to publish." });
      return;
    }

    const snapshot = toSnapshot(doc);

    const blocking = validateFullConfig(snapshot);
    if (blocking.length > 0) {
      res.status(400).json({
        message: "Can't publish — the config has unresolved references.",
        issues: blocking,
      });
      return;
    }

    const nextJson = JSON.stringify(snapshot);
    const prevJson = doc.publishedSnapshot ? JSON.stringify(doc.publishedSnapshot) : null;

    if (prevJson === nextJson) {
      res.status(200).json({
        message: "Already published — the draft is identical.",
        version: doc.version,
        publishedAt: doc.publishedAt,
        changed: false,
      });
      return;
    }

    doc.publishedSnapshot = JSON.parse(nextJson);
    doc.version += 1;
    doc.status = "published";
    doc.publishedAt = new Date();
    doc.publishNote = typeof req.body?.note === "string" ? req.body.note.slice(0, 500) : null;
    await doc.save();

    res.status(200).json({
      message: `Published version ${doc.version}.`,
      version: doc.version,
      publishedAt: doc.publishedAt,
      changed: true,
    });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to publish player config." });
  }
};

/**
 * POST /player-config/:simulationTypeId/revert
 * Throws the draft away and restores the last published snapshot.
 */
export const revertPlayerConfigDraft = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;
    const doc = await PlayerConfig.findOne({ simulationTypeId });
    if (!doc) {
      res.status(404).json({ message: "No player config found." });
      return;
    }
    if (!doc.publishedSnapshot) {
      res.status(400).json({ message: "Nothing to revert to — this config has never been published." });
      return;
    }

    for (const section of PLAYER_CONFIG_SECTIONS) {
      (doc as any)[section] = (doc.publishedSnapshot as any)[section];
    }
    doc.status = "published";
    await doc.save();

    res.status(200).json({ message: `Draft reverted to version ${doc.version}.`, version: doc.version });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to revert the draft." });
  }
};
