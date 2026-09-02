# gamesim server — architecture

The authority for **what this backend currently is**. If a code comment and this
file disagree, the code wins and this file is a bug.

Scope: the data model, who owns which number, and the order things must run in.
Setup and endpoint lists live in the [root README](../README.md). Guidance on
working with Claude in this repo lives in
[`notebook-pixel-sim/CLAUDE.md`](../notebook-pixel-sim/CLAUDE.md) and is
deliberately kept free of present-state context, because that context changes
and instructions about tooling do not.

- [The four collections](#the-four-collections)
- [Round numbering](#round-numbering)
- [Calculation order](#calculation-order)
- [The money chain](#the-money-chain)
- [Score](#score)
- [What freezes a round](#what-freezes-a-round)
- [Resetting a round](#resetting-a-round)
- [Invariants](#invariants)

---

## The four collections

Each has exactly one job. Overlap between them is the defect this design exists
to prevent — two documents holding the same number can disagree, and one of them
will be read by mistake.

| Collection | Key | Its one job |
|---|---|---|
| **`Decision`** | `(simulationId, teamId, roundNumber)` | What the team CHOSE, and what it SCORED. `scored[productId]` holds the official financials. Immutable once the round closes. |
| **`Projections`** | `(simulationId, teamId, roundNumber)` | LIVE WHAT-IF ONLY. Rewritten on every player edit. Never authoritative. |
| **`Results`** | `(simulationId, roundNumber, productId, segmentId)` | The market model's own output: `weightedScores` and `marketShares` per team. |
| **`Round`** | `(simulationId, roundNumber)` | The indicator: `status`, `timer`, ordering. No financial data. |

**`Decision.scored` is the official record.** Written once, by the round close,
and never by the recalc — which is what makes it official.

- shape: [`models/decisions.ts:164`](src/models/decisions.ts#L164) · type [`ScoredMetrics`](src/sim/calcFinancials.ts#L216)
- written: [`roundCalculation.ts:304`](src/services/roundCalculation.ts#L304) — `updateOne`, never an upsert
- unique index: [`models/decisions.ts:173`](src/models/decisions.ts#L173)

Storing it here rather than on `Projections` is what makes **carry-forward stock
immutable**: round N reads round N−1's `scored[productId].closingStock`, so a
team's opening stock can never be whatever their last speculative edit said.

The metric block is shaped by one function,
[`toProjectionMetrics`](src/sim/calcFinancials.ts#L179), called by both money
paths so a field added to the sheet reaches the live projection and the official
close together, or not at all. `marketShare` is deliberately **not** in it — the
recalc has no competed share, and the round close spreads it in on top.

> `Projections`' own TypeScript interface types every metric as `number`, which
> is false: `productCostBreakdown` and `incurredCosts` are arrays of objects.
> The field is `Schema.Types.Mixed`, so Mongo stores them correctly — but code
> typed against that model cannot see them.
> [`models/projections.ts:23`](src/models/projections.ts#L23)

## Round numbering

**`Round.roundNumber` is 0-BASED.** A three-round simulation has rounds `0, 1,
2`. Round 0 is real and matters.

**`config.totalRounds` is a COUNT, not an index.** `totalRounds: 3` → round
numbers `0..2` → the player client's display phases `1..3`. Therefore:

- a round-number test for the last round is `roundNumber >= totalRounds - 1`
- a display-phase test is `phase >= totalRounds`

The client displays 1-based phases, and the conversion happens in exactly one
place — `phaseFromRoundNumber` / `roundNumberFromPhase` in
[`gamesim/GamesimProvider.tsx`](../notebook-pixel-sim/src/gamesim/GamesimProvider.tsx).
Anything keyed by the server is indexed by ROUND NUMBER; anything a player reads
is a PHASE.

Sites that get this wrong fail silently rather than loudly, so they are worth
knowing: [`roundControllers.ts:211`](src/controllers/roundControllers.ts#L211)
(the last-round test), [`models/rounds.ts:31`](src/models/rounds.ts#L31) (the
range guard), and both carry-forward reads
([`roundCalculation.ts:128`](src/services/roundCalculation.ts#L128),
[`projectionControllers.ts`](src/controllers/projectionControllers.ts)).

## Calculation order

```
Decisions  →  calcMarketModel  →  calcFinancials  →  Results + Decision.scored
```

**`calcMarketModel` cannot run inside `calcFinancials`, and this is a
requirement rather than an implementation detail.** The market model is built
from the VoC fit of every team's decisions, so in competitive mode it cannot be
computed until all teams have decided. `calcFinancials` therefore receives the
already-competed share as a *parameter* and never computes one.

| Step | Where | Notes |
|---|---|---|
| Load decisions | [`roundCalculation.ts:101`](src/services/roundCalculation.ts#L101) | Aborts if none exist |
| Prior closing stock | [`roundCalculation.ts:128`](src/services/roundCalculation.ts#L128) | From `Decision.scored`, not Projections |
| Market model, ALL teams | [`roundCalculation.ts:176`](src/services/roundCalculation.ts#L176) | Per product × segment |
| Results row | [`roundCalculation.ts:197`](src/services/roundCalculation.ts#L197) | Scores + shares |
| Financials, per team | [`roundCalculation.ts:224`](src/services/roundCalculation.ts#L224) | Share handed in |
| Write Results | [`roundCalculation.ts:273`](src/services/roundCalculation.ts#L273) | upsert |
| Write `Decision.scored` | [`roundCalculation.ts:304`](src/services/roundCalculation.ts#L304) | `updateOne` |

`readCostTreatment` ([`calcFinancials.ts:116`](src/sim/calcFinancials.ts#L116))
is the single interpreter of a globalInput's cost. Both money paths must call it,
or the live projection and the official score interpret the same decision
differently.

## The money chain

```
produced      = min(the team's target, inventoryQty)     ← the DECISION
sellable      = openingStock + produced                  ← carried stock counts
unitsSold     = min(customersObtained, sellable)
closingStock  = sellable − unitsSold                     ← next round's openingStock

  Revenue           unitsSold × sellingPrice
− COGS              produced × dynamicCost + globalInputs declared 'cogs'
= Gross Profit
− OpEx              closingStock × inventory_cost + globalInputs declared 'opex'
= Operating Profit
```

- `unitsSold` [`:546`](src/sim/calcFinancials.ts#L546) · `closingStock` [`:549`](src/sim/calcFinancials.ts#L549)
- `unitCOGS` [`:556`](src/sim/calcFinancials.ts#L556) · `holdingCost` [`:562`](src/sim/calcFinancials.ts#L562)

**COGS is charged on units PRODUCED, not sold.** Cost is recognised when a unit
is built, so carried stock sells later with no further COGS — and a round that
sells nothing still expenses its whole build.

**`inventoryQty` is the CEILING on production**, derived from the product's own
field values and never persisted as a decision.
[`:487`](src/sim/calcFinancials.ts#L487), against
`INVENTORY_BASE = 1000` [`:327`](src/sim/calcFinancials.ts#L327).

`incurredCosts` is the itemised breakdown, each entry carrying `category` (free
text, operator-owned — never normalised by the client) and
`treatment: 'cogs' | 'opex'`, which decides which side of the gross-profit line
it renders on. `Σ incurredCosts` per treatment equals `COGS` / `operatingExpenses`
exactly; the tests assert that identity.

## Score

One submitted value per field drives **three** formulas, which is why one scalar
per config option is enough:

| Formula | Where | Shape |
|---|---|---|
| `dynamicPrice` | [`:379`](src/sim/calcFinancials.ts#L379) | bell-curved, direction-weighted |
| `dynamicCost` | [`:401`](src/sim/calcFinancials.ts#L401) | `(minValue + score) × field.unitCost` — linear |
| `inventoryQty` | [`:487`](src/sim/calcFinancials.ts#L487) | `Π (1 − score × 0.01) × INVENTORY_BASE` |

Scores are **0–100**, authored by hand from the design sheet. The range is not
arbitrary: `maxValue` defaults to 100, so the bell curve's mean sits at 50 with a
standard deviation of 25. A 0–5 scale puts every option at `z ≈ −1.9` — pinned
against the maximum penalty and packed too tightly for the curve to separate
them — and the ceiling's `× 0.01` only reads as a percentage if the score is one.

`field.unitCost` is dollars per score point. A cost field with no `unitCost`
contributes nothing to `dynamicCost`.

## What freezes a round

| Endpoint | Effect |
|---|---|
| `POST /rounds/:id/end` | Calculate → `status = "Completed"` → advance the simulation, in ONE transaction. **The operator's normal action.** [`:148`](src/controllers/roundControllers.ts#L148) |
| `POST /rounds/:id/calculate` | Calculates and leaves the round **Active**. A deliberate mid-round dry run only. [`:107`](src/controllers/roundControllers.ts#L107) |

`Completed` is what makes a round read-only: `/projections/recalc` refuses a
Completed round ([`:110`](src/controllers/projectionControllers.ts#L110)).
Calculating without closing leaves every figure open to being overwritten by the
next player edit.

Splitting these was a trap once already — `calculateRound` refuses to run unless
the round is Active, so an operator who closed a round first could never
calculate it, and its results were stranded. `/end` does all three atomically.

## Resetting a round

Reset must undo the **calculation**, which touches three collections:

| Deleted | Endpoint |
|---|---|
| Decisions (and the `scored` block with them) | `DELETE /decisions?simulationId=&roundNumber=` |
| Results | `DELETE /results?simulationId=&roundNumber=` |
| Projections (the what-ifs) | `DELETE /projections?simulationId=&roundNumber=` [`:90`](src/controllers/projectionControllers.ts#L90) |

Deleting fewer than all three leaves a round that reports itself reset while
still serving old figures.

## Invariants

Things that must stay true. Each has broken at least once.

1. **`roundNumber` is 0-based; `totalRounds` is a count.** Never compare them directly.
2. **Both money paths call `readCostTreatment` and `toProjectionMetrics`.** One reader, one shape.
3. **`calcFinancials` never computes a market share.** It receives one.
4. **Costs do not scale with market share.** COGS is on units produced, holding on closing stock — both decisions, not outcomes.
5. **Carry-forward stock reads `Decision.scored`, never `Projections`.**
6. **`Projections` is never authoritative.** If a number matters, it comes from `Decision.scored`.
7. **A round is scored as a unit.** `scored` is replaced wholesale, not merged per product, so two calculations can never interleave.
