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
/** The notebook headers on the analysis report, which name the archetype the
 *  blocks beneath belong to. 17.5 on an 8pt body is deliberate — it has to break
 *  a page of uniform monospace at a glance. */
const HEADING_SIZE   = 17.5;
const HEADING_LINE_H = 23;
/** Courier's advance width is exactly 0.6 em at any size. */
const CHAR_W = FONT_SIZE * 0.6;

/** Column caps, sized to real content: a 26-cap truncated
 *  "Notebook: Minimalist Notebook" to a heading nobody could identify. */
// 40, not 34: the analysis report's derived sections are
// "Weighted Score: <notebook>" and "Share of Score: <notebook>", which reach 35
// characters on the longest product name. A 34-cap cut them mid-word.
const CAP_SECTION = 40;
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

    /** `from` is the index in `widths` that `cols[0]` corresponds to — body
     *  rows draw their section cell separately (in bold) and pass the rest at
     *  offset 1, so the column widths must not shift with them. */
    const line = (cols: string[], rightAlign = true, from = 0) =>
      cols
        .map((v, c) => {
          const i = c + from;
          const s = String(v ?? "");
          // Labels left, figures right, so a decimal point lines up down a
          // team's column.
          return i < 2 || !rightAlign ? pad(s, widths[i]) : padLeft(s, widths[i]);
        })
        .join("  ");

    /**
     * Where the ANALYSIS columns end and the TEAM columns begin.
     *
     * The lead columns are `Section | Label` plus `Weight` when the matrix
     * carries one, so this is derived from the header's own length rather than
     * a constant — the analysis report has three lead columns and the
     * competitor report two, and a hardcoded index would put the rule through
     * the middle of a team on one of them.
     *
     * Sits in the CENTRE of the two-space gutter, so it separates without
     * crowding either side.
     */
    const leadCols  = header.length - matrix.teamCount;
    const leadChars = widths.slice(0, leadCols).reduce((a, w) => a + w + 2, 0);
    const dividerX  = PAGE.margin + (leadChars - 1) * CHAR_W;

    let y = 0;
    /** Top of the current page's body, so the divider can be drawn as ONE
     *  stroke per page once its extent is known. */
    let bodyTop = 0;

    const drawDivider = () => {
      if (y <= bodyTop) return;
      doc.moveTo(dividerX, bodyTop).lineTo(dividerX, y)
        .strokeColor("#999").lineWidth(0.5).stroke();
    };

    // The header REPEATS on every page: a column of bare numbers with the team
    // names left behind on page one is not a report anyone can read.
    const startPage = (first: boolean) => {
      if (!first) { drawDivider(); doc.addPage(PAGE); }
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
      bodyTop = y;
      doc.font("Courier").fontSize(FONT_SIZE).fillColor("#000");
    };

    startPage(true);
    const bottom = doc.page.height - PAGE.margin;

    // Where the section column ends, so a bold name and the regular remainder
    // butt up exactly as one padded line would have.
    const sectionW = (widths[0] + 2) * CHAR_W;

    const labelW = (widths[1] + 2) * CHAR_W;

    /**
     * A GROUP HEADER in the label column — `Design Notebook`, `Marketing`,
     * `Sales Channel`.
     *
     * Detected STRUCTURALLY: a row whose own label is not indented and whose
     * NEXT row's is. The cascade emits children as `"  " + label`, so a parent
     * is exactly a row that has some. No marker is threaded through the matrix
     * for this, and no list of group names is duplicated here — a new group gets
     * bolded because of its shape, not because it was named twice.
     */
    const isGroupHeader = (i: number): boolean => {
      const here = rows[i];
      if (!here || here.length < 2 || here[1] === "" || here[1].startsWith(" ")) return false;
      const next = rows[i + 1];
      return !!next && next.length > 1 && next[1].startsWith("  ");
    };

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      // A NOTEBOOK HEADER: a section name with every other cell empty. The
      // analysis report pushes one of these above each notebook's blocks, and it
      // is the only row that carries no figures at all — so detecting the shape
      // needs no flag threaded through the matrix.
      const isHeading = r.length > 0 && r[0] !== "" && r.slice(1).every((v) => !v);

      if (y + (isHeading ? HEADING_LINE_H : LINE_H) > bottom) startPage(false);

      if (isHeading) {
        // Drawn UNPADDED and at full width: it sits alone on the line, so the
        // section column's 40-char cap does not apply and a long notebook name
        // is not truncated.
        doc.font("Courier-Bold").fontSize(HEADING_SIZE)
          .text(String(r[0]), PAGE.margin, y, { lineBreak: false });
        doc.font("Courier").fontSize(FONT_SIZE);
        y += HEADING_LINE_H;
        continue;
      }

      // A `[]` row is a section separator, drawn as a RULE. It used to be bare
      // vertical space, which left the eye to infer the grouping on a page of
      // uniform monospace.
      if (r.length === 0) {
        y += LINE_H * 0.35;
        doc.moveTo(PAGE.margin, y).lineTo(PAGE.margin + usable, y)
          .strokeColor("#CCC").lineWidth(0.5).stroke();
        y += LINE_H * 0.35;
        continue;
      }

      // The SECTION NAME in bold, the rest regular. Two draws rather than one,
      // because pdfkit sets the font per call — and `collapseSectionRuns` has
      // already blanked the name on every row but the first of its run, so this
      // bolds exactly the heading rows.
      const [section, label, ...figures] = r;
      if (section) {
        doc.font("Courier-Bold").text(pad(section, widths[0]), PAGE.margin, y, { lineBreak: false });
        doc.font("Courier");
      }

      // TOTALS bold too — `Total`, `Total Capacity`, `Total Inventory`. Matched
      // on the label's opening word rather than a list, so a new total row is
      // bolded by what it says rather than by being remembered here.
      const isTotal = String(label ?? "").trim().startsWith("Total");

      // A group header or a total takes a THIRD draw: its label is bold while
      // the figures beside it stay regular, so the hierarchy reads without
      // indentation alone having to carry it.
      if (isGroupHeader(i) || isTotal) {
        doc.font("Courier-Bold")
          .text(pad(String(label ?? ""), widths[1]), PAGE.margin + sectionW, y, { lineBreak: false });
        doc.font("Courier");
        doc.text(line(figures, true, 2), PAGE.margin + sectionW + labelW, y, { lineBreak: false });
      } else {
        doc.text(line([label, ...figures], true, 1), PAGE.margin + sectionW, y, { lineBreak: false });
      }
      y += LINE_H;
    }

    drawDivider();
    doc.end();
  });
}
