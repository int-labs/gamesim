import { CloudUpload, RotateCcw, Save, Shapes } from "lucide-react";
import { motion } from "motion/react";
import * as React from "react";
import { CatalogCards, CatalogTable } from "@/components/app/catalog-editor";
import { Card } from "@/components/app/card";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState } from "@/components/app/feedback";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";
import { Eyebrow, Skeleton, StatusDot } from "@/components/ui/primitives";
import {
  ConstantsEditor,
  CopyEditor,
  ImagesEditor,
  ProductionEditor,
} from "@/features/game-content/editors";
import { SECTIONS, SECTION_GROUPS, type SectionSpec } from "@/features/game-content/specs";
import { useSimulationTypes } from "@/lib/api-hooks";
import {
  usePlayerConfig,
  usePublishConfig,
  usePublishedPlayerConfig,
  useRevertConfig,
  useSaveSection,
} from "@/lib/player-config-hooks";
import { relativeTime } from "@/lib/format";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Game Content — the operator's editing surface for everything the notebook
 * player renders.
 *
 * Two rules shape this screen:
 *   1. Edits go to the DRAFT. Players only ever read the published snapshot,
 *      so a half-finished catalog can't reach a classroom mid-round.
 *   2. Nothing saves implicitly. Each section has its own Save, and the
 *      dirty state is visible, because an accidental autosave here changes a
 *      running game.
 */
export default function GameContentPage() {
  const { data: types = [] } = useSimulationTypes();
  const [typeId, setTypeId] = React.useState<string>("");
  const [activeKey, setActiveKey] = React.useState<string>(SECTIONS[0].key);
  const [confirmRevert, setConfirmRevert] = React.useState(false);
  const [confirmPublish, setConfirmPublish] = React.useState(false);

  React.useEffect(() => {
    if (!typeId && types.length) setTypeId(types[0]._id);
  }, [types, typeId]);

  const draft = usePlayerConfig(typeId || undefined);
  const published = usePublishedPlayerConfig(typeId || undefined);
  const saveSection = useSaveSection(typeId || undefined);
  const publish = usePublishConfig(typeId || undefined);
  const revert = useRevertConfig(typeId || undefined);

  const spec = SECTIONS.find((s) => s.key === activeKey)!;
  const serverValue = draft.data?.config?.[activeKey];

  /** Local working copy for the active section; reset when the section or
   *  the server document changes. */
  const [local, setLocal] = React.useState<any>(undefined);
  const baselineRef = React.useRef<string>("");

  React.useEffect(() => {
    const next = serverValue ?? defaultFor(spec);
    setLocal(next);
    baselineRef.current = JSON.stringify(next);
  }, [activeKey, draft.dataUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = local !== undefined && JSON.stringify(local) !== baselineRef.current;

  // Sections whose draft differs from what players currently see.
  const changedSections = React.useMemo(() => {
    const d = draft.data?.config;
    const p = published.data?.config;
    if (!d) return new Set<string>();
    if (!p) return new Set(SECTIONS.map((s) => s.key));
    return new Set(
      SECTIONS.map((s) => s.key).filter(
        (k) => JSON.stringify(d[k]) !== JSON.stringify(p[k])
      )
    );
  }, [draft.data, published.data]);

  const save = () =>
    saveSection.mutate(
      { section: activeKey, value: local },
      { onSuccess: () => (baselineRef.current = JSON.stringify(local)) }
    );

  const count = (v: any) =>
    Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : 0;

  return (
    <>
      <PageHeader
        title="Game content"
        subtitle="Everything the player renders — catalogs, economy tunables, story beats and copy. Edits stay in the draft until you publish."
        actions={
          <>
            <div className="w-[220px]">
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger size="sm">
                  <SelectValue placeholder="Simulation type" />
                </SelectTrigger>
                <SelectContent>
                  {types.map((t: any) => (
                    <SelectItem key={t._id} value={t._id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              shape="pill"
              disabled={!published.data}
              onClick={() => setConfirmRevert(true)}
            >
              <RotateCcw /> Revert draft
            </Button>
            <Button
              shape="pill"
              disabled={!draft.data}
              loading={publish.isPending}
              onClick={() => setConfirmPublish(true)}
            >
              <CloudUpload /> Publish
            </Button>
          </>
        }
      />

      {/* Publish state — the one thing an operator must always be able to see. */}
      <Card className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 py-4">
        <div className="flex items-center gap-2">
          <StatusDot tone={changedSections.size ? "warning" : "success"} />
          <span className="text-[13px] font-semibold text-foreground">
            {changedSections.size
              ? `${changedSections.size} section${changedSections.size === 1 ? "" : "s"} unpublished`
              : "Draft matches what players see"}
          </span>
        </div>
        <span className="text-[13px] text-muted-foreground">
          {published.data
            ? `Live: v${published.data.version} · published ${relativeTime(published.data.publishedAt)}`
            : "Never published — players are using the bundled defaults"}
        </span>
      </Card>

      {draft.isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <Skeleton className="h-[600px] rounded-xl lg:col-span-3" />
          <Skeleton className="h-[600px] rounded-xl lg:col-span-9" />
        </div>
      ) : !draft.data ? (
        <Card padded={false}>
          <EmptyState
            icon={<Shapes />}
            title="No config for this simulation type"
            hint="Seed it by running scripts/export-player-config.mjs --push, which lifts the player's own bundled catalogs into the database."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Section rail */}
          <Card padded={false} className="h-fit lg:col-span-3">
            <nav className="p-2">
              {SECTION_GROUPS.map((group) => (
                <div key={group} className="mb-3 last:mb-0">
                  <Eyebrow className="block px-2 py-1.5">{group}</Eyebrow>
                  {SECTIONS.filter((s) => s.group === group).map((s) => {
                    const active = s.key === activeKey;
                    const n = count(draft.data?.config?.[s.key]);
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setActiveKey(s.key)}
                        className={cn(
                          "relative flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors",
                          active
                            ? "text-primary"
                            : "text-body hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="gc-active"
                            transition={SPRING.snappy}
                            className="absolute inset-0 rounded-md bg-accent"
                          />
                        )}
                        <span className="relative z-10 flex-1 truncate text-[13px] font-semibold">
                          {s.label}
                        </span>
                        {changedSections.has(s.key) && (
                          <span
                            className="relative z-10 size-1.5 shrink-0 rounded-full bg-warning"
                            title="Unpublished changes"
                          />
                        )}
                        <Badge tone="count" size="sm" className="relative z-10">
                          {n}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>
          </Card>

          {/* Editor */}
          <div className="lg:col-span-9">
            <Card className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-[20px] font-semibold text-foreground">
                    {spec.label}
                  </h2>
                  <p className="mt-1 max-w-[70ch] text-[13px] leading-5 text-muted-foreground">
                    {spec.description}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {dirty && (
                    <Badge tone="warning" size="sm">
                      Unsaved
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    disabled={!dirty}
                    loading={saveSection.isPending}
                    onClick={save}
                  >
                    <Save /> Save section
                  </Button>
                </div>
              </div>

              {local !== undefined && (
                <SectionEditor spec={spec} value={local} onChange={setLocal} />
              )}
            </Card>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        title="Publish to players?"
        description={
          changedSections.size
            ? `This replaces what every player reads with the current draft (${changedSections.size} changed section${changedSections.size === 1 ? "" : "s"}). Players who already loaded the game keep their current copy until they reload.`
            : "The draft matches the published version — publishing will be a no-op."
        }
        confirmLabel="Publish"
        loading={publish.isPending}
        onConfirm={() => {
          publish.mutate(undefined, { onSuccess: () => setConfirmPublish(false) });
        }}
      />

      <ConfirmDialog
        open={confirmRevert}
        onOpenChange={setConfirmRevert}
        title="Discard the draft?"
        description="Every unpublished edit is thrown away and the draft is reset to the live published version. This can't be undone."
        confirmLabel="Discard draft"
        loading={revert.isPending}
        onConfirm={() => revert.mutate(undefined, { onSuccess: () => setConfirmRevert(false) })}
      />
    </>
  );
}

function defaultFor(spec: SectionSpec) {
  if (spec.render === "production") return { type: [], paper: [], size: [], pageDesign: [], addon: [], cover: [] };
  if (spec.render === "constants" || spec.render === "copy" || spec.render === "images") return {};
  return [];
}

function SectionEditor({
  spec,
  value,
  onChange,
}: {
  spec: SectionSpec;
  value: any;
  onChange: (v: any) => void;
}) {
  switch (spec.render) {
    case "production":
      return <ProductionEditor value={value} onChange={onChange} />;
    case "constants":
      return <ConstantsEditor value={value} onChange={onChange} />;
    case "copy":
      return <CopyEditor value={value} onChange={onChange} />;
    case "images":
      return <ImagesEditor value={value} onChange={onChange} />;
    case "cards":
      return (
        <CatalogCards
          rows={value ?? []}
          headerFields={spec.headerFields ?? []}
          bodyFields={spec.bodyFields}
          nested={spec.nested}
          titleKey={spec.titleKey}
          newRow={spec.newRow}
          addLabel={`Add ${spec.label.toLowerCase().replace(/s$/, "")}`}
          onChange={onChange}
        />
      );
    default:
      return (
        <CatalogTable
          rows={value ?? []}
          fields={spec.fields ?? []}
          newRow={spec.newRow}
          addLabel={`Add ${spec.label.toLowerCase().replace(/s$/, "")}`}
          onChange={onChange}
        />
      );
  }
}
