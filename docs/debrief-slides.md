# Debrief slides — user guide

The debrief is what a team reads between rounds: a set of charts showing what
just happened, each with your explanation of what it means.

---

> ## Round numbers start at 0
>
> Everywhere you are asked for a round number, **the first round is `0`**.
>
> | The round you mean | What you type |
> |---|---|
> | Round 1 | `0` |
> | Round 2 | `1` |
> | Round 3 | `2` |
>
> error — you simply get the wrong round's data, or a blank page. if the round has yet to be calculated. it will also show as blank

---

# Part 1 — Setting up the charts

**Page: `Debrief Charts`**

You do this once per simulation type. Every simulation of that type shares the
same set of charts.

## Before you start

Open the page and choose a **Simulation Type** from the dropdown. Nothing else
on the page works until you do.

If you see *"The chart gallery is empty"* in red, stop — a developer needs to
load the chart shapes before you can continue. You cannot fix this from here.

## Adding a chart

Fill in the row of fields at the bottom of the page, then press **Add chart**.

**Order** — where this chart appears in the slide.

**Slide group** — the heading this chart sits under. Charts sharing a group
appear together in one collapsible section. Type the same text for each chart
you want grouped — for example `Money`, `Market`, `Production`. 

**Chart name** — the heading the team reads above the chart.

**Scope** — the scope of the chart, whether it's overall or through a foreach loop

| Setting | What happens |
|---|---|
| `overall` | **One chart**, covering every notebook together |
| `each notebook` | **One chart per notebook** — three notebooks means three charts |

> If you want both an overall figure *and* a per-notebook breakdown, create
> **two separate charts**. There is no setting that gives you both at once.

**Shape** — what the chart looks like: bars, lines, a scatter. Pick whichever
suits the comparison. If nothing looks right, a developer can add a new shape.

**X** — the x-axis

**Y** — what is being measured: revenue, units sold, energy spent. You can pick
**more than one**. the chosen y-axis will appear as a tag. delete the tag by clicking 
on the X button

**Grouping** — splits each bar or line into several. For example, X = `Team`
and Grouping = `Product` gives you each team's bars broken down by notebook.

## Check it before you move on

At the bottom of the page is a **Preview** box. Fill in:

- **simulationId** — a long code identifying one running simulation. Copy it
  from the **Simulations** page.
- **round** — remember, first round is `0`.

Press **Render**. You will see the chart drawn with real data.

**Look at the row count under each chart.**

- A normal number — the chart is working.
- **`0 rows — the bindings matched no data`** in red — the chart will be blank
  for the team. Your X, Y or Grouping choice does not match anything in this
  simulation. Change one and Render again.

If you set Scope to `each notebook`, you should see **several charts**, one per
notebook. If you only see one, Scope is still set to `overall`.

## Changing or removing a chart

**Edit** reopens the chart's settings. **Delete** removes it.

> **Deleting a chart also deletes every explanation ever written for it**, in
> every round, for every simulation of this type. This cannot be undone.

> **Changing Scope after explanations have been written loses them.** Switching
> between `overall` and `each notebook` changes which charts exist, and the old
> text no longer has a chart to attach to.

Changing anything else — the name, the order, the measurements — is safe and
keeps the existing text.

## Voice of Customer

In the dropdown that normally reads `-- server-drawn --`, you may see
**Voice of customer (player-drawn)**.

This chart is drawn by the game itself, because it changes shape for every
simulation. Choose it and the Shape and X/Y/Grouping fields grey out — they
would be ignored.

Everything else still applies: it needs a name, a slide group, a scope, and an
explanation each round like any other chart. One thing is different: **it
always appears first**, no matter what Order you give it.

---

# Part 2 — Writing the debrief

**Page: `Round Debrief`**

You do this every round, for every simulation you are running.

## Before you start

**The round must be calculated first.** If the operator has not calculated the
round, the charts will be empty or missing. Calculating and closing a round are
two separate actions — ask whoever runs the simulation if you are unsure.

## Loading the round

1. Choose the **Simulation Type**
2. Choose the **Simulation** — the actual session you are running
3. Type the **round number** — first round is `0`
4. Press **Load**

You now see every chart for this simulation, drawn with this round's real
numbers, each with an empty text box underneath.

## Writing the explanations

Under each chart, write what it says. Press **Save**.

> ## A chart with no text is not shown to the team
>
> This is the most important thing on this page. An empty box does not mean
> "chart with no caption" — it means **the team never sees that chart at all**.
>
> **Before ending a round, scroll the whole page and check for empty boxes.**

Some practical notes:

- **Every box is separate.** If a chart is set to `each notebook`, you will see
  one box per notebook. Writing the first one does **not** cover the others.
- **Every round is separate.** The same chart in round 2 starts empty again.
  Nothing carries over.

# Glossary

**Simulation type** — the template. "Notebook Business" is a type; the session
you ran on Tuesday is a simulation *of* that type. Charts belong to the type.

**Simulation** — one actual session, with real teams playing it.

**Round** — one phase of play. Teams make decisions, the operator calculates
the round, then the debrief is written. **Numbered from 0.**

**Scope** — whether a chart covers everything at once (`overall`) or is
repeated for each notebook (`each notebook`).

**Slide group** — a heading that collects related charts into one section of
the debrief.

**Shape** — the visual form of a chart: bars, lines, scatter. Shapes are
created by developers and shared by every simulation type.

**Chart gallery** — the list of available shapes. A developer's page; you only
need to know it exists when the Shape dropdown is empty.

**Explanation / description** — your text under a chart. Without it, the chart
is hidden from the team.
