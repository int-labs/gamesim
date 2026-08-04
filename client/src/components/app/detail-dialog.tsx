import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/overlays";
import { cn } from "@/lib/utils";

/**
 * The shared "what IS this record" view.
 *
 * Collection pages show a summary — a row has room for four or five columns
 * out of a document with twenty fields. Everything else was simply unreachable:
 * you could see that a team submitted a decision and never what they submitted.
 *
 * This is deliberately ONE component rather than a dialog per page. Thirteen
 * hand-rolled detail views drift apart within a month; one that every page
 * feeds means a fix to keyboard handling or long-value wrapping lands
 * everywhere at once.
 *
 * It renders DATA, not forms. Editing stays with `ResourceFormDialog` — mixing
 * the two produces a screen that is neither a good reference nor a good editor.
 */

export interface DetailField {
  label: string;
  value: React.ReactNode;
  /** Full-width in the two-column grid — long text, JSON, lists. */
  wide?: boolean;
  /** Rendered monospaced; use for ids, keys and raw values. */
  mono?: boolean;
  /** Muted when the record genuinely has no value here. */
  empty?: boolean;
}

export interface DetailSection {
  title?: string;
  fields: DetailField[];
}

export function DetailDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  eyebrow,
  leading,
  sections,
  footer,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Small label above the title — usually what KIND of record this is. */
  eyebrow?: string;
  /** An avatar, product cover or icon tile. */
  leading?: React.ReactNode;
  sections: DetailSection[];
  /** Actions belong here, so they can never be mistaken for form controls. */
  footer?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[680px]">
        <div className="flex items-start gap-3">
          {leading}
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {eyebrow}
              </div>
            )}
            <DialogTitle>{title}</DialogTitle>
            {subtitle && (
              <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="mt-5 space-y-5">
          {sections.map((section, si) => (
            <div key={si}>
              {section.title && (
                <h3 className="mb-2 border-b border-border pb-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {section.title}
                </h3>
              )}
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {section.fields.map((f, fi) => (
                  <div key={fi} className={cn("min-w-0", f.wide && "sm:col-span-2")}>
                    <dt className="text-[11.5px] font-medium text-muted-foreground">{f.label}</dt>
                    <dd
                      className={cn(
                        "mt-0.5 text-[13px] leading-5",
                        // Long values must wrap rather than stretch the dialog;
                        // ids and JSON are exactly the values that would.
                        "break-words",
                        f.mono && "font-mono text-[12px]",
                        f.empty ? "text-muted-foreground" : "text-foreground"
                      )}
                    >
                      {f.empty ? "—" : f.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>

        {footer && (
          <div className="mt-6 flex items-center justify-end gap-2 border-t border-border pt-4">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** A compact value + unit pair, for numeric detail fields. */
export function DetailStat({ value, unit }: { value: React.ReactNode; unit?: string }) {
  return (
    <span className="tnum">
      {value}
      {unit && <span className="ml-1 text-[11.5px] text-muted-foreground">{unit}</span>}
    </span>
  );
}

/** Renders a free-form map (coefficients, options, years) readably. */
export function DetailMap({ value }: { value: unknown }) {
  const entries =
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.entries(value as Record<string, unknown>)
      : [];
  if (entries.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([k, v]) => (
        <Badge key={k} tone="outline" size="sm" className="font-mono">
          {k}: {typeof v === "object" ? JSON.stringify(v) : String(v)}
        </Badge>
      ))}
    </div>
  );
}
