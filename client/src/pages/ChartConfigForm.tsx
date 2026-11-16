import { Badge, FilterChip, Input, Select, Text } from "@stratagem/design-system";
import type { DebriefChartStyle, DebriefDimension, DebriefDimensions } from "../types";

/** One chart's configuration as a form, shared by the Debrief Charts and Round Debrief pages. Fields only, not the buttons. */

/** The form's own shape; `null` enters only at `chartPayload`. */
export interface ChartDraft {
  name:       string;
  category:   string;
  order:      number;
  scope:      "overall" | "each";
  chartStyle: string;
  /** Set means the player draws it, and the shape and bindings below are inert. */
  clientChart: string;
  xAxis:      string;
  /** The measures plotted. Several means the series is the MEASURE, picking a
   *  second one is how "units sold vs customers obtained" is authored. */
  yAxis:      string[];
  grouping:   string;
}

export const EMPTY_CHART: ChartDraft = {
  name: "", category: "", order: 0, scope: "overall",
  chartStyle: "", clientChart: "", xAxis: "", yAxis: [], grouping: "",
};

/** Anything carrying a chart's configuration; structural because the two sources differ elsewhere. */
export interface ChartConfigLike {
  name:     string;
  category: string;
  order:    number;
  scope?:   "overall" | "each";
  chartStyle: { _id: string } | null;
  clientChart?: string | null;
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
  chartStyle:  c.chartStyle?._id ?? "",
  clientChart: c.clientChart ?? "",
  xAxis:      c.xAxis ?? "",
  yAxis:      Array.isArray(c.yAxis) ? c.yAxis : c.yAxis ? [c.yAxis] : [],
  grouping:   c.grouping ?? "",
});

/** !important empty string becomes null, or an axis stores as a dimension named nothing. */
export const chartPayload = (d: ChartDraft) => ({
  name:       d.name,
  category:   d.category,
  order:      Number(d.order) || 0,
  scope:      d.scope,
  chartStyle:  d.chartStyle || null,
  clientChart: d.clientChart || null,
  xAxis:      d.xAxis || null,
  // An ARRAY even when empty, "no measures" is a valid half-configured chart,
  // and null would reintroduce the two-shapes-for-one-field problem.
  yAxis:      d.yAxis,
  grouping:   d.grouping || null,
});

/** A binding's human label, or the raw field marked when the registry no longer offers it. */
export function dimLabel(dims: DebriefDimensions, field: string | null) {
  if (!field) return <Text as="span" tone="faint">—</Text>;
  const hit = [...dims.categorical, ...dims.measures].find((d) => d.field === field);
  if (hit) return hit.label;
  return <Text as="span" tone="danger">{field} (missing)</Text>;
}

/** !important a saved value the registry no longer offers is kept and marked, never dropped. */
export function DimensionSelect({
  label, options, measures = [], value, onChange,
}: {
  label: string;
  options: DebriefDimension[];
  /** Offered under their own heading, x accepts one, which is what makes a
   *  scatter possible. Grouping passes none: a series is always a category. */
  measures?: DebriefDimension[];
  value: string;
  onChange: (v: string) => void;
}) {
  const known = [...options, ...measures].some((o) => o.field === value);
  return (
    <Select
      size="sm"
      width="fit"
      aria-label={label}
      placeholder={`-- ${label} --`}
      value={value || null}
      onValueChange={(v) => onChange(v ?? "")}
      error={value && !known ? `"${value}" is not offered by this type any more` : undefined}
      options={[
        ...(value && !known ? [{ value, label: `${value} (missing)` }] : []),
        ...options.map((o) => ({ value: o.field, label: o.label })),
        // A measure on x makes the axis numeric, which only a scatter draws sensibly
        ...measures.map((o) => ({ value: o.field, label: o.label, detail: <Badge tone="info">scatter</Badge> })),
      ]}
    />
  );
}

/** !important the select never holds a value; it is an add control, and the chips are the binding. */
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
    <span className="inline-flex flex-wrap items-center gap-1">
      {value.map((field) => {
        const known = options.some((o) => o.field === field);
        return (
          <FilterChip
            key={field}
            title={known ? field : `"${field}" is not offered by this type any more`}
            onRemove={() => onChange(value.filter((f) => f !== field))}
            removeLabel="remove this measure"
          >
            {/* !important a measure the registry no longer offers is kept and marked. */}
            {known ? labelFor(field) : <Text as="span" tone="danger">{field} (missing)</Text>}
          </FilterChip>
        );
      })}
      <Select
        size="sm"
        width="fit"
        aria-label="y"
        placeholder={value.length ? "-- add y --" : "-- y --"}
        value={null}
        onValueChange={(v) => { if (v) onChange([...value, v]); }}
        disabled={remaining.length === 0}
        options={remaining.map((o) => ({ value: o.field, label: o.label }))}
      />
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

  // !important disabled, not hidden: a client-drawn chart ignores these controls.
  const drawnByClient = draft.clientChart !== "";
  const chosen = dims.clientCharts?.find((c) => c.key === draft.clientChart);

  return (
    <>
      <Input
        size="sm" className="w-20" aria-label="order"
        type="number" placeholder="order" value={draft.order}
        onChange={(e) => set({ order: Number(e.target.value) })}
      />
      <Input
        size="sm" className="w-36" aria-label="slide group"
        placeholder="slide group" value={draft.category}
        onChange={(e) => set({ category: e.target.value })}
      />
      <Input
        size="sm" className="w-44" aria-label="chart name"
        placeholder="chart name" value={draft.name}
        onChange={(e) => set({ name: e.target.value })}
      />
      <span title="each = one chart per notebook, each needing its own description. A summary is a separate chart with scope overall.">
        <Select<"overall" | "each">
          size="sm"
          width="fit"
          aria-label="scope"
          value={draft.scope}
          onValueChange={(v) => v && set({ scope: v })}
          options={[
            { value: "overall", label: "overall" },
            { value: "each", label: "each notebook" },
          ]}
        />
      </span>
      <span title="charts the player draws itself — they take no shape and no axes">
        <Select
          size="sm"
          width="fit"
          aria-label="drawn by"
          placeholder="-- server-drawn --"
          value={draft.clientChart || null}
          onValueChange={(v) => set({ clientChart: v ?? "" })}
          options={[
            { value: "", label: "-- server-drawn --" },
            ...(dims.clientCharts ?? []).map((c) => ({ value: c.key, label: `${c.label} (player-drawn)` })),
          ]}
        />
      </span>

      <Select
        size="sm"
        width="fit"
        aria-label="shape"
        placeholder="-- shape --"
        value={draft.chartStyle || null}
        onValueChange={(v) => set({ chartStyle: v ?? "" })}
        disabled={drawnByClient}
        options={[
          { value: "", label: "-- shape --" },
          ...styles.map((s) => ({ value: s._id, label: s.category ? `${s.category} / ${s.name}` : s.name })),
        ]}
      />
      {/* X and grouping divide, Y is plotted, so they come from different halves of the registry. */}
      {drawnByClient ? (
        <Text as="span" variant="caption" tone="muted" className="max-w-96">
          {chosen?.note ?? "Drawn by the player; it takes no shape and no axes."}
        </Text>
      ) : (
        <>
          <DimensionSelect label="x" options={dims.categorical} measures={dims.measures}
                           value={draft.xAxis} onChange={(v) => set({ xAxis: v })} />
          <MeasureList options={dims.measures}
                       value={draft.yAxis} onChange={(v) => set({ yAxis: v })} />
          <DimensionSelect label="grouping" options={dims.categorical}
                           value={draft.grouping} onChange={(v) => set({ grouping: v })} />
        </>
      )}
    </>
  );
}
