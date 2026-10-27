import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import DebriefChartStyle from "../models/debriefChartStyle";

/**
 * The chart gallery — global, not scoped to a simulation type.
 *
 * ⚠ `shape` IS RENDERED BY THE PLAYER. It must be sanitised before it gets
 * here, at the console boundary, the same rule `products.segments` follows.
 * This endpoint is NOT the boundary: a row written straight to it never passes
 * the console's sanitiser, which is an accepted limit of that design and the
 * reason writes are admin-only.
 */

const styleSchema = z.object({
  name:     z.string().trim().min(1, "A chart style needs a name.").max(120),
  category: z.string().trim().max(64).default(""),
  shape:    z.string().max(20000).default(""),
});

const patchSchema = styleSchema.partial();

const issues = (e: z.ZodError) =>
  e.issues.map((i) => ({ path: i.path.join("."), message: i.message }));

/** The unique index is `{category, name}` — surface it as a conflict rather
 *  than a 500, which is what a duplicate key would otherwise produce. */
const isDuplicate = (err: unknown): boolean =>
  (err as { code?: number })?.code === 11000;

// GET /debrief-chart-styles
export const getDebriefChartStyles = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Sorted for the picker. The gallery has no ordinal of its own, so this is
    // alphabetical within a family rather than an authored order.
    const styles = await DebriefChartStyle.find().sort({ category: 1, name: 1 });
    res.status(200).json(styles);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch chart styles." });
  }
};

// POST /debrief-chart-styles
export const createDebriefChartStyle = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = styleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Chart style is invalid.", issues: issues(parsed.error) });
      return;
    }
    const style = await DebriefChartStyle.create(parsed.data);
    res.status(201).json(style);
  } catch (err: any) {
    if (isDuplicate(err)) {
      res.status(409).json({ message: "That chart style already exists in this category." });
      return;
    }
    res.status(500).json({ message: err?.message ?? "Failed to create the chart style." });
  }
};

// PATCH /debrief-chart-styles/:id
export const updateDebriefChartStyle = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Chart style is invalid.", issues: issues(parsed.error) });
      return;
    }
    const style = await DebriefChartStyle.findByIdAndUpdate(req.params.id, parsed.data, {
      new: true,
    });
    if (!style) {
      res.status(404).json({ message: "Chart style not found." });
      return;
    }
    res.status(200).json(style);
  } catch (err: any) {
    if (isDuplicate(err)) {
      res.status(409).json({ message: "That chart style already exists in this category." });
      return;
    }
    res.status(500).json({ message: err?.message ?? "Failed to update the chart style." });
  }
};

// DELETE /debrief-chart-styles/:id
export const deleteDebriefChartStyle = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(400).json({ message: "Invalid chart style id." });
      return;
    }

    // REFUSED WHILE REFERENCED. Letting it go would leave every chart pointing
    // here with a null shape, which renders nothing — and "renders nothing" is
    // indistinguishable from a chart nobody finished configuring.
    const inUse = await mongoose
      .model("DebriefChart")
      .exists({ chartStyle: req.params.id });
    if (inUse) {
      res.status(409).json({
        message: "That chart style is still used by a configured chart.",
      });
      return;
    }

    const style = await DebriefChartStyle.findByIdAndDelete(req.params.id);
    if (!style) {
      res.status(404).json({ message: "Chart style not found." });
      return;
    }
    res.status(200).json({ message: "Chart style deleted." });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete the chart style." });
  }
};
