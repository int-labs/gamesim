import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";
import { Switch } from "@/components/ui/primitives";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Schema-driven catalog editors.
 *
 * The player's config has 19 sections with wildly different shapes — flat
 * option tables, entries with nested option arrays, free-form number maps.
 * Rather than 19 bespoke editors, each section declares a FIELD SPEC and picks
 * one of two renderers:
 *
 *   CatalogTable — one row per entry, scalar columns. Production axes,
 *                  marketing teams, add-ons, upgrades, segments…
 *   CatalogCards — one card per entry, for entries that own a nested array
 *                  (scenario options, vendor coverage, hiring levels).
 *
 * Values are addressed by DOTTED PATH (`demand.p1`, `costs.cash`), so nested
 * objects need no special handling in the specs.
 */

/* ───────────────────────────── path helpers ─────────────────────────────── */

export const getPath = (obj: any, path: string): any =>
  path.split(".").reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);

export function setPath<T>(obj: T, path: string, value: unknown): T {
  const keys = path.split(".");
  const clone: any = Array.isArray(obj) ? [...(obj as any)] : { ...(obj as any) };
  let cur = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    cur[k] = Array.isArray(cur[k]) ? [...cur[k]] : { ...(cur[k] ?? {}) };
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
  return clone;
}

/* ────────────────────────────── field specs ─────────────────────────────── */

export type FieldSpec = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "number" | "switch" | "select" | "stringList" | "numberMap";
  options?: { value: string; label: string }[];
  /** Tailwind width utility for the table column. */
  width?: string;
  step?: number;
  min?: number;
  max?: number;
  help?: string;
  mono?: boolean;
  /** Hidden in the table but still editable in the card body. */
  wide?: boolean;
};

export type NestedSpec = {
  key: string;
  label: string;
  fields: FieldSpec[];
  newRow: () => any;
};

/* ───────────────────────────── field renderer ───────────────────────────── */

function FieldControl({
  spec,
  value,
  onChange,
  dense,
}: {
  spec: FieldSpec;
  value: any;
  onChange: (v: any) => void;
  dense?: boolean;
}) {
  const size = dense ? "sm" : "md";

  switch (spec.type) {
    case "number":
      return (
        <Input
          inputSize={size}
          type="number"
          step={spec.step ?? "any"}
          min={spec.min}
          max={spec.max}
          className="tnum"
          value={value ?? ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
        />
      );

    case "switch":
      return (
        <div className="flex h-9 items-center">
          <Switch checked={!!value} onCheckedChange={onChange} />
        </div>
      );

    case "select":
      return (
        <Select value={String(value ?? "")} onValueChange={onChange}>
          <SelectTrigger size={size}>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {(spec.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "textarea":
      return (
        <Textarea
          className="min-h-20 text-[13px]"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "stringList":
      return <StringListControl value={value ?? []} onChange={onChange} />;

    case "numberMap":
      return <NumberMapControl value={value ?? {}} onChange={onChange} />;

    default:
      return (
        <Input
          inputSize={size}
          className={spec.mono ? "font-mono text-[12px]" : undefined}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

/** Free list of strings — archetype strengths, upgrade effects. */
function StringListControl({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      {value.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input
            inputSize="sm"
            value={item}
            onChange={(e) => {
              const next = [...value];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <IconButton
            label="Remove"
            size="sm"
            className="hover:text-destructive"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <Trash2 />
          </IconButton>
        </div>
      ))}
      <Button variant="ghost" size="sm" onClick={() => onChange([...value, ""])}>
        <Plus /> Add line
      </Button>
    </div>
  );
}

/** Arbitrary key → number map: segmentBoost, segmentAffinity, PRICE_REFERENCE. */
function NumberMapControl({
  value,
  onChange,
}: {
  value: Record<string, number>;
  onChange: (v: Record<string, number>) => void;
}) {
  const entries = Object.entries(value ?? {});
  const setEntry = (oldKey: string, newKey: string, v: number) => {
    const next: Record<string, number> = {};
    for (const [k, val] of entries) {
      if (k === oldKey) {
        if (newKey) next[newKey] = v;
      } else next[k] = val;
    }
    onChange(next);
  };

  return (
    <div className="space-y-1.5">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center gap-1.5">
          <Input
            inputSize="sm"
            className="font-mono text-[12px]"
            value={k}
            onChange={(e) => setEntry(k, e.target.value, v)}
          />
          <Input
            inputSize="sm"
            type="number"
            step="any"
            className="w-28 tnum"
            value={v ?? ""}
            onChange={(e) => setEntry(k, k, Number(e.target.value))}
          />
          <IconButton
            label="Remove"
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
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange({ ...value, "": 0 })}
        disabled={Object.prototype.hasOwnProperty.call(value ?? {}, "")}
      >
        <Plus /> Add key
      </Button>
    </div>
  );
}

/* ───────────────────────────── CatalogTable ─────────────────────────────── */

export function CatalogTable({
  rows,
  fields,
  onChange,
  newRow,
  addLabel = "Add entry",
  issuesByIndex,
}: {
  rows: any[];
  fields: FieldSpec[];
  onChange: (rows: any[]) => void;
  newRow?: () => any;
  addLabel?: string;
  issuesByIndex?: Record<number, string[]>;
}) {
  const update = (i: number, path: string, value: unknown) =>
    onChange(rows.map((r, j) => (i === j ? setPath(r, path, value) : r)));

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted">
              {fields.map((f) => (
                <th key={f.key} className={cn("px-3 py-2 text-left", f.width)}>
                  <span className="eyebrow text-muted-foreground" title={f.help}>
                    {f.label}
                  </span>
                </th>
              ))}
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={fields.length + 1}
                  className="px-3 py-8 text-center text-[13px] text-muted-foreground"
                >
                  Nothing here yet.
                </td>
              </tr>
            )}
            <AnimatePresence initial={false}>
              {rows.map((row, i) => (
                <motion.tr
                  key={row.id ?? i}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={SPRING.snappy}
                  className={cn(
                    "border-b border-border last:border-0",
                    issuesByIndex?.[i]?.length && "bg-destructive-tint/40"
                  )}
                >
                  {fields.map((f) => (
                    <td key={f.key} className="px-3 py-2 align-top">
                      <FieldControl
                        dense
                        spec={f}
                        value={getPath(row, f.key)}
                        onChange={(v) => update(i, f.key, v)}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-2 align-top">
                    <IconButton
                      label="Remove row"
                      size="sm"
                      className="hover:text-destructive"
                      onClick={() => onChange(rows.filter((_, j) => j !== i))}
                    >
                      <Trash2 />
                    </IconButton>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {newRow && (
        <Button variant="outline" size="sm" onClick={() => onChange([...rows, newRow()])}>
          <Plus /> {addLabel}
        </Button>
      )}
    </div>
  );
}

/* ───────────────────────────── CatalogCards ─────────────────────────────── */

export function CatalogCards({
  rows,
  headerFields,
  bodyFields = [],
  nested = [],
  onChange,
  newRow,
  addLabel = "Add entry",
  titleKey = "name",
}: {
  rows: any[];
  headerFields: FieldSpec[];
  bodyFields?: FieldSpec[];
  nested?: NestedSpec[];
  onChange: (rows: any[]) => void;
  newRow?: () => any;
  addLabel?: string;
  titleKey?: string;
}) {
  const [open, setOpen] = React.useState<Record<number, boolean>>({ 0: true });
  const update = (i: number, path: string, value: unknown) =>
    onChange(rows.map((r, j) => (i === j ? setPath(r, path, value) : r)));

  return (
    <div className="space-y-3">
      {rows.length === 0 && (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted-foreground">
          Nothing here yet.
        </p>
      )}

      {rows.map((row, i) => {
        const expanded = open[i] ?? false;
        return (
          <div key={row.id ?? i} className="rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [i]: !expanded }))}
                className="flex flex-1 items-center gap-2 text-left"
              >
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    !expanded && "-rotate-90"
                  )}
                />
                <span className="truncate text-[14px] font-semibold text-foreground">
                  {getPath(row, titleKey) || <span className="text-muted-foreground">Untitled</span>}
                </span>
                {row.id && (
                  <Badge tone="outline" size="sm" className="font-mono">
                    {row.id}
                  </Badge>
                )}
                {nested.map((n) => (
                  <Badge key={n.key} tone="count" size="sm">
                    {(getPath(row, n.key) ?? []).length} {n.label.toLowerCase()}
                  </Badge>
                ))}
              </button>
              <IconButton
                label="Remove entry"
                size="sm"
                className="hover:text-destructive"
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </IconButton>
            </div>

            {expanded && (
              <div className="space-y-4 p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[...headerFields, ...bodyFields].map((f) => (
                    <div
                      key={f.key}
                      className={cn("space-y-1.5", f.wide && "sm:col-span-2 lg:col-span-3")}
                    >
                      <label className="text-[12px] font-semibold text-foreground">
                        {f.label}
                        {f.help && (
                          <span className="ml-1.5 font-normal text-muted-foreground">
                            {f.help}
                          </span>
                        )}
                      </label>
                      <FieldControl
                        spec={f}
                        value={getPath(row, f.key)}
                        onChange={(v) => update(i, f.key, v)}
                      />
                    </div>
                  ))}
                </div>

                {nested.map((n) => (
                  <div key={n.key} className="space-y-2">
                    <div className="eyebrow text-muted-foreground">{n.label}</div>
                    <CatalogTable
                      rows={getPath(row, n.key) ?? []}
                      fields={n.fields}
                      newRow={n.newRow}
                      addLabel={`Add ${n.label.toLowerCase().replace(/s$/, "")}`}
                      onChange={(next) => update(i, n.key, next)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {newRow && (
        <Button variant="outline" size="sm" onClick={() => onChange([...rows, newRow()])}>
          <Plus /> {addLabel}
        </Button>
      )}
    </div>
  );
}
