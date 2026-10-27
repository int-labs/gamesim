import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import DebriefChart from "../models/debriefChart";
import DebriefChartStyle from "../models/debriefChartStyle";
import RoundNote from "../models/roundNote";
import { renderChartToSvg, UnsafeSpecError } from "../services/chartRenderer";
import { CLIENT_CHART_KEYS } from "../constants/clientCharts";

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
  // `each` fans this one row out to N + 1 instances at render time.
  scope:      z.enum(["overall", "each"]).default("overall"),
  chartStyle: objectId.nullish(),
  // An ENUM, not free text: a typo here produces a chart that is configured,
  // described and permanently blank, with nothing to say why.
  clientChart: z.enum(CLIENT_CHART_KEYS as [string, ...string[]]).nullish(),
  xAxis:      z.string().trim().max(64).nullish(),
  // ⚠ ACCEPTS A BARE STRING and wraps it. Charts written before 2026-10-27
  // hold one, and so does anything patching this endpoint from before the
  // change — rejecting those would turn a widening into a breaking change.
  yAxis:      z.union([
                z.string().trim().max(64),
                z.array(z.string().trim().min(1).max(64)).max(12),
              ]).nullish().transform((v) => (v == null ? [] : Array.isArray(v) ? v : [v])),
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
      chartStyle:  parsed.data.chartStyle ?? null,
      clientChart: parsed.data.clientChart ?? null,
      xAxis:       parsed.data.xAxis ?? null,
      // Already an array — the schema's transform normalises it.
      yAxis:      parsed.data.yAxis,
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

const previewSchema = z.object({
  chartStyle: objectId,
  // A real simulation and round, not samples. "Does this chart work" almost
  // always means "is it readable with this sim's numbers", and a synthetic
  // preview answers the wrong question.
  simulationId: objectId,
  roundNumber:  z.number().int().min(0).max(999),
  xAxis:    z.string().trim().max(64).nullish(),
  yAxis:    z.union([
              z.string().trim().max(64),
              z.array(z.string().trim().min(1).max(64)).max(12),
            ]).nullish(),
  grouping: z.string().trim().max(64).nullish(),
  productId: objectId.nullish(),
});

// POST /debrief-charts/preview
/**
 * Render a DRAFT binding before it is saved.
 *
 * Takes the config the operator is editing rather than a stored chart, so a
 * bad axis is visible at the moment it is chosen instead of after a save and a
 * trip to the player.
 *
 * ⚠ RENDERS NOTHING OF ITS OWN. It builds the same rows the debrief would and
 * hands them to the same renderer; if the preview and the real slide ever
 * disagree, this endpoint has grown a second opinion and that is the bug.
 */
export const previewDebriefChart = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = previewSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Preview request is invalid.", issues: issues(parsed.error) });
      return;
    }

    const style = await DebriefChartStyle.findById(parsed.data.chartStyle).lean();
    if (!style) {
      res.status(404).json({ message: "Chart style not found." });
      return;
    }
    if (!style.shape?.trim()) {
      res.status(400).json({ message: "That chart style has no shape to render." });
      return;
    }

    let spec: unknown;
    try {
      spec = JSON.parse(style.shape);
    } catch {
      // The gallery stores the shape as text, so a malformed one is an
      // authoring mistake rather than a server fault.
      res.status(400).json({ message: "That chart style's shape is not valid JSON." });
      return;
    }

    const { buildPreviewDatasets } = await import("../services/debriefChartData");
    const datasets = await buildPreviewDatasets({
      simulationId: parsed.data.simulationId,
      roundNumber:  parsed.data.roundNumber,
      xAxis:        parsed.data.xAxis ?? null,
      yAxis:        parsed.data.yAxis ?? null,
      grouping:     parsed.data.grouping ?? null,
      productId:    parsed.data.productId ?? null,
    });

    const svg = await renderChartToSvg({ spec, datasets });
    res.status(200).json({ svg, rows: datasets.rows?.length ?? 0 });
  } catch (err: any) {
    // An unsafe or uncompilable spec is the AUTHOR's problem, not a 500 — and
    // saying which keeps the gallery author out of the server logs.
    if (err instanceof UnsafeSpecError) {
      res.status(400).json({ message: err.message });
      return;
    }
    res.status(400).json({ message: err?.message ?? "Failed to render the preview." });
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
