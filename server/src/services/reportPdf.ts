/**
 * A report matrix, rendered to PDF on a stream.
 *
 * STREAM, not a file path: the same function serves an HTTP response and a
 * file on disk, so the endpoint and the CLI cannot drift into two renderers.
 *
 * Courier and a fixed-width layout, because the whole point of the matrix is
 * that a reader scans DOWN a team's column — a proportional face breaks that
 * alignment. Landscape for the same reason: columns are teams and they must
 * fit. Base-14 fonts only, so no font file ships with this.
 */

import PDFDocument from "pdfkit";
import type { Writable } from "stream";
import type { ReportMatrix } from "./reportMatrix";

const PAGE = { size: "A4" as const, layout: "landscape" as const, margin: 36 };
const FONT_SIZE = 8;
const LINE_H = 10.5;
/** Courier's advance width is exactly 0.6 em at any size. */
const CHAR_W = FONT_SIZE * 0.6;

/** Column caps, sized to real content: a 26-cap truncated
 *  "Notebook: Minimalist Notebook" to a heading nobody could identify. */
const CAP_SECTION = 34;
const CAP_LABEL   = 48;
const CAP_TEAM    = 18;

const pad     = (s: string, w: number) => (s.length >= w ? s.slice(0, w) : s + " ".repeat(w - s.length));
const padLeft = (s: string, w: number) => (s.length >= w ? s.slice(0, w) : " ".repeat(w - s.length) + s);

export interface ReportPdfMeta {
  title:     string;
  subtitle?: string;
}

/**
 * Render and resolve once the bytes are FLUSHED.
 *
 * Awaiting matters: pdfkit writes through a stream, so without it a caller can
 * report success — or end an HTTP response — before the file exists.
 *
 * NOTE ON GLYPHS: the base-14 fonts are WinAnsi-encoded. "·" (U+00B7), "—"
 * (U+2014) and "×" (U+00D7) are in that set; U+2212 MINUS is NOT and renders as
 * a substituted glyph. Use an ASCII hyphen in any text passed here.
 */
export function writeReportPdf(
  out: Writable,
  matrix: ReportMatrix,
  meta: ReportPdfMeta,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument(PAGE);
    out.on("finish", () => resolve());
    out.on("error", reject);
    doc.on("error", reject);
    doc.pipe(out);

    const { header, rows } = matrix;
    const colCount = header.length;

    // Widths from the CONTENT, so a long product or team name is never
    // truncated by a guess.
    const all = [header, ...rows.filter((r) => r.length > 0)];
    const widths: number[] = [];
    for (let c = 0; c < colCount; c++) {
      const longest = all.reduce((w, r) => Math.max(w, String(r[c] ?? "").length), 0);
      widths.push(Math.min(longest, c === 0 ? CAP_SECTION : c === 1 ? CAP_LABEL : CAP_TEAM));
    }

    const usable = doc.page.width - PAGE.margin * 2;

    // Truncation is a LAST resort, so SAY when a roster will not fit rather
    // than silently clipping columns off the right edge.
    const lineChars = widths.reduce((a, w) => a + w, 0) + (colCount - 1) * 2;
    if (lineChars * CHAR_W > usable) {
      console.warn(
        `[report] ${colCount - 2} teams need ${Math.ceil(lineChars * CHAR_W)}pt but the page ` +
        `gives ${Math.floor(usable)}pt — right-hand columns will be clipped.`,
      );
    }

    const line = (cols: string[], rightAlign = true) =>
      cols
        .map((v, c) => {
          const s = String(v ?? "");
          // Labels left, figures right, so a decimal point lines up down a
          // team's column.
          return c < 2 || !rightAlign ? pad(s, widths[c]) : padLeft(s, widths[c]);
        })
        .join("  ");

    let y = 0;
    // The header REPEATS on every page: a column of bare numbers with the team
    // names left behind on page one is not a report anyone can read.
    const startPage = (first: boolean) => {
      if (!first) doc.addPage(PAGE);
      y = PAGE.margin;
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#000")
        .text(meta.title, PAGE.margin, y, { width: usable });
      y += 16;
      if (meta.subtitle) {
        doc.font("Helvetica").fontSize(8).fillColor("#444")
          .text(meta.subtitle, PAGE.margin, y, { width: usable });
        y += 12;
      }
      y += 4;
      doc.font("Courier-Bold").fontSize(FONT_SIZE).fillColor("#000")
        .text(line(header, false), PAGE.margin, y);
      y += LINE_H;
      doc.moveTo(PAGE.margin, y).lineTo(PAGE.margin + usable, y).strokeColor("#999").stroke();
      y += 4;
      doc.font("Courier").fontSize(FONT_SIZE).fillColor("#000");
    };

    startPage(true);
    const bottom = doc.page.height - PAGE.margin;

    for (const r of rows) {
      if (y + LINE_H > bottom) startPage(false);
      // A `[]` row is a section separator — kept as vertical space rather than
      // dropped, because it is what groups the sections.
      if (r.length === 0) { y += LINE_H * 0.6; continue; }
      doc.text(line(r), PAGE.margin, y, { lineBreak: false });
      y += LINE_H;
    }

    doc.end();
  });
}
