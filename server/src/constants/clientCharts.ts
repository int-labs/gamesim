/**
 * Charts the PLAYER CLIENT draws itself.
 *
 * A configured chart binds to figures the server has already derived, and that
 * covers everything whose content is a number. These are the ones whose content
 * IS a derivation belonging to one simulation — the server cannot own the
 * formula, so it owns the SLOT and the client owns the drawing.
 *
 * ⚠ ADDING A KEY HERE DRAWS NOTHING BY ITSELF. The player maps the same key to
 * a component; a key with no component on the other side renders as a chart
 * that is configured, described, and blank. Keep the two in step.
 */

export interface ClientChart {
  key:   string;
  label: string;
  /** What the operator needs to know when picking it — these charts ignore the
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
