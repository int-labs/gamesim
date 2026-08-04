import { Plus, Save, Trash2 } from "lucide-react";
import * as React from "react";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/overlays";
import { Label, Switch } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * One create/edit form for every collection in the console.
 *
 * The console is meant to be CRUD over each collection, and most pages had
 * become read-only tables — you could look at a product but not rename one.
 * Rather than ten bespoke dialogs drifting apart, a page declares its fields
 * and gets the same form, the same validation, the same delete confirmation
 * and the same error handling.
 */

export type FieldKind =
  | "text"
  | "textarea"
  | "number"
  | "money"
  | "switch"
  | "select"
  /** A free-form map — edited as JSON, sent as an object. */
  | "json";

export interface FormField {
  key: string;
  label: string;
  kind?: FieldKind;
  /** Shown under the input. Say what the value DOES, not what it is called. */
  help?: string;
  placeholder?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  /** Full-width in the two-column grid. */
  wide?: boolean;
  /** Locked after creation — e.g. a key other records point at. */
  immutable?: boolean;
}

const emptyFor = (fields: FormField[]): Record<string, any> =>
  Object.fromEntries(
    fields.map((f) => [
      f.key,
      f.kind === "switch" ? false : f.kind === "json" ? "{}" : "",
    ])
  );

export function ResourceFormDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  initial,
  submitting,
  onSubmit,
  submitLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  fields: FormField[];
  /** Present when editing; absent when creating. */
  initial?: Record<string, any> | null;
  submitting?: boolean;
  /**
   * Return a promise to have the dialog close itself when it resolves and stay
   * open (with the values intact) when it rejects. Pages used to close via the
   * mutation's `onSuccess`, which left the dialog open on top of a successful
   * write — the close now lives here, next to the `onOpenChange` that performs
   * it, so it cannot be wired up wrong per page.
   */
  onSubmit: (values: Record<string, any>) => void | Promise<unknown>;
  submitLabel?: string;
}) {
  const isEdit = !!initial;
  const [values, setValues] = React.useState<Record<string, any>>({});
  const [touched, setTouched] = React.useState(false);

  // Re-seed whenever the dialog opens so a previous edit never bleeds into the
  // next one — a create form pre-filled with the last row is a data-loss trap.
  React.useEffect(() => {
    if (!open) return;
    setTouched(false);
    setValues(
      initial
        ? Object.fromEntries(
            fields.map((f) => {
              const v = initial[f.key];
              if (f.kind === "json") {
                // Stored as an object; edited as text. Round-trips through
                // JSON so an operator sees the same thing the engine reads.
                return [f.key, v == null ? "{}" : JSON.stringify(v, null, 2)];
              }
              return [f.key, v ?? emptyFor([f])[f.key]];
            })
          )
        : emptyFor(fields)
    );
  }, [open, initial, fields]);

  const set = (k: string, v: any) => setValues((prev) => ({ ...prev, [k]: v }));

  const missing = fields.filter(
    (f) => f.required && (values[f.key] === "" || values[f.key] == null)
  );

  // Unparseable JSON must never reach the server — Mongoose would take the
  // string, store it, and the engine would read a map that isn't one.
  const badJson = fields.filter((f) => {
    if (f.kind !== "json") return false;
    const raw = String(values[f.key] ?? "").trim();
    if (raw === "") return false;
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed !== "object" || parsed === null || Array.isArray(parsed);
    } catch {
      return true;
    }
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (missing.length > 0 || badJson.length > 0) return;

    // Numbers arrive from the DOM as strings; send them as numbers or Mongoose
    // casts silently and the value comes back subtly wrong.
    const out: Record<string, any> = {};
    for (const f of fields) {
      const v = values[f.key];
      if (f.immutable && isEdit) continue;
      if (v === "" || v == null) continue;
      out[f.key] =
        f.kind === "number" || f.kind === "money"
          ? Number(v)
          : f.kind === "json"
            ? JSON.parse(String(v))
            : v;
    }

    try {
      await onSubmit(out);
      onOpenChange(false);
    } catch {
      // The mutation layer already surfaced the reason; keep the form open so
      // the operator doesn't lose what they typed.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px]">
        <DialogTitle>{title}</DialogTitle>
        {description && (
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{description}</p>
        )}

        <form onSubmit={submit} noValidate className="mt-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fields.map((f) => {
              const locked = !!f.immutable && isEdit;
              const invalid = touched && f.required && (values[f.key] === "" || values[f.key] == null);
              return (
                <div
                  key={f.key}
                  className={cn(
                    "space-y-1.5",
                    (f.wide || f.kind === "textarea" || f.kind === "json") && "sm:col-span-2"
                  )}
                >
                  <div className="flex items-baseline gap-2">
                    <Label htmlFor={`f-${f.key}`}>{f.label}</Label>
                    {f.required && <span className="text-[11px] text-muted-foreground">required</span>}
                    {locked && (
                      <Badge tone="outline" size="sm">
                        can't change
                      </Badge>
                    )}
                  </div>

                  {f.kind === "switch" ? (
                    <div className="flex h-10 items-center">
                      <Switch
                        id={`f-${f.key}`}
                        checked={!!values[f.key]}
                        onCheckedChange={(v: boolean) => set(f.key, v)}
                        disabled={locked}
                      />
                    </div>
                  ) : f.kind === "textarea" || f.kind === "json" ? (
                    <Textarea
                      id={`f-${f.key}`}
                      rows={f.kind === "json" ? 5 : 3}
                      className={cn(f.kind === "json" && "font-mono text-[12.5px] leading-5")}
                      spellCheck={f.kind === "json" ? false : undefined}
                      value={values[f.key] ?? ""}
                      placeholder={f.placeholder}
                      disabled={locked}
                      error={invalid || badJson.includes(f)}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                  ) : f.kind === "select" ? (
                    <select
                      id={`f-${f.key}`}
                      value={values[f.key] ?? ""}
                      disabled={locked}
                      onChange={(e) => set(f.key, e.target.value)}
                      className="h-10 w-full rounded-md border border-border bg-card px-3 text-[14px] text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-45"
                    >
                      <option value="">Choose…</option>
                      {(f.options ?? []).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={`f-${f.key}`}
                      type={f.kind === "number" || f.kind === "money" ? "number" : "text"}
                      step={f.step ?? (f.kind === "money" ? "0.01" : "any")}
                      min={f.min}
                      max={f.max}
                      value={values[f.key] ?? ""}
                      placeholder={f.placeholder}
                      disabled={locked}
                      error={invalid}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                  )}

                  {f.help && !invalid && !badJson.includes(f) && (
                    <p className="text-[11.5px] leading-4 text-muted-foreground">{f.help}</p>
                  )}
                  {invalid && (
                    <p className="text-[11.5px] leading-4 text-destructive">
                      {f.label} is required.
                    </p>
                  )}
                  {badJson.includes(f) && (
                    <p className="text-[11.5px] leading-4 text-destructive">
                      {f.label} must be a JSON object, like {"{ \"key\": 1 }"}.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {isEdit ? <Save /> : <Plus />}
              {submitLabel ?? (isEdit ? "Save changes" : "Create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The page-level bundle: a Create button, the shared form, and a delete
 * confirmation — so a collection page wires CRUD in a few lines instead of
 * re-implementing the same three dialogs.
 */
export function useResourceCrud<T extends { _id: string }>() {
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<T | null>(null);
  const [deleting, setDeleting] = React.useState<T | null>(null);

  return {
    creating,
    editing,
    deleting,
    openCreate: () => setCreating(true),
    openEdit: (row: T) => setEditing(row),
    openDelete: (row: T) => setDeleting(row),
    closeAll: () => {
      setCreating(false);
      setEditing(null);
      setDeleting(null);
    },
    setCreating,
    setEditing,
    setDeleting,
  };
}

export function DeleteResourceDialog({
  row,
  onOpenChange,
  label,
  name,
  loading,
  onConfirm,
  consequence,
}: {
  row: unknown | null;
  onOpenChange: (v: boolean) => void;
  label: string;
  name?: string;
  loading?: boolean;
  onConfirm: () => void;
  /** What else this breaks — the part a confirm dialog usually omits. */
  consequence?: React.ReactNode;
}) {
  return (
    <ConfirmDialog
      open={!!row}
      onOpenChange={onOpenChange}
      title={`Delete ${name ? `“${name}”` : `this ${label}`}?`}
      description={
        <>
          This cannot be undone.
          {consequence && (
            <>
              <br />
              <br />
              {consequence}
            </>
          )}
        </>
      }
      confirmLabel={`Delete ${label}`}
      loading={loading}
      onConfirm={onConfirm}
    />
  );
}

export { Trash2 as DeleteIcon };
