import { Plus, Search, Trash2 } from "lucide-react";
import * as React from "react";
import {
  CatalogTable,
  type FieldSpec,
} from "@/components/app/catalog-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input, Textarea } from "@/components/ui/input";
import { PRODUCTION_AXES, PRODUCTION_AXIS_FIELDS } from "@/features/game-content/specs";

/* ──────────────────────── production (six axes) ─────────────────────────── */

/**
 * Production is an object of six named arrays rather than one list, and the
 * axes multiply together — so an empty axis would make production undefined.
 * Each axis gets its own table with that warning attached.
 */
export function ProductionEditor({
  value,
  onChange,
}: {
  value: Record<string, any[]>;
  onChange: (v: Record<string, any[]>) => void;
}) {
  return (
    <div className="space-y-8">
      {PRODUCTION_AXES.map((axis) => {
        const rows = value?.[axis.key] ?? [];
        return (
          <section key={axis.key}>
            <div className="mb-2 flex items-baseline gap-3">
              <h3 className="text-[15px] font-semibold text-foreground">{axis.label}</h3>
              <Badge tone="count">{rows.length}</Badge>
              <span className="text-[12px] text-muted-foreground">{axis.help}</span>
            </div>
            {rows.length === 0 && (
              <p className="mb-2 rounded-md bg-warning-tint px-3 py-2 text-[12px] text-warning">
                An axis with no options makes production undefined — add at least one.
              </p>
            )}
            <CatalogTable
              rows={rows}
              fields={PRODUCTION_AXIS_FIELDS}
              addLabel={`Add ${axis.label.toLowerCase()} option`}
              newRow={() => ({ id: "", name: "", rate: 0.5, cost: 0 })}
              onChange={(next) => onChange({ ...value, [axis.key]: next })}
            />
          </section>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────── constants ──────────────────────────────── */

/** Human note per constant, so an operator doesn't have to read the source. */
const CONSTANT_HELP: Record<string, string> = {
  BASERATE: "Scales the multiplied option rates into units/day.",
  BASE_MARKET_SHARE: "A single player's base slice of a genre's market.",
  UNIT_CONTRIBUTION: "Average unit margin routed to cash.",
  DEMAND_SCALE: "Balance knob — scales per-day addressable demand into production range.",
  HOLDING_RATE_PER_DAY: "Carrying cost on unsold stock, as a fraction of unit cost.",
  BUDGET_MAX: "$/day cap on the marketing and sales sliders.",
  BUDGET_LEVER_ENERGY: "Flat energy to switch a budget lever on.",
  MARKETING_DEMAND_RATE: "Added demand fraction per $/day of marketing.",
  SALES_SELL_RATE: "Added sell-rate per $/day of sales budget.",
  PHASE_LENGTH_DAYS: "Days per phase.",
  ENERGY_START: "Energy at the start of the run.",
  ENERGY_PER_PHASE: "Energy granted at each phase rollover.",
  ENERGY_CAP: "Hard ceiling on energy.",
  SCENARIO_DAYS: "Days key scenarios fire on.",
  DEFAULT_DEFECT: "Baseline defect rate.",
  BASE_PRODUCTION: "V2 baseline units/day.",
  HIRE_CAPACITY: "V2 capacity added per hire.",
  HIRE_DAILY_WAGE: "V2 daily wage per hire.",
  SEED_DEFAULT: "Default RNG seed — determinism anchor.",
};

const isMap = (v: unknown) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * Constants reach a running game at the player's next load.
 *
 * This used to carry a `NEEDS_REBUILD` list of ~17 scalars that could be
 * published and would never take effect, because they were plain `const`
 * number exports and a module's own `const` binding cannot be rebound from
 * outside it. They are now `export let` behind `applyConstantOverrides` /
 * `applyBalanceOverrides` in the player, which works on ES module live
 * bindings — so every key in this editor genuinely applies.
 *
 * A key this build of the player has never heard of is still surfaced, but by
 * the hydration report rather than guessed at here: keeping a duplicate list
 * in the console is what let this one go stale in the first place.
 */

export function ConstantsEditor({
  value,
  onChange,
}: {
  value: Record<string, any>;
  onChange: (v: Record<string, any>) => void;
}) {
  const [query, setQuery] = React.useState("");
  const entries = Object.entries(value ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const shown = entries.filter(([k]) => k.toLowerCase().includes(query.toLowerCase()));

  const set = (k: string, v: any) => onChange({ ...value, [k]: v });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-72">
          <Input
            inputSize="sm"
            icon={<Search />}
            placeholder="Filter constants…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery("")}
          />
        </div>
        <Badge tone="count">{shown.length} of {entries.length}</Badge>
        <p className="text-[12px] text-muted-foreground">
          Only whitelisted keys are accepted — the server rejects anything it doesn't know.
        </p>
      </div>


      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {shown.map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border bg-card p-3">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <code className="font-mono text-[12px] font-semibold text-foreground">{k}</code>
              <div className="flex shrink-0 items-center gap-1.5">
                {Array.isArray(v) && <Badge tone="outline" size="sm">list</Badge>}
                {isMap(v) && <Badge tone="outline" size="sm">map</Badge>}
              </div>
            </div>
            {CONSTANT_HELP[k] && (
              <p className="mb-2 text-[11.5px] leading-4 text-muted-foreground">
                {CONSTANT_HELP[k]}
              </p>
            )}

            {Array.isArray(v) ? (
              <Input
                inputSize="sm"
                className="font-mono text-[12px]"
                value={v.join(", ")}
                onChange={(e) =>
                  set(
                    k,
                    e.target.value
                      .split(",")
                      .map((s) => Number(s.trim()))
                      .filter((n) => Number.isFinite(n))
                  )
                }
              />
            ) : isMap(v) ? (
              <div className="space-y-1.5">
                {Object.entries(v as Record<string, number>).map(([mk, mv]) => (
                  <div key={mk} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 truncate font-mono text-[11.5px] text-muted-foreground">
                      {mk}
                    </span>
                    <Input
                      inputSize="sm"
                      type="number"
                      step="any"
                      className="tnum"
                      value={mv ?? ""}
                      onChange={(e) => set(k, { ...(v as any), [mk]: Number(e.target.value) })}
                    />
                  </div>
                ))}
              </div>
            ) : typeof v === "string" ? (
              <Input inputSize="sm" value={v} onChange={(e) => set(k, e.target.value)} />
            ) : (
              <Input
                inputSize="sm"
                type="number"
                step="any"
                className="tnum"
                value={v ?? ""}
                onChange={(e) => set(k, Number(e.target.value))}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────── copy ────────────────────────────────── */

/**
 * Copy overrides. Deliberately empty after seeding: the player ships its own
 * strings, and anything absent here falls straight through to them. Operators
 * add only the keys they want to change.
 */
export function CopyEditor({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [newKey, setNewKey] = React.useState("");
  const entries = Object.entries(value ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const shown = entries.filter(
    ([k, v]) =>
      k.toLowerCase().includes(query.toLowerCase()) ||
      String(v).toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-72">
          <Input
            inputSize="sm"
            icon={<Search />}
            placeholder="Search keys and text…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery("")}
          />
        </div>
        <Badge tone="count">{entries.length} override(s)</Badge>
      </div>

      {entries.length === 0 && (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted-foreground">
          No overrides. Every string falls through to the text bundled with the player —
          add a key below to change one.
        </p>
      )}

      <div className="space-y-2">
        {shown.map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border bg-card p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <code className="flex-1 truncate font-mono text-[12px] font-semibold text-foreground">
                {k}
              </code>
              <IconButton
                label="Remove override"
                size="sm"
                className="hover:text-destructive"
                onClick={() => {
                  const next = { ...value };
                  delete next[k];
                  onChange(next);
                }}
              >
                <Trash2 />
              </IconButton>
            </div>
            <Textarea
              className="min-h-16 text-[13px]"
              value={v}
              onChange={(e) => onChange({ ...value, [k]: e.target.value })}
            />
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2 rounded-lg border border-border bg-muted p-3">
        <div className="flex-1 space-y-1.5">
          <label className="text-[12px] font-semibold text-foreground">New key</label>
          <Input
            inputSize="sm"
            className="font-mono text-[12px]"
            placeholder="start.title"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!newKey.trim() || Object.prototype.hasOwnProperty.call(value ?? {}, newKey.trim())}
          onClick={() => {
            onChange({ ...value, [newKey.trim()]: "" });
            setNewKey("");
          }}
        >
          <Plus /> Add override
        </Button>
      </div>
    </div>
  );
}

/* ───────────────────────────────── images ───────────────────────────────── */

export function ImagesEditor({
  value,
  onChange,
}: {
  value: Record<string, { imageAssetId?: string | null; imagePath?: string | null }>;
  onChange: (v: Record<string, any>) => void;
}) {
  const [newKey, setNewKey] = React.useState("");
  const entries = Object.entries(value ?? {}).sort(([a], [b]) => a.localeCompare(b));

  const fields: FieldSpec[] = [];
  void fields;

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-muted-foreground">
        Slot overrides. An <strong>Image Asset ID</strong> (uploaded on the Image Assets page)
        wins; otherwise the <strong>image key</strong> points into the player's bundled asset map.
      </p>

      {entries.length === 0 && (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted-foreground">
          No slot overrides — the player uses its bundled art.
        </p>
      )}

      <div className="space-y-2">
        {entries.map(([slot, v]) => (
          <div key={slot} className="flex items-end gap-2 rounded-lg border border-border bg-card p-3">
            <div className="w-56 space-y-1.5">
              <label className="text-[12px] font-semibold text-foreground">Slot</label>
              <Input inputSize="sm" className="font-mono text-[12px]" value={slot} readOnly />
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="text-[12px] font-semibold text-foreground">Image Asset ID</label>
              <Input
                inputSize="sm"
                className="font-mono text-[12px]"
                value={v?.imageAssetId ?? ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    [slot]: { ...v, imageAssetId: e.target.value || null },
                  })
                }
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="text-[12px] font-semibold text-foreground">Image key</label>
              <Input
                inputSize="sm"
                className="font-mono text-[12px]"
                value={v?.imagePath ?? ""}
                onChange={(e) =>
                  onChange({ ...value, [slot]: { ...v, imagePath: e.target.value || null } })
                }
              />
            </div>
            <IconButton
              label="Remove slot"
              size="sm"
              className="mb-1 hover:text-destructive"
              onClick={() => {
                const next = { ...value };
                delete next[slot];
                onChange(next);
              }}
            >
              <Trash2 />
            </IconButton>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2 rounded-lg border border-border bg-muted p-3">
        <div className="flex-1 space-y-1.5">
          <label className="text-[12px] font-semibold text-foreground">New slot</label>
          <Input
            inputSize="sm"
            className="font-mono text-[12px]"
            placeholder="mascot.happy"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!newKey.trim()}
          onClick={() => {
            onChange({ ...value, [newKey.trim()]: { imageAssetId: null, imagePath: null } });
            setNewKey("");
          }}
        >
          <Plus /> Add slot
        </Button>
      </div>
    </div>
  );
}
