import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import DebriefChart from "../models/debriefChart";
import RoundNote from "../models/roundNote";

/**
 * A simulation type's configured charts.
 *
 * ⚠ THE AXES ARE NULLABLE ON PURPOSE. An unfinished chart is saved and shown
 * as-is; nothing here refuses a half-configured row. The only thing that hides
 * a chart from a team is a missing description — see `RoundNote.chartId`.
 *
 * Reads are open to any authenticated caller because the player's debrief needs
 * them; writes are admin/operator, same split as `/round-notes`.
 */

const objectId = z.string().length(24);

const chartSchema = z.object({
  simulationTypeId: objectId,
  name:       z.string().trim().min(1, "A chart needs a name.").max(160),
  category:   z.string().trim().max(64).default(""),
  order:      z.number().int().min(0).max(99999).default(0),
  chartStyle: objectId.nullish(),
  xAxis:      z.string().trim().max(64).nullish(),
  yAxis:      z.string().trim().max(64).nullish(),
  grouping:   z.string().trim().max(64).nullish(),
});

// `simulationTypeId` is omitted: moving a chart to another type is not an edit,
// it is a different chart — and its descriptions are keyed to this one.
const patchSchema = chartSchema.partial().omit({ simulationTypeId: true });

const issues = (e: z.ZodError) =>
  e.issues.map((i) => ({ path: i.path.join("."), message: i.message }));

// GET /debrief-charts?simulationTypeId=
export const getDebriefCharts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationTypeId } = req.query;
    if (!simulationTypeId || !mongoose.isValidObjectId(String(simulationTypeId))) {
      res.status(400).json({ message: "A valid simulationTypeId is required." });
      return;
    }

    // Populated so the console can show which shape each chart uses without a
    // second round trip; the debrief controller does the same.
    const charts = await DebriefChart.find({ simulationTypeId })
      .sort({ order: 1 })
      .populate("chartStyle");

    res.status(200).json(charts);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch charts." });
  }
};

// POST /debrief-charts
export const createDebriefChart = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = chartSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Chart is invalid.", issues: issues(parsed.error) });
      return;
    }

    const chart = await DebriefChart.create({
      ...parsed.data,
      // `.nullish()` lets `undefined` through, and these four must land as null
      // rather than absent so a later PATCH has something to overwrite.
      chartStyle: parsed.data.chartStyle ?? null,
      xAxis:      parsed.data.xAxis ?? null,
      yAxis:      parsed.data.yAxis ?? null,
      grouping:   parsed.data.grouping ?? null,
    });

    res.status(201).json(chart);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to create the chart." });
  }
};

// PATCH /debrief-charts/:id
export const updateDebriefChart = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Chart is invalid.", issues: issues(parsed.error) });
      return;
    }
    const chart = await DebriefChart.findByIdAndUpdate(req.params.id, parsed.data, { new: true });
    if (!chart) {
      res.status(404).json({ message: "Chart not found." });
      return;
    }
    res.status(200).json(chart);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to update the chart." });
  }
};

// DELETE /debrief-charts/:id
export const deleteDebriefChart = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(400).json({ message: "Invalid chart id." });
      return;
    }

    const chart = await DebriefChart.findByIdAndDelete(req.params.id);
    if (!chart) {
      res.status(404).json({ message: "Chart not found." });
      return;
    }

    // ITS DESCRIPTIONS GO WITH IT. They are keyed to this `_id` across every
    // round, so leaving them would strand rows nothing can reach or edit —
    // and a recreated chart gets a new id, so they could never be reattached.
    const { deletedCount } = await RoundNote.deleteMany({ chartId: chart._id });

    res.status(200).json({
      message: "Chart deleted.",
      descriptionsDeleted: deletedCount ?? 0,
    });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete the chart." });
  }
};
