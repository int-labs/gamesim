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
| **`Results`** | `(simulationId, roundNumber, productId, segmentId)` | The cross-team comparison: `weightedScores` (each team's `productScore`) and `marketShares`. |
| **`Round`** | `(simulationId, roundNumber)` | The indicator: `status`, `timer`, ordering. No financial data. |

**`Decision.scored` is the official record.** Written once, by the round close,
and never by the recalc — which is what makes it official.

- shape: [`models/decisions.ts:131`](src/models/decisions.ts#L131) · type [`ScoredMetrics`](src/sim/calcFinancials.ts#L230)
- written: [`roundCalculation.ts:446`](src/services/roundCalculation.ts#L446) — `updateOne`, never an upsert
- unique index: [`models/decisions.ts:154`](src/models/decisions.ts#L154)

Storing it here rather than on `Projections` is what makes **carry-forward stock
immutable**: round N reads round N−1's `scored[productId].closingStock`, so a
team's opening stock can never be whatever their last speculative edit said.

The metric block is shaped by one function,
[`toProjectionMetrics`](src/sim/calcFinancials.ts#L200), called by both money
paths so a field added to the sheet reaches the live projection and the official
close together, or not at all. `marketShare` is deliberately **not** in it — the
recalc has no competed share, and the round close spreads it in on top.

> `Projections`' own TypeScript interface types every metric as `number`, which
> is false: `productCostBreakdown`, `incurredCosts` and `globalInputCosts` are
> arrays of objects.
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
([`roundCalculation.ts:152`](src/services/roundCalculation.ts#L152),
[`projectionControllers.ts`](src/controllers/projectionControllers.ts)).

## Calculation order

```
Decisions → productScore (all teams) → share → calcFinancials → Results + Decision.scored
```

**The share cannot be computed until every team has decided, and this is a
requirement rather than an implementation detail.** A team's slice depends on
the other teams' scores, so in competitive mode the round can only be scored as
a whole. `calcFinancials` receives the already-competed share as a *parameter*
and never computes one.

| Step | Where | Notes |
|---|---|---|
| Load decisions | [`roundCalculation.ts:134`](src/services/roundCalculation.ts#L134) | Aborts if none exist |
| Prior closing stock | [`roundCalculation.ts:152`](src/services/roundCalculation.ts#L152) | From `Decision.scored`, not Projections |
| What gets scored | [`roundCalculation.ts:232`](src/services/roundCalculation.ts#L232) | Market model ∪ every product for the sim type |
| Who competes | [`roundCalculation.ts:297`](src/services/roundCalculation.ts#L297) | Only teams whose decision names that product |
| PASS 1 — `productScore` | [`roundCalculation.ts:359`](src/services/roundCalculation.ts#L359) | Placeholder share; every other figure discarded |
| Share | [`roundCalculation.ts:378`](src/services/roundCalculation.ts#L378) | `normaliseShares` |
| Results row | [`roundCalculation.ts:385`](src/services/roundCalculation.ts#L385) | Scores + shares |
| PASS 2 — financials | [`roundCalculation.ts:394`](src/services/roundCalculation.ts#L394) | Real share handed in |
| Write Results | [`roundCalculation.ts:422`](src/services/roundCalculation.ts#L422) | upsert |
| Write `Decision.scored` | [`roundCalculation.ts:446`](src/services/roundCalculation.ts#L446) | `updateOne` |

**Why two passes.** `productScore` is computed inside `calcFinancials`, and the
share is an *input* to that same function — so the round runs it twice: once to
read each team's score, then again with the competed share. That is deliberate.
`productScore` needs `augmentedDynamicPrice`, which needs the whole globalInput
augmentation loop; lifting it out would create a **second implementation** of a
number the sheet already computes, which is the divergence this codebase exists
to avoid. Pass 1's revenue and COGS are discarded — do not read them.

## Market share

```
share_i = productScore_i / Σ productScore   (across the teams on that product)
```

[`normaliseShares`](src/services/roundCalculation.ts#L71) — pure and exported so
it is tested without a database ([`test/normaliseShares.test.ts`](src/test/normaliseShares.test.ts)).

- Shares **sum to 1** across the teams that made the product. Equal scores ⇒
  `1/competing`.
- **A sole competitor takes the whole market.** Teams that ignored the product
  are not owed a slice of it, so the split is not scaled down by how many
  skipped it.
- `totalTeams` (`Team.countDocuments({ simulationId })`) is the **base only** —
  the fallback when every score is zero, so each competitor gets `1/totalTeams`
  rather than an even split of the competitors. It never scales the normalised
  split.
- Negative or non-finite scores contribute nothing.

`productScore` **is** the weighted value of a team's decisions — already
direction-weighted against the augmented dynamic price — so normalising it is
the whole model.

> **The previous model is parked, not deleted.**
> `sim/calcMarketModel.legacy.ts` plus its 16-test suite are kept on disk,
> untracked and excluded from tsc, jest and eslint, as the starting point for
> the version meant to replace this. That model was to derive absolute weights
> from the coefficients-and-drivers system — per-product-field coefficients
> combined with the segment drivers in `BaseData.csatMarketModel` — with VoC
> coming from the drivers.
>
> It was parked because it took a shortcut and derived VoC from `direction`
> instead, which is what `productScore` already does, and then multiplied by
> `projected_market_share / (1 / n)` — pms × n against a pms clamped 0..100. Any
> pms ≥ 1 pushed every team past 1.0 and the clamp pinned them **all** at 100%:
> two teams competing for one product each read a full market, and the shares
> summed to n instead of 1. `sim/calcMarketModel.ts` now holds only the shapes
> the operator still authors.

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

- `unitsSold` [`:554`](src/sim/calcFinancials.ts#L554) · `closingStock` [`:557`](src/sim/calcFinancials.ts#L557)
- `unitCOGS` [`:564`](src/sim/calcFinancials.ts#L564) · `holdingCost` [`:570`](src/sim/calcFinancials.ts#L570)

**COGS is charged on units PRODUCED, not sold.** Cost is recognised when a unit
is built, so carried stock sells later with no further COGS — and a round that
sells nothing still expenses its whole build.

**`inventoryQty` is the CEILING on production**, derived from the product's own
field values and never persisted as a decision.
[`:501`](src/sim/calcFinancials.ts#L501), against
`INVENTORY_BASE = 1000` [`:341`](src/sim/calcFinancials.ts#L341).

**An unstated target builds NOTHING.** `produced: null` resolves to zero
[`:548`](src/sim/calcFinancials.ts#L548), not to a share of the ceiling — a team
is never billed COGS for a build it did not ask for. The client's planner
defaults to the same zero (`statsFor` in `InventoryPanel.tsx`), so the two
cannot disagree. This was half the ceiling on both sides until 2026-09-03; a
test asserting cost behaviour must now state a target or nothing is built.

### The cost breakdown is TWO arrays

Every entry carries `treatment: 'cogs' | 'opex'`, which decides which side of the
gross-profit line it renders on, and `category` — free text, operator-owned,
**never normalised by the client**. They are split by whether a unit quantity
exists at all:

| Array | Holds | Unit fields |
|---|---|---|
| `incurredCosts` [`:126`](src/sim/calcFinancials.ts#L126) | COGS and inventory holding | `inputQty × costPerUnit === incurredCost` holds for every entry |
| `globalInputCosts` [`:143`](src/sim/calcFinancials.ts#L143) | globalInput spend, one row per category per side | none — the charge is `costTreatment × step`, already final |

**Read BOTH or the sheet will not add up.** `Σ (incurredCosts + globalInputCosts)`
per treatment equals `COGS` / `operatingExpenses` exactly; the tests assert that
identity over the concatenation.

A globalInput row has no quantity to divide by, which is why it has no
`inputQty`/`costPerUnit` rather than a placeholder — those fields previously held
a mean over the category's entry count, a number with no referent that the admin
console displayed. The `contributors[]` array carries the items summed into the
row instead, listed per side and only when the item actually charged, so a
step-0 item appears nowhere. Built at [`:613`](src/sim/calcFinancials.ts#L613),
emitted at [`:639`](src/sim/calcFinancials.ts#L639).

**The category names the row**, not any item's own label — it is the only string
that describes the sum. `label` mirrors `category` today, and the clients group
on it, so the two must stay equal.

Rounds scored before the split carry their globalInput rows inside
`incurredCosts` with `key === category`, which is the key the new array yields.
Old and new documents therefore merge into the same row with no migration and no
version check.

## Score

One submitted value per field drives **three** formulas, which is why one scalar
per config option is enough:

| Formula | Where | Shape |
|---|---|---|
| `dynamicPrice` | [`:393`](src/sim/calcFinancials.ts#L393) | bell-curved, direction-weighted |
| `dynamicCost` | [`:416`](src/sim/calcFinancials.ts#L416) | `(minValue + score) × field.unitCost` — linear |
| `inventoryQty` | [`:501`](src/sim/calcFinancials.ts#L501) | `Π (1 − score × 0.01) × INVENTORY_BASE` |

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
3. **`calcFinancials` never computes a market share.** It receives one — see [Market share](#market-share) for where it comes from, and why the round runs `calcFinancials` twice.
4. **Costs do not scale with market share.** COGS is on units produced, holding on closing stock — both decisions, not outcomes.
5. **Carry-forward stock reads `Decision.scored`, never `Projections`.**
6. **`Projections` is never authoritative.** If a number matters, it comes from `Decision.scored`.
7. **A round is scored as a unit.** `scored` is replaced wholesale, not merged per product, so two calculations can never interleave.
8. **The cost breakdown is two arrays.** Any reader of one must read the other, or COGS/opex will not reconcile. A row belongs in `incurredCosts` only if `inputQty × costPerUnit === incurredCost`.
