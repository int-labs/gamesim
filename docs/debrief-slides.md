# Debrief slides — how to use them

The debrief is the slide a team reads between rounds: a set of charts about
what just happened, each with a facilitator's reading of it.

Three people build it, on three console pages, in this order. Each one depends
on the one before it.

```
  DEVELOPER          ADMIN / OPERATOR            FACILITATOR
  Chart Gallery  →   Debrief Charts         →    Round Debrief
  "what shapes      "which charts this          "what this chart
   can be drawn"     simulation type has"        says about round N"
  once per app       once per sim type           every round
```

> **There is no role enforcement.** All three pages are in the same console nav
> and anyone who can sign in can open any of them. The split below is about who
> *should* touch what, and what breaks downstream when the wrong person does.

---

## The model, in one paragraph

A **gallery shape** is a Vega-Lite spec with no idea what it plots — it is a
grouped bar chart, nothing more. A **configured chart** picks a shape and binds
it to data (`xAxis`, `yAxis`, `grouping`) for one simulation type. A **round
description** is the facilitator's text for that chart in that round. The
server joins all three, renders the chart to an SVG, and ships the picture and
the text to the player.

**A chart with no description for a round is not shown at all.** Not greyed,
not captionless — absent. An unwritten round is an empty debrief, by design.

---

## 1. Developer — Chart Gallery

**Page:** `Chart Gallery`  ·  **When:** once per app, rarely after that

This is the only page where you write chart grammar. A shape here is reusable
by every simulation type.

| Field | Meaning |
|---|---|
| `category` | the chart FAMILY — "bar chart", "2D chart" |
| `name` | the VARIANT — "Stacked Bar", "Scatter" |
| `shape` | a Vega-Lite spec, as text |

### The data contract

Every shape is handed rows of exactly this form, whatever it plots:

```json
{ "x": "Team Rocket", "y": 1240, "series": "Revenue" }
```

Bind to it with `{"values": "@name"}` — that is the only binding mechanism, and
an unknown name silently yields no rows.

- **`x` may be a string OR a number.** It is a number when the chart's `xAxis`
  is bound to a measure, which is what makes a scatter possible.
- **Do not name your axes.** A shape is picked by every chart that wants that
  form, so it cannot know what it is plotting. Axis titles are filled in per
  chart from its bindings, and they override whatever the shape declares.
- **Set `sort: null` on categorical axes.** Vega-Lite sorts a nominal domain
  alphabetically by default, so "Round 10" lands before "Round 2" and the team
  roster reorders between charts.
- **Stack with `y.stack`, not `transform`.** `transform` is on the deny list and
  a shape using one never renders.
- **A bar starts at zero; a point does not.** Scatter shapes set
  `scale: {zero: false}` on both axes.

### Seeding

```bash
cd server && npm run seed-db
```

Writes the six starter shapes (grouped / stacked / horizontal bar, line with
points, stacked area, scatter). It is **idempotent and deletes nothing** — it
upserts by fixed `_id`, which matters because configured charts hold a
reference to those ids.

> ⚠ Shapes live in the **database**. Editing `server/scripts/seed.ts` changes
> nothing until you re-run `seed-db`.

---

## 2. Admin / Operator — Debrief Charts

**Page:** `Debrief Charts`  ·  **When:** once per simulation type

This decides which charts a simulation type's debrief contains and what each
one plots. One type has one set, shared by every simulation under it.

Pick a Simulation Type first; nothing else works until you do.

| Field | What it does |
|---|---|
| `order` | position in the slide |
| `slide group` | the collapsible section this sits in (free text) |
| `chart name` | the heading the player reads |
| `scope` | `overall` = one chart; `each notebook` = one chart **per notebook** |
| `shape` | from the gallery. Empty gallery ⇒ nothing to pick |
| `x` / `y` / `grouping` | the bindings — never free text, always from the registry |

> ⚠ `category` and `name` **here** are the slide's group and display name. The
> gallery's two fields of the same names are the chart family and variant.
> Different namespaces, same two words.

### Bindings

The `x` and `grouping` dropdowns offer **dimensions** (team, round, product,
lever, spec, measure); `y` offers **measures** and is a list — pick several and
the chart plots all of them, split by measure.

A dimension **pivots** the measure, it does not merely label an axis. Binding
`lever` reads `energyByLever` at each key in turn, so one chart becomes a
breakdown. Teams are always iterated — the debrief is a cross-team comparison.

A binding the registry no longer offers (a renamed lever, say) is **kept and
marked `(missing)`**, never dropped silently.

### `scope: each` emits N charts, not N+1

There is no automatic summary. If a section needs both an overall figure and a
per-notebook breakdown, **make two entries** — they answer different questions
and want different copy.

> ⚠ Changing `scope` on a chart that already has copy **strands that copy**. The
> two scopes emit different instances, so existing descriptions lose the row
> that reached them. Nothing cascades; only deleting a chart cleans up.

### Preview before you leave the page

Enter a `simulationId` and a `roundNumber` (**0-based** — round 1 is `0`) and
press Render. It draws against real decision data and reports the row count
**per instance**. `0 rows` means the bindings matched nothing — that is the
diagnostic, and it is why the preview exists.

### Player-drawn charts

Setting `clientChart` (currently only Voice of Customer) means **the player
draws it** and the server renders nothing. The shape and binding controls grey
out, because they would be silently ignored. Order, slide group, name, scope
and the description all still apply — but a client-drawn chart always renders
**first**, whatever its `order`.

### Importing the legacy slide

```bash
cd server && npm run seed-db
cd server && npm run import-debrief-charts -- <simulationTypeId>
```

Writes the old hardcoded fifteen-slot slide in as ordinary, editable charts.
Idempotent on `{simulationTypeId, name}`; refuses if the gallery lacks the
shapes it needs, so run `seed-db` first.

---

## 3. Facilitator — Round Debrief

**Page:** `Round Debrief`  ·  **When:** every round, after it is calculated

Pick simulation type → simulation → round number (**0-based**) and Load.

You get every configured chart for that type, each **already rendered with this
round's data**, with a text box under it. Write what the chart says. Save.

**That text is what makes the chart visible to players.** No text, no chart.

- Descriptions are **per instance**. A `scope: each` chart has one box per
  notebook and there is no fallback between them — writing the summary does not
  cover the breakdown.
- Descriptions are **per round**. The same chart in round 2 is a separate,
  empty box.
- Staff see the rendered chart even before it has a description; players never
  do.

### You can fix the chart from here

Each chart has an **Edit** button that opens the same configuration form as the
Debrief Charts page. Writing the copy is when a wrong axis actually shows up,
and sending you to another page to fix it is how copy ends up written around
the mistake instead.

> ⚠ **The chart is not per round.** It belongs to the simulation TYPE, so an
> edit here lands on every round and every simulation under that type. Only the
> copy is per-round.

Only the first row of a `scope: each` chart opens the editor — the N rows are
one stored document.

---

## What the player sees

Charts with a description, sorted by `order`, cut into collapsible sections by
slide group. Client-drawn charts first. The player receives the **finished
SVG** and never the spec — there is no chart interpreter in the player, which
is the whole security argument for rendering server-side.

---

## When something looks wrong

| Symptom | Cause |
|---|---|
| Chart missing for a team | no description written for that round + instance |
| Only one chart where you expected several | `scope` is `overall`, not `each` |
| Preview shows `0 rows` | bindings matched no data — check x / y / grouping |
| Copy vanished | `scope` was changed after it was written |
| Chart is blank but the text is there | the shape failed to render; use Preview to see why |
| Configured and described, permanently empty | `clientChart` key with no drawing at the player end |
| Shape dropdown is empty | the gallery is empty — run `seed-db` |
| Edited a seeded shape, nothing changed | shapes live in the DB; re-run `seed-db` |

---

## Reference

| | |
|---|---|
| Gallery shapes | `DebriefChartStyle`, seeded by `server/scripts/seed.ts` |
| Configured charts | `DebriefChart`, per `simulationTypeId` |
| Round copy | `RoundNote`, keyed by chart `_id` + `productId` |
| Row builder | `server/src/services/debriefChartData.ts` |
| Renderer | `server/src/services/chartRenderer.ts` (vega 5, pinned) |
| Dimension registry | `server/src/services/debriefDimensions.ts` |
| Player arrangement | `notebook-pixel-sim/src/screens/LimboScreen.tsx` |
