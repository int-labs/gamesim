import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import RoundNote from "../models/roundNote";

/**
 * Facilitator notes per round.
 *
 * The only subtle part is the read filter: a team must see the general notes
 * plus its own, and never another team's private feedback. That's enforced
 * here rather than trusted to the caller's query params.
 */

const objectId = z.string().length(24);

const noteSchema = z.object({
  simulationId: objectId,
  roundNumber: z.number().int().min(0).max(999),
  teamId: objectId.nullish(),
  title: z.string().trim().min(1, "A note needs a title.").max(120),
  body: z.string().max(5000).default(""),
  imageAssetId: objectId.nullish(),
  pinned: z.boolean().default(false),
});

const patchSchema = noteSchema.partial().omit({ simulationId: true });

const isStaff = (req: Request) => {
  const role = (req as any).user?.role;
  return role === "admin" || role === "operator";
};

const issues = (e: z.ZodError) =>
  e.issues.map((i) => ({ path: i.path.join("."), message: i.message }));

// GET /round-notes?simulationId=&roundNumber=
export const getRoundNotes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId, roundNumber } = req.query;
    if (!simulationId) {
      res.status(400).json({ message: "simulationId is required." });
      return;
    }

    const filter: Record<string, any> = { simulationId };
    if (roundNumber !== undefined && roundNumber !== "") {
      filter.roundNumber = Number(roundNumber);
    }

    // Staff see everything. A team sees general notes plus its own — never
    // another team's, whatever it passes in the query.
    if (!isStaff(req)) {
      const teamId = (req as any).user?.teamId;
      filter.$or = [{ teamId: null }, ...(teamId ? [{ teamId }] : [])];
    }

    const notes = await RoundNote.find(filter).sort({
      pinned: -1,
      roundNumber: 1,
      createdAt: -1,
    });

    res.status(200).json(notes);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch notes." });
  }
};

// POST /round-notes
export const createRoundNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = noteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Note is invalid.", issues: issues(parsed.error) });
      return;
    }

    const note = await RoundNote.create({
      ...parsed.data,
      teamId: parsed.data.teamId ?? null,
      imageAssetId: parsed.data.imageAssetId ?? null,
      authorUserId: (req as any).user?._id ?? (req as any).user?.userId ?? null,
    });

    res.status(201).json(note);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to create the note." });
  }
};

// PATCH /round-notes/:id
export const updateRoundNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Note is invalid.", issues: issues(parsed.error) });
      return;
    }

    const note = await RoundNote.findByIdAndUpdate(req.params.id, parsed.data, { new: true });
    if (!note) {
      res.status(404).json({ message: "Note not found." });
      return;
    }
    res.status(200).json(note);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to update the note." });
  }
};

// DELETE /round-notes/:id
export const deleteRoundNote = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(400).json({ message: "Invalid note id." });
      return;
    }
    const note = await RoundNote.findByIdAndDelete(req.params.id);
    if (!note) {
      res.status(404).json({ message: "Note not found." });
      return;
    }
    res.status(200).json({ message: "Note deleted." });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete the note." });
  }
};
