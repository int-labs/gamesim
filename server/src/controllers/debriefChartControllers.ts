import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import DebriefChart from "../models/debriefChart";
import DebriefChartStyle from "../models/debriefChartStyle";
import RoundNote from "../models/roundNote";
import { renderChartToSvg, UnsafeSpecError } from "../services/chartRenderer";
import { CLIENT_CHART_KEYS } from "../constants/clientCharts";
import { toMeasures } from "../services/debriefChartData";
import { axisLabel, measureLabel } from "../services/debriefDimensions";

/** A simulation type's configured charts. !important the axes are nullable: an unfinished chart saves and shows as-is. */

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
  // !important accepts a bare string and wraps it; documents before 2026-10-27 hold one.
  yAxis:      z.union([
                z.string().trim().max(64),
                z.array(z.string().trim().min(1).max(64)).max(12),
              ]).nullish().transform((v) => (v == null ? [] : Array.isArray(v) ? v : [v])),
  grouping:   z.string().trim().max(64).nullish(),
});

// `simulationTypeId` is omitted: moving a chart to another type is not an edit,
// it is a different chart, and its descriptions are keyed to this one.
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
      // Already an array, the schema's transform normalises it.
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
  /** The draft's name, drawn as the chart's title. The preview has no panel
   *  heading around it, unlike every surface that renders the real payload. */
  name: z.string().trim().max(160).nullish(),
  // A real simulation and round, not samples.
  simulationId: objectId,
  roundNumber:  z.number().int().min(0).max(999),
  xAxis:    z.string().trim().max(64).nullish(),
  yAxis:    z.union([
              z.string().trim().max(64),
              z.array(z.string().trim().min(1).max(64)).max(12),
            ]).nullish(),
  grouping: z.string().trim().max(64).nullish(),
  // !important the preview fans out too, or the operator approves one chart and the team sees four.
  scope:    z.enum(["overall", "each"]).default("overall"),
});

// POST /debrief-charts/preview: render a draft binding before it is saved.
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

    const { buildChartRows, chartInstances, loadPreviewPayload } =
      await import("../services/debriefChartData");

    // ONE LOAD for every instance, they all read the same round.
    const payload = await loadPreviewPayload({
      simulationId: parsed.data.simulationId,
      roundNumber:  parsed.data.roundNumber,
    });

    const measures = toMeasures(parsed.data.yAxis);
    const labels = {
      title: parsed.data.name || null,
      x: axisLabel(parsed.data.xAxis),
      y: measures.map(measureLabel).join(" · ") || null,
    };

    const instances = await Promise.all(
      chartInstances(parsed.data.scope, payload.products).map(async (inst) => {
        const rows = buildChartRows({
          payload,
          xAxis:     parsed.data.xAxis ?? null,
          yAxis:     parsed.data.yAxis ?? null,
          grouping:  parsed.data.grouping ?? null,
          productId: inst.productId,
        });
        const svg = await renderChartToSvg({
          spec,
          datasets: { rows },
          // The notebook's name rides on the title, so a column of previews
          // says which is which without the console labelling them itself.
          labels: inst.productName
            ? { ...labels, title: `${labels.title ?? ""} · ${inst.productName}`.trim() }
            : labels,
        });
        return { ...inst, svg, rows: rows.length };
      }),
    );

    res.status(200).json({ instances });
  } catch (err: any) {
    // An unsafe or uncompilable spec is the AUTHOR's problem, not a 500, and
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

    // !important its descriptions go with it, across every round.
    const { deletedCount } = await RoundNote.deleteMany({ chartId: chart._id });

    res.status(200).json({
      message: "Chart deleted.",
      descriptionsDeleted: deletedCount ?? 0,
    });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete the chart." });
  }
};
