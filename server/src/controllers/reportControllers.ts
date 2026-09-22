import { Request, Response } from "express";
import { buildRoundReport, type ReportKind } from "../services/roundReport";
import { writeReportPdf } from "../services/reportPdf";

/**
 * The round reports, as a PDF download.
 *
 *   GET /reports/decisions?simulationId=&roundNumber=
 *   GET /reports/competitor?simulationId=&roundNumber=
 *
 * ── ORDER MATTERS HERE ──────────────────────────────────────────────────────
 * The matrix is BUILT before a single header is written. Once `res` has a
 * status and a Content-Type it is committed, and a failure after that point can
 * only truncate the download — the operator gets a corrupt PDF instead of a
 * readable "no decisions for round 2". So every way this can fail is made to
 * fail first.
 */

const KINDS: ReportKind[] = ["decisions", "competitor"];

export const getRoundReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const kind = req.params.kind as ReportKind;
    if (!KINDS.includes(kind)) {
      res.status(404).json({ message: `Unknown report "${kind}". Try: ${KINDS.join(", ")}.` });
      return;
    }

    const simulationId = String(req.query.simulationId ?? "");
    const roundRaw = req.query.roundNumber;

    if (!simulationId || roundRaw === undefined) {
      res.status(400).json({ message: "simulationId and roundNumber are required." });
      return;
    }
    const roundNumber = Number(roundRaw);
    // `roundNumber` is 0-BASED, so 0 is valid and `!roundNumber` would reject
    // the first round of every simulation.
    if (!Number.isInteger(roundNumber) || roundNumber < 0) {
      res.status(400).json({ message: "roundNumber must be a non-negative integer." });
      return;
    }

    const report = await buildRoundReport({ simulationId, roundNumber, kind });

    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    // `attachment` so a browser saves it rather than rendering it in a tab the
    // operator then has to re-save by hand.
    res.setHeader("Content-Disposition", `attachment; filename="${report.filename}"`);
    // The admin console reads the name off this to save the blob under it —
    // a cross-origin fetch cannot see Content-Disposition otherwise.
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, X-Report-Filename");
    res.setHeader("X-Report-Filename", report.filename);

    await writeReportPdf(res, report.matrix, {
      title: report.title,
      subtitle: report.subtitle,
    });
  } catch (err: any) {
    // Only reachable while the response is still uncommitted — see the note
    // above. If it somehow is not, say so in the log rather than appending
    // JSON to a half-written PDF.
    if (res.headersSent) {
      console.error("[report] failed after streaming began:", err?.message);
      res.end();
      return;
    }
    res.status(400).json({ message: err?.message ?? "Failed to build the report." });
  }
};
