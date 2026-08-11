import { Request, Response } from "express";
import { z } from "zod";
import Debrief from "../models/Debrief";
import Simulation from "../models/simulations";

/**
 * The end-of-simulation debrief.
 *
 * The gate is the whole point: teams only get this once it is published AND
 * their simulation is Completed. Publishing early, or a simulation still
 * running, both keep it hidden — otherwise a team could read the facilitator's
 * conclusions while still competing.
 */

const objectId = z.string().length(24);

const sectionSchema = z.object({
  _id: objectId.optional(),
  title: z.string().trim().min(1, "A section needs a title.").max(160),
  body: z.string().max(20000).default(""),
  imageAssetId: objectId.nullish(),
  teamId: objectId.nullish(),
  order: z.number().int().min(0).max(999).optional(),
});

const debriefSchema = z.object({
  title: z.string().trim().min(1).max(160).default("Debrief"),
  intro: z.string().max(20000).default(""),
  heroImageAssetId: objectId.nullish(),
  sections: z.array(sectionSchema).max(40).default([]),
});

const isStaff = (req: Request) => {
  const role = (req as any).user?.role;
  return role === "admin" || role === "operator";
};

const issues = (e: z.ZodError) =>
  e.issues.map((i) => ({ path: i.path.join("."), message: i.message }));

// GET /debriefs?simulationId=
export const getDebrief = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId } = req.query;
    if (!simulationId) {
      res.status(400).json({ message: "simulationId is required." });
      return;
    }

    const debrief = await Debrief.findOne({ simulationId });
    if (!debrief) {
      res.status(404).json({ message: "No debrief for this simulation yet." });
      return;
    }

    // Staff always see the draft — that's how they edit it.
    if (isStaff(req)) {
      res.status(200).json(debrief);
      return;
    }

    if (debrief.status !== "published") {
      res.status(404).json({ message: "The debrief hasn't been published yet." });
      return;
    }

    const simulation = await Simulation.findById(simulationId).select("status");
    if (simulation?.status !== "Completed") {
      res.status(404).json({
        message: "The debrief unlocks when the simulation is complete.",
      });
      return;
    }

    // Strip other teams' private addenda before it leaves the server.
    const teamId = String((req as any).user?.teamId ?? "");
    const visible = debrief.sections
      .filter((s) => !s.teamId || String(s.teamId) === teamId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    res.status(200).json({ ...debrief.toObject(), sections: visible });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch the debrief." });
  }
};

// PUT /debriefs?simulationId= — upsert the draft.
export const putDebrief = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId } = req.query;
    if (!simulationId) {
      res.status(400).json({ message: "simulationId is required." });
      return;
    }

    const parsed = debriefSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ message: "Debrief is invalid.", issues: issues(parsed.error) });
      return;
    }

    const simulation = await Simulation.findById(simulationId).select("_id");
    if (!simulation) {
      res.status(404).json({ message: "Simulation not found." });
      return;
    }

    const debrief =
      (await Debrief.findOne({ simulationId })) ?? new Debrief({ simulationId });

    debrief.title = parsed.data.title;
    debrief.intro = parsed.data.intro;
    debrief.heroImageAssetId = (parsed.data.heroImageAssetId ?? null) as any;
    // Order comes from array position so the editor's drag order is the only
    // source of truth.
    debrief.sections = parsed.data.sections.map((s, i) => ({
      ...(s._id ? { _id: s._id as any } : {}),
      title: s.title,
      body: s.body,
      imageAssetId: (s.imageAssetId ?? null) as any,
      teamId: (s.teamId ?? null) as any,
      order: i,
    })) as any;

    // Editing a published debrief returns it to draft — the same
    // draft/published discipline as PlayerConfig, so a live document never
    // changes under a reader mid-edit.
    debrief.status = "draft";
    await debrief.save();

    res.status(200).json({ message: "Debrief saved as draft.", debrief });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to save the debrief." });
  }
};

// POST /debriefs/publish?simulationId=
export const publishDebrief = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId } = req.query;
    const debrief = await Debrief.findOne({ simulationId });
    if (!debrief) {
      res.status(404).json({ message: "No debrief to publish." });
      return;
    }
    if (!debrief.sections.length && !debrief.intro.trim()) {
      res.status(400).json({ message: "Write an intro or at least one section first." });
      return;
    }

    debrief.status = "published";
    debrief.publishedAt = new Date();
    await debrief.save();

    const simulation = await Simulation.findById(simulationId).select("status");
    res.status(200).json({
      message: "Debrief published.",
      publishedAt: debrief.publishedAt,
      // Publishing is necessary but not sufficient — say so plainly rather
      // than letting an operator assume teams can now see it.
      visibleToTeams: simulation?.status === "Completed",
      simulationStatus: simulation?.status ?? null,
    });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to publish the debrief." });
  }
};

// POST /debriefs/unpublish?simulationId=
export const unpublishDebrief = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId } = req.query;
    const debrief = await Debrief.findOneAndUpdate(
      { simulationId },
      { status: "draft" },
      { new: true }
    );
    if (!debrief) {
      res.status(404).json({ message: "No debrief found." });
      return;
    }
    res.status(200).json({ message: "Debrief hidden from teams." });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to unpublish the debrief." });
  }
};
