import type { DebriefChartStyle, DebriefDimension, DebriefDimensions } from "../types";

/**
 * One chart's configuration, as a form.
 *
 * ── WHY THIS IS SHARED ──────────────────────────────────────────────────────
 * Two surfaces edit a chart: the Debrief Charts page, where a type's slide is
 * laid out, and the Round Debrief page, where copy is written and a chart that
 * reads wrong needs fixing on the spot. A second copy of these fields is a
 * second opinion about what a chart IS — the kind that drifts until one page
 * silently drops a field on save and the other keeps setting it.
 *
 * It renders the FIELDS only, not the buttons: "Add chart" and "Save" mean
 * different things and belong to the page that owns the action.
 */

/** The form's own shape. Every slot is a string or number — `null` enters only
 *  at `chartPayload`, so an empty select and an unset binding stay the same
 *  thing while the operator is typing. */
export interface ChartDraft {
  name:       string;
  category:   string;
  order:      number;
  scope:      "overall" | "each";
  chartStyle: string;
  xAxis:      string;
  /** The measures plotted. Several means the series is the MEASURE — picking a
   *  second one is how "units sold vs customers obtained" is authored. */
  yAxis:      string[];
  grouping:   string;
}

export const EMPTY_CHART: ChartDraft = {
  name: "", category: "", order: 0, scope: "overall",
  chartStyle: "", xAxis: "", yAxis: [], grouping: "",
};

/** Anything carrying a chart's configuration — the stored document, or one of
 *  the instances `/round-debrief` emits. Structural on purpose: the two differ
 *  in fields this form does not touch. */
export interface ChartConfigLike {
  name:     string;
  category: string;
  order:    number;
  scope?:   "overall" | "each";
  chartStyle: { _id: string } | null;
  xAxis:    string | null;
  /** Tolerates the pre-2026-10-27 bare string, so a document the server has
   *  not normalised still opens in the editor. */
  yAxis:    string[] | string | null;
  grouping: string | null;
}

export const draftFromChart = (c: ChartConfigLike): ChartDraft => ({
  name:       c.name,
  category:   c.category,
  order:      c.order,
  scope:      c.scope ?? "overall",
  chartStyle: c.chartStyle?._id ?? "",
  xAxis:      c.xAxis ?? "",
  yAxis:      Array.isArray(c.yAxis) ? c.yAxis : c.yAxis ? [c.yAxis] : [],
  grouping:   c.grouping ?? "",
});

/**
 * The draft as the API takes it.
 *
 * ⚠ EMPTY STRING BECOMES NULL. The axes are nullable and `""` would store as a
 * configured dimension named nothing — which renders no rows and reads, in the
 * table, exactly like a binding that was never set.
 */
export const chartPayload = (d: ChartDraft) => ({
  name:       d.name,
  category:   d.category,
  order:      Number(d.order) || 0,
  scope:      d.scope,
  chartStyle: d.chartStyle || null,
  xAxis:      d.xAxis || null,
  // An ARRAY even when empty — "no measures" is a valid half-configured chart,
  // and null would reintroduce the two-shapes-for-one-field problem.
  yAxis:      d.yAxis,
  grouping:   d.grouping || null,
});

/** A binding's human label, or the raw field marked when the registry no longer
 *  offers it — the same rule the select follows, so a table and a form cannot
 *  disagree about whether a chart is bound to something real. */
export function dimLabel(dims: DebriefDimensions, field: string | null) {
  if (!field) return <span style={{ color: "#bbb" }}>—</span>;
  const hit = [...dims.categorical, ...dims.measures].find((d) => d.field === field);
  if (hit) return hit.label;
  return <span style={{ color: "#b00" }}>{field} (missing)</span>;
}

/**
 * One binding slot.
 *
 * ⚠ A SAVED VALUE THE REGISTRY NO LONGER OFFERS IS KEPT AND MARKED, not dropped
 * silently. A lever renamed on the GlobalInputs page takes its dimension with
 * it, and a select that simply showed blank would look like the operator had
 * never set one — then overwrite it on the next save.
 */
export function DimensionSelect({
  label, options, measures = [], value, onChange,
}: {
  label: string;
  options: DebriefDimension[];
  /** Offered under their own heading — x accepts one, which is what makes a
   *  scatter possible. Grouping passes none: a series is always a category. */
  measures?: DebriefDimension[];
  value: string;
  onChange: (v: string) => void;
}) {
  const known = [...options, ...measures].some((o) => o.field === value);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ maxWidth: 190, ...(value && !known ? { color: "#b00" } : {}) }}
      title={value && !known ? `"${value}" is not offered by this type any more` : undefined}
    >
      <option value="">-- {label} --</option>
      {value && !known && <option value={value}>{value} (missing)</option>}
      {options.map((o) => (
        <option key={o.field} value={o.field}>{o.label}</option>
      ))}
      {measures.length > 0 && (
        // Grouped, because picking one here changes what KIND of chart this is:
        // a measure on x makes the axis numeric, which only a scatter-ish shape
        // draws sensibly.
        <optgroup label="— as a value (scatter) —">
          {measures.map((o) => (
            <option key={o.field} value={o.field}>{o.label}</option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

/**
 * The measures, as an add-one-at-a-time list.
 *
 * ⚠ THE SELECT NEVER HOLDS A VALUE. It is an ADD control, not a binding —
 * picking resets it to the placeholder and appends a chip. A select showing
 * "Revenue" while three measures are bound would be lying about which one it
 * meant, and it is the chips that say what the chart plots.
 *
 * Order is the pick order, and it is load-bearing: with several measures the
 * first is what a half-bound chart falls back to, and the series legend reads
 * in this sequence.
 */
function MeasureList({
  options, value, onChange,
}: {
  options: DebriefDimension[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const labelFor = (field: string) =>
    options.find((o) => o.field === field)?.label ?? field;

  // Already-picked measures leave the dropdown: the same measure twice draws
  // two identical series on top of each other.
  const remaining = options.filter((o) => !value.includes(o.field));

  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
      {value.map((field) => {
        const known = options.some((o) => o.field === field);
        return (
          <span
            key={field}
            title={known ? field : `"${field}" is not offered by this type any more`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              border: `1px solid ${known ? "#ccd" : "#b00"}`,
              background: known ? "#eef2f8" : "#fdeaea",
              color: known ? "#334" : "#b00",
              borderRadius: 10, padding: "1px 4px 1px 8px", fontSize: 12,
            }}
          >
            {/* ⚠ A MEASURE THE REGISTRY NO LONGER OFFERS IS KEPT AND MARKED,
                never dropped on open — otherwise it looks like it was never
                set, and the next save removes it for real. */}
            {known ? labelFor(field) : `${field} (missing)`}
            <button
              onClick={() => onChange(value.filter((f) => f !== field))}
              title="remove this measure"
              style={{
                border: "none", background: "none", cursor: "pointer",
                fontSize: 13, lineHeight: 1, padding: "0 2px", color: "inherit",
              }}
            >
              ×
            </button>
          </span>
        );
      })}
      <select
        value=""
        onChange={(e) => { if (e.target.value) onChange([...value, e.target.value]); }}
        disabled={remaining.length === 0}
        style={{ maxWidth: 190 }}
      >
        <option value="">{value.length ? "-- add y --" : "-- y --"}</option>
        {remaining.map((o) => (
          <option key={o.field} value={o.field}>{o.label}</option>
        ))}
      </select>
    </span>
  );
}

export function ChartConfigFields({
  draft, styles, dims, onChange,
}: {
  draft:   ChartDraft;
  styles:  DebriefChartStyle[];
  dims:    DebriefDimensions;
  onChange: (next: ChartDraft) => void;
}) {
  const set = (patch: Partial<ChartDraft>) => onChange({ ...draft, ...patch });

  return (
    <>
      <input
        type="number" placeholder="order" value={draft.order}
        onChange={(e) => set({ order: Number(e.target.value) })}
        style={{ width: 70 }}
      />
      <input
        placeholder="slide group" value={draft.category}
        onChange={(e) => set({ category: e.target.value })}
        style={{ width: 130 }}
      />
      <input
        placeholder="chart name" value={draft.name}
        onChange={(e) => set({ name: e.target.value })}
        style={{ width: 180 }}
      />
      <select
        value={draft.scope}
        onChange={(e) => set({ scope: e.target.value as "overall" | "each" })}
        title="each = one chart per notebook plus an all-notebooks summary, each needing its own description"
      >
        <option value="overall">overall</option>
        <option value="each">each notebook</option>
      </select>
      <select
        value={draft.chartStyle}
        onChange={(e) => set({ chartStyle: e.target.value })}
      >
        <option value="">-- shape --</option>
        {styles.map((s) => (
          <option key={s._id} value={s._id}>
            {s.category ? `${s.category} / ${s.name}` : s.name}
          </option>
        ))}
      </select>
      {/* X and GROUPING divide, Y is plotted — so they are drawn from different
          halves of the registry. These were free text until the registry
          existed, and a typo then saved fine and silently never resolved. */}
      <DimensionSelect label="x" options={dims.categorical} measures={dims.measures}
                       value={draft.xAxis} onChange={(v) => set({ xAxis: v })} />
      <MeasureList options={dims.measures}
                   value={draft.yAxis} onChange={(v) => set({ yAxis: v })} />
      <DimensionSelect label="grouping" options={dims.categorical}
                       value={draft.grouping} onChange={(v) => set({ grouping: v })} />
    </>
  );
}
