/** Charts the player client draws itself, because their content is a per-sim derivation the server cannot bind. */

export interface ClientChart {
  key:   string;
  label: string;
  /** What the operator needs to know when picking it, these charts ignore the
   *  shape and the bindings entirely. */
  note:  string;
}

export const CLIENT_CHARTS: ClientChart[] = [
  {
    key:   "voc",
    label: "Voice of customer",
    note:
      "Drawn by the player. Its weights come from the simulation's own " +
      "calculation layer, so it takes no shape and no axes. Use scope " +
      "\"each notebook\" — the summary instance merges every notebook.",
  },
];

export const CLIENT_CHART_KEYS = CLIENT_CHARTS.map((c) => c.key);
