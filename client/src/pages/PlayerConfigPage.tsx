import { useState, useEffect } from "react";
import { Alert, Badge, Button, Card, DataTable, Heading, PageHeader, Select, Tabs, Text, TextArea, TextField, type DataTableColumn } from "@stratagem/design-system";
import {
  getSimulationTypes,
  getGlobalInputs,
  getProducts,
  getImageAssets,
  getPlayerConfig,
  createPlayerConfig,
  updatePlayerConfig,
} from "../api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CaseStudy {
  title: string;
  brief: string;
  bestWhen: string;
  watchOut: string;
}

interface ConfigEntry {
  id: string;
  /** `drivers` only — the PARENT product this field key belongs to, a Product
   *  `_id`. One field key means different things on different notebooks, and
   *  `direction` is already per product, so the copy is scoped the same way.
   *  Blank = unscoped, a fallback for any product with no row of its own. */
  productId: string;
  imageAssetId: string;
  caseStudy: CaseStudy;
  /** Display name. `drivers`: overrides the ProductField's own label.
   *  `products`: overrides `productName`. Blank = use the backend's. */
  label: string;
  /** `drivers`: the tooltip on the market card's driver row.
   *  `products`: the one-line blurb under the notebook's name. */
  hint: string;
  /** `products` only — the longer prose the Details tab shows. */
  description: string;
  /** `products` only — the Segments tab's copy, RAW HTML. Stored and rendered
   *  verbatim: nothing on this path escapes it. */
  segments: string;
  /** `products` only — the Details tab's STRENGTHS list, one bullet per line. */
  bestFor: string[];
  /** `products` only — the Details tab's WEAKNESS list, one bullet per line. */
  watchOut: string[];
}

/**
 * The bullet lists are edited as RAW TEXT and only split on save.
 *
 * Splitting on every keystroke would delete the trailing newline the moment it
 * was typed, so a second bullet could never be started.
 */
type EntryForm = Omit<ConfigEntry, "bestFor" | "watchOut"> & {
  bestFor: string;
  watchOut: string;
};

const linesToText = (v: string[] | undefined) => (v ?? []).join("\n");
/** Blank lines dropped so a stray return never renders an empty bullet. */
const textToLines = (v: string) => v.split("\n").map(s => s.trim()).filter(Boolean);

const BLANK_CASE_STUDY: CaseStudy = { title: "", brief: "", bestWhen: "", watchOut: "" };

const BLANK_FORM: EntryForm = {
  id: "", productId: "", imageAssetId: "", caseStudy: { ...BLANK_CASE_STUDY },
  label: "", hint: "", description: "", segments: "", bestFor: "", watchOut: "",
};

/** Table-cell helpers. The entry table shows what a section actually stores, so
 *  a copy-only section is not rendered against case-study columns. */
const dash = <Text as="span" tone="faint">—</Text>;
const cellClamp = "block max-w-56 truncate";
/** Bullet lists preview as "a · b · c" — the cell is one line, and joining on a
 *  separator keeps it readable without hiding that there are several. */
const bullets = (v: string[] | undefined) => (v?.length ? v.join(" · ") : dash);

// ── Segments HTML: sanitised HERE, on the way IN ─────────────────────────────
//
// Owner's ruling 2026-09-30: sanitisation is held explicitly on the ADMIN side,
// not at render. What reaches the database is already safe, so the player client
// injects what it is given and no second, differently-minded pass can disagree
// with this one about what "safe" means.
//
// Two consequences, both accepted and worth knowing:
//   • the API is not the boundary — a row written straight to the endpoint
//     never passes through here;
//   • rows saved before this existed keep whatever they hold until re-saved.

/** Elements dropped whole, with their subtree. */
const BLOCKED_TAGS = new Set(["object", "embed", "link"]);

/**
 * Attributes naming a URL. ALL are stripped — this field carries flavour text
 * and no link it could hold is worth the surface. Removing the attribute covers
 * `http`, `https` and `mailto` by covering every scheme, rather than naming
 * three and leaving `javascript:` and `data:` through.
 */
const URL_ATTRS = ["href", "src", "srcset", "action", "formaction", "poster", "background", "xlink:href"];

/**
 * Operator HTML, made safe to store.
 *
 * A document containing `<script>` is ESCAPED WHOLE rather than edited: it is
 * stored as its own source text, so the player's Segments tab displays the
 * markup instead of rendering it and whoever wrote it sees exactly what they
 * typed. Owner's rule — a document that tries to run code is not quietly
 * repaired.
 *
 * Everything else is edited in place: `<object>` / `<embed>` / `<link>` removed
 * with their subtrees, every `on*` handler removed, every URL-bearing attribute
 * removed, and `style` dropped when it carries `url(` or `expression(`.
 *
 * DOMParser, not a regex: markup nests, and a regex that looks like it strips
 * `<script>` loses to `<scr<script>ipt>`. The parsed document is detached —
 * nothing in it fetches or fires.
 */
export function sanitizeSegmentsHtml(source: string): string {
  if (!source.trim()) return "";

  const doc = new DOMParser().parseFromString(source, "text/html");

  // ESCAPE WHOLE, do not strip. Checked before any editing, so the decision is
  // made on the document as written.
  if (doc.querySelector("script")) {
    const escaper = doc.createElement("textarea");
    escaper.textContent = source;
    return escaper.innerHTML;
  }

  for (const el of Array.from(doc.body.querySelectorAll("*"))) {
    if (BLOCKED_TAGS.has(el.tagName.toLowerCase())) {
      el.remove();
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || URL_ATTRS.includes(name)) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (name === "style" && /url\s*\(|expression\s*\(/i.test(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
  }

  return doc.body.innerHTML;
}

/** The form as it is STORED — bullet lists split into arrays, segments HTML
 *  sanitised. Both happen at the same seam on purpose: this function is what
 *  "stored" means, so nothing can reach the payload without passing it. */
const toEntry = (f: EntryForm): ConfigEntry => ({
  ...f,
  segments: sanitizeSegmentsHtml(f.segments),
  bestFor:  textToLines(f.bestFor),
  watchOut: textToLines(f.watchOut),
});

type Section =
  | "vendors" | "candidates" | "marketingTeams" | "channels" | "drivers" | "products";

// `key` is the section name stored on PlayerConfig.config and read by the
// player's configHydrator. `idsFrom` says where the valid ids come from:
//
//   globalInput:<key>  — that container's ITEM KEYS
//   productFields      — the PRODUCT FIELD keys, across every product
//   products           — the PRODUCT _ids
//
// `fields` says which inputs the entry form offers. Every section here supplies
// PRESENTATION ONLY — the numbers live on the backend object and are read
// straight off it.
type EntryField = "image" | "copy" | "caseStudy";

const SECTIONS: {
  key: Section;
  label: string;
  idsFrom: string;
  fields: EntryField[];
}[] = [
  { key: "vendors",       label: "Vendors",          idsFrom: "globalInput:supply_chain", fields: ["image", "caseStudy"] },
  { key: "candidates",    label: "Candidates",       idsFrom: "globalInput:hiring",       fields: ["image", "caseStudy"] },
  { key: "marketingTeams",label: "Marketing Teams",  idsFrom: "globalInput:marketing",    fields: ["image", "caseStudy"] },
  { key: "channels",      label: "Channels",         idsFrom: "globalInput:channel",      fields: ["caseStudy"] },
  { key: "drivers",       label: "Customer Drivers", idsFrom: "productFields",            fields: ["copy"] },
  // Notebooks: art + copy keyed by PRODUCT _id. The product IS the notebook —
  // the frontend must not hold a second table deciding which notebooks exist.
  { key: "products",      label: "Notebooks",        idsFrom: "products",                 fields: ["image", "copy"] },
];

const sectionFields = (key: Section): EntryField[] =>
  SECTIONS.find((s) => s.key === key)?.fields ?? [];

/** A pickable id plus what to show for it — a product `_id` is unreadable on
 *  its own, so the dropdown needs a name beside it. */
interface AvailableId {
  id: string;
  label: string;
}

/** An empty bucket per section, derived from SECTIONS so adding one above is
 *  the only edit — this literal used to be repeated at six call sites. */
const emptyBySection = <T,>(): Record<Section, T[]> =>
  Object.fromEntries(SECTIONS.map((s) => [s.key, [] as T[]])) as Record<Section, T[]>;

// ── Component ─────────────────────────────────────────────────────────────────

export default function PlayerConfigPage() {
  const [simTypes, setSimTypes]               = useState<any[]>([]);
  const [selectedSimTypeId, setSelectedSimTypeId] = useState("");

  // Loaded state from backend
  const [configId, setConfigId]               = useState<string | null>(null);
  const [config, setConfig]                   = useState<Record<Section, ConfigEntry[]>>(
    emptyBySection<ConfigEntry>(),
  );

  // Pickable ids per section, from whichever source that section declares.
  const [availableIds, setAvailableIds]       = useState<Record<Section, AvailableId[]>>(
    emptyBySection<AvailableId>(),
  );

  // Field keys per Product `_id` — the drivers section scopes its id list to the
  // parent product chosen on the entry form.
  const [fieldsByProduct, setFieldsByProduct] = useState<Record<string, AvailableId[]>>({});

  // Uploaded image assets for the image picker
  const [imageAssets, setImageAssets]         = useState<any[]>([]);

  // Editing state
  const [activeSection, setActiveSection]     = useState<Section>("vendors");
  const [entryForm, setEntryForm]             = useState<EntryForm>({ ...BLANK_FORM, caseStudy: { ...BLANK_CASE_STUDY } });
  const [editingIndex, setEditingIndex]       = useState<number | null>(null);

  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState("");
  const [saved, setSaved]                     = useState(false);

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  useEffect(() => {
    getSimulationTypes()
      .then(res => setSimTypes(res.data?.data ?? res.data))
      .catch((e: any) => setError(e.message));
    getImageAssets()
      .then(res => setImageAssets(res.data?.data ?? res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedSimTypeId) {
      setConfigId(null);
      setConfig(emptyBySection<ConfigEntry>());
      setAvailableIds(emptyBySection<AvailableId>());
      return;
    }
    loadConfig();
    loadAvailableIds();
  }, [selectedSimTypeId]);

  const loadConfig = async () => {
    try {
      const res = await getPlayerConfig(selectedSimTypeId);
      const doc = res.data?.data ?? res.data;
      setConfigId(doc._id ?? null);
      const cfg = doc.config ?? {};
      // Per SECTIONS, so a new section loads without another line here.
      setConfig(
        Object.fromEntries(
          SECTIONS.map((s) => [s.key, (cfg[s.key] ?? []).map(normaliseEntry)]),
        ) as Record<Section, ConfigEntry[]>,
      );
    } catch (e: any) {
      // 404 = no config yet; anything else is a real error
      if (e.response?.status !== 404) setError(e.message);
      setConfigId(null);
      setConfig(emptyBySection<ConfigEntry>());
    }
  };

  // ONE fetch per source, not one per section: this used to call
  // getGlobalInputs inside the per-section loop, firing four identical requests
  // for the same payload.
  const loadAvailableIds = async () => {
    const ids: Record<Section, AvailableId[]> = emptyBySection<AvailableId>();

    const needsGlobalInputs = SECTIONS.some((s) => s.idsFrom.startsWith("globalInput:"));
    const needsProducts = SECTIONS.some((s) => s.idsFrom === "productFields" || s.idsFrom === "products");

    const [giAll, productAll] = await Promise.all([
      needsGlobalInputs
        ? getGlobalInputs(selectedSimTypeId, undefined)
            .then((r) => (r.data?.data ?? r.data) as any[])
            .catch(() => [] as any[])
        : Promise.resolve([] as any[]),
      needsProducts
        ? getProducts(selectedSimTypeId)
            .then((r) => (r.data?.data ?? r.data) as any[])
            .catch(() => [] as any[])
        : Promise.resolve([] as any[]),
    ]);

    for (const { key, idsFrom } of SECTIONS) {
      if (idsFrom === "products") {
        // The id is the PRODUCT _id — opaque, so the picker shows the name and
        // stores the id. Typing an _id by hand is not a workflow.
        ids[key] = productAll
          .filter((p: any) => p?.active !== false)
          .map((p: any) => ({ id: String(p._id), label: `${p.productName} · ${p._id}` }));
        continue;
      }
      if (idsFrom === "productFields") {
        // Deduped across products — the id list for a row with NO parent
        // chosen. It used to be the only list, on the reasoning that one hint
        // describes the axis rather than one product's copy of it; that was
        // wrong (see `productId` on ConfigEntry), so the per-product lists are
        // built below and this is now the unscoped fallback's list.
        const keys = new Set<string>();
        for (const p of productAll) {
          for (const f of p?.fields ?? []) if (f?.key) keys.add(String(f.key));
        }
        ids[key] = [...keys].map((k) => ({ id: k, label: k }));
        continue;
      }
      const giKey = idsFrom.slice("globalInput:".length);
      const gi = giAll.find((g: any) => g.key === giKey);
      ids[key] = (gi?.inputs ?? []).map((item: any) => ({
        id: String(item.key),
        label: item.label ? `${item.key} · ${item.label}` : String(item.key),
      }));
    }

    setAvailableIds(ids);

    // Field keys PER PRODUCT, for the drivers section's parent select. Keyed by
    // the Product `_id`, the same key the player client's `DRIVER_COPY` nests
    // under — never a name match.
    const byProduct: Record<string, AvailableId[]> = {};
    for (const p of productAll) {
      if (p?.active === false) continue;
      byProduct[String(p._id)] = (p?.fields ?? [])
        .filter((f: any) => f?.key)
        .map((f: any) => ({
          id: String(f.key),
          label: f.label ? `${f.key} · ${f.label}` : String(f.key),
        }));
    }
    setFieldsByProduct(byProduct);
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const normaliseEntry = (raw: any): ConfigEntry => ({
    id:           raw.id ?? "",
    // Absent on every row written before 2026-09-30 — those stay unscoped and
    // act as the fallback for products with no row of their own.
    productId:    raw.productId ?? "",
    imageAssetId: raw.imageAssetId ?? "",
    label:        raw.label ?? "",
    hint:         raw.hint ?? "",
    description:  raw.description ?? "",
    segments:     raw.segments ?? "",
    bestFor:      Array.isArray(raw.bestFor)  ? raw.bestFor  : [],
    watchOut:     Array.isArray(raw.watchOut) ? raw.watchOut : [],
    caseStudy: {
      title:    raw.caseStudy?.title    ?? "",
      brief:    raw.caseStudy?.brief    ?? "",
      bestWhen: raw.caseStudy?.bestWhen ?? "",
      watchOut: raw.caseStudy?.watchOut ?? "",
    },
  });

  const setCaseStudyField = (field: keyof CaseStudy, value: string) =>
    setEntryForm(f => ({ ...f, caseStudy: { ...f.caseStudy, [field]: value } }));

  const resetForm = () => {
    setEntryForm({ ...BLANK_FORM, caseStudy: { ...BLANK_CASE_STUDY } });
    setEditingIndex(null);
  };

  // ── Entry CRUD (local, committed on Save) ──────────────────────────────────

  const handleAddOrUpdate = () => {
    if (!entryForm.id.trim()) { setError("ID is required"); return; }
    setConfig(prev => {
      const rows = [...prev[activeSection]];
      if (editingIndex !== null) {
        rows[editingIndex] = toEntry(entryForm);
      } else {
        rows.push(toEntry(entryForm));
      }
      return { ...prev, [activeSection]: rows };
    });
    resetForm();
    setError("");
  };

  const handleEdit = (idx: number) => {
    const entry = config[activeSection][idx];
    setEntryForm({
      id:           entry.id,
      productId:    entry.productId ?? "",
      imageAssetId: entry.imageAssetId,
      label:        entry.label ?? "",
      hint:         entry.hint ?? "",
      description:  entry.description ?? "",
      segments:     entry.segments ?? "",
      bestFor:      linesToText(entry.bestFor),
      watchOut:     linesToText(entry.watchOut),
      caseStudy:    { ...entry.caseStudy },
    });
    setEditingIndex(idx);
  };

  const handleRemove = (idx: number) => {
    setConfig(prev => {
      const rows = prev[activeSection].filter((_, i) => i !== idx);
      return { ...prev, [activeSection]: rows };
    });
    if (editingIndex === idx) resetForm();
  };

  // ── Save to backend ────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!selectedSimTypeId) return;
    setLoading(true);
    setError("");
    setSaved(false);
    try {
      const payload = { simulationTypeId: selectedSimTypeId, config };
      if (configId) {
        await updatePlayerConfig(configId, payload);
      } else {
        const res = await createPlayerConfig(payload);
        const doc = res.data?.data ?? res.data;
        setConfigId(doc._id ?? null);
      }
      setSaved(true);
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const sectionRows = config[activeSection];
  const sectionMeta = SECTIONS.find(s => s.key === activeSection)!;

  /** The id list the picker offers. For `drivers` with a parent chosen it is
   *  THAT product's field keys; otherwise the section's own list — which for
   *  drivers is every key across every product, the unscoped fallback's set. */
  const idOptions: AvailableId[] =
    activeSection === "drivers" && entryForm.productId
      ? fieldsByProduct[entryForm.productId] ?? []
      : availableIds[activeSection];

  const fields = sectionFields(activeSection);

  // Columns follow the section, so a copy-only section is not rendered against empty case-study columns
  const entryColumns: DataTableColumn<{ row: ConfigEntry; i: number }>[] = [
    {
      id: "id",
      header: "ID",
      primary: true,
      cell: ({ row, i }) => (
        <span className="flex items-center gap-2">
          <code>{row.id}</code>
          {editingIndex === i && <Badge tone="warning">editing</Badge>}
        </span>
      ),
    },
    // Without this two drivers on the same field key, one per notebook, are indistinguishable
    ...(activeSection === "drivers" ? [{
      id: "notebook",
      header: "Notebook",
      cell: ({ row }: { row: ConfigEntry }) => (
        <span className={cellClamp}>
          {row.productId
            ? (availableIds.products.find(p => p.id === row.productId)?.label ?? row.productId)
            : <Text as="em" tone="subtle">all notebooks</Text>}
        </span>
      ),
    }] : []),
    ...(fields.includes("image") ? [{
      id: "image",
      header: "Image Asset ID",
      cell: ({ row }: { row: ConfigEntry }) => <span className="block max-w-40 truncate">{row.imageAssetId || dash}</span>,
    }] : []),
    ...(fields.includes("copy") ? [
      {
        id: "label",
        header: activeSection === "products" ? "Name override" : "Label override",
        cell: ({ row }: { row: ConfigEntry }) => row.label || dash,
      },
      {
        id: "hint",
        header: activeSection === "products" ? "Blurb" : "Hint",
        cell: ({ row }: { row: ConfigEntry }) => <span className={cellClamp}>{row.hint || dash}</span>,
      },
    ] : []),
    ...(activeSection === "products" ? [
      { id: "description", header: "Description", cell: ({ row }: { row: ConfigEntry }) => <span className={cellClamp}>{row.description || dash}</span> },
      { id: "bestFor", header: "Best for", cell: ({ row }: { row: ConfigEntry }) => <span className={cellClamp}>{bullets(row.bestFor)}</span> },
      { id: "watchOut", header: "Watch out", cell: ({ row }: { row: ConfigEntry }) => <span className={cellClamp}>{bullets(row.watchOut)}</span> },
    ] : []),
    ...(fields.includes("caseStudy") ? [
      { id: "csTitle", header: "Case Study Title", cell: ({ row }: { row: ConfigEntry }) => row.caseStudy.title || dash },
      { id: "csBestWhen", header: "Best When", cell: ({ row }: { row: ConfigEntry }) => row.caseStudy.bestWhen || dash },
      { id: "csWatchOut", header: "Watch Out", cell: ({ row }: { row: ConfigEntry }) => row.caseStudy.watchOut || dash },
    ] : []),
  ];

  return (
    <>
      <PageHeader title="Player Config" />
      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">Saved.</Alert>}

      <Select
        label="Simulation Type"
        placeholder="-- select --"
        value={selectedSimTypeId || null}
        onValueChange={v => { setSelectedSimTypeId(v ?? ""); resetForm(); }}
        options={simTypes.map((st: any) => ({ value: st._id, label: st.name ?? st._id }))}
      />

      {selectedSimTypeId && (
        <>
          <Text variant="caption" tone="muted">
            Config ID: {configId ?? "(none — will be created on first save)"}
          </Text>

          {/* ── Section tabs ── */}
          <Tabs<Section>
            label="Sections"
            tabs={SECTIONS.map(s => ({ value: s.key, label: s.label }))}
            value={activeSection}
            onValueChange={key => { setActiveSection(key); resetForm(); }}
          />

          <Card>
            {/* ── Available IDs, from whichever source this section declares ── */}
            {availableIds[activeSection].length > 0 && (
              <Text variant="caption" tone="subtle">
                Available IDs from <code>{sectionMeta.idsFrom}</code>:{" "}
                {availableIds[activeSection].map((a) => a.label).join(", ")}
              </Text>
            )}

            {/* ── Entry table, rows keyed by array position as before ── */}
            <DataTable
              label={`${sectionMeta.label} entries`}
              density="compact"
              columns={entryColumns}
              rows={sectionRows.map((row, i) => ({ row, i }))}
              rowKey={({ i }) => String(i)}
              empty="No entries yet."
              rowActions={({ i }) => (
                <>
                  <Button variant="text" onClick={() => handleEdit(i)}>Edit</Button>
                  <Button variant="text" tone="danger" onClick={() => handleRemove(i)}>Remove</Button>
                </>
              )}
            />
          </Card>

          {/* ── Entry form ── */}
          <Card>
            <Heading level={4}>{editingIndex !== null ? "Edit Entry" : "Add Entry"} — {sectionMeta.label}</Heading>

            {/* Drivers only: a field key means something different on each notebook, so copy is scoped to a
                Product; blank is the unscoped fallback the player uses for any product without its own row */}
            {activeSection === "drivers" && (
              <Select
                label="Notebook (parent)"
                value={entryForm.productId}
                disabled={editingIndex !== null}
                onValueChange={v => setEntryForm(f => ({
                  ...f,
                  productId: v ?? "",
                  // The key list changes with the parent, so a key picked
                  // against the previous one would silently not exist.
                  id: "",
                }))}
                options={[
                  { value: "", label: "(all notebooks - fallback)" },
                  ...availableIds.products.map(p => ({ value: p.id, label: p.label })),
                ]}
              />
            )}

            <div className="flex flex-wrap items-end gap-2">
              <TextField
                label="ID (input key)"
                value={entryForm.id}
                onChange={e => setEntryForm(f => ({ ...f, id: e.target.value }))}
                disabled={editingIndex !== null}
              />
              {idOptions.length > 0 && editingIndex === null && (
                <Select
                  aria-label="pick from list"
                  width="fit"
                  placeholder="pick from list…"
                  value={null}
                  onValueChange={v => v && setEntryForm(f => ({ ...f, id: v }))}
                  options={idOptions.map(a => ({ value: a.id, label: a.label }))}
                />
              )}
            </div>

            {/* The NAME always comes from the backend object; these overrides
                exist for when the player-facing wording should differ from the
                one the operator administers by. */}
            {fields.includes("copy") && (
              <>
                <TextField
                  label="Label override"
                  placeholder={
                    activeSection === "products"
                      ? "blank = use the Product's own productName"
                      : "blank = use the ProductField's own label"
                  }
                  value={entryForm.label}
                  onChange={e => setEntryForm(f => ({ ...f, label: e.target.value }))}
                />
                <TextArea
                  label={activeSection === "products" ? "Blurb" : "Hint"}
                  placeholder={
                    activeSection === "products"
                      ? "one line under the notebook's name"
                      : "tooltip on the driver row — blank = no tooltip"
                  }
                  value={entryForm.hint}
                  onChange={e => setEntryForm(f => ({ ...f, hint: e.target.value }))}
                  minRows={2}
                />
                {activeSection === "products" && (
                  <>
                    <TextArea
                      label="Description"
                      placeholder="the longer prose the Details tab shows"
                      value={entryForm.description}
                      onChange={e => setEntryForm(f => ({ ...f, description: e.target.value }))}
                      minRows={4}
                    />
                    {/* Segments are HTML, SANITISED ON SAVE by `sanitizeSegmentsHtml`; what the table shows after saving is what is stored */}
                    <TextArea
                      label="Segments (HTML)"
                      className="font-mono"
                      placeholder="<p>Who buys this notebook, and what they care about.</p>"
                      value={entryForm.segments}
                      onChange={e => setEntryForm(f => ({ ...f, segments: e.target.value }))}
                      minRows={8}
                      description={
                        <>
                          Rendered as HTML on the player&apos;s Segments tab. Cleaned on save:
                          scripts, embeds, event handlers and links are removed.
                        </>
                      }
                    />
                    {/* Both render as bullet lists on the Details tab, one line per bullet; blank is a legitimate empty panel */}
                    <TextArea
                      label="Best for (Strengths)"
                      placeholder="one strength per line"
                      value={entryForm.bestFor}
                      onChange={e => setEntryForm(f => ({ ...f, bestFor: e.target.value }))}
                      minRows={4}
                    />
                    <TextArea
                      label="Watch out (Weakness)"
                      placeholder="one weakness per line"
                      value={entryForm.watchOut}
                      onChange={e => setEntryForm(f => ({ ...f, watchOut: e.target.value }))}
                      minRows={4}
                    />
                  </>
                )}
              </>
            )}

            {/* Channels render no artwork, so the image picker is offered only where it does something */}
            {fields.includes("image") && (
              <div className="flex flex-wrap items-end gap-2">
                <TextField
                  label="Image Asset"
                  placeholder="imageAssetId URL or leave blank"
                  value={entryForm.imageAssetId}
                  onChange={e => setEntryForm(f => ({ ...f, imageAssetId: e.target.value }))}
                />
                {imageAssets.length > 0 && (
                  <Select
                    aria-label="pick from uploads"
                    width="fit"
                    placeholder="pick from uploads…"
                    value={null}
                    onValueChange={v => v && setEntryForm(f => ({ ...f, imageAssetId: v }))}
                    options={imageAssets.map((a: any) => ({ value: a.url ?? a._id, label: a.filename ?? a._id }))}
                  />
                )}
              </div>
            )}

            {fields.includes("caseStudy") && (
              <Card variant="panel">
                <Heading level={5}>Case Study</Heading>
                <TextField label="Title" value={entryForm.caseStudy.title} onChange={e => setCaseStudyField("title", e.target.value)} />
                <TextArea label="Brief" value={entryForm.caseStudy.brief} onChange={e => setCaseStudyField("brief", e.target.value)} minRows={3} />
                <TextArea label="Best When" value={entryForm.caseStudy.bestWhen} onChange={e => setCaseStudyField("bestWhen", e.target.value)} minRows={2} />
                <TextArea label="Watch Out" value={entryForm.caseStudy.watchOut} onChange={e => setCaseStudyField("watchOut", e.target.value)} minRows={2} />
              </Card>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleAddOrUpdate}>{editingIndex !== null ? "Update" : "Add"}</Button>
              {editingIndex !== null && <Button variant="text" onClick={resetForm}>Cancel</Button>}
            </div>
          </Card>

          {/* ── Save ── */}
          <Button className="self-start" onClick={handleSave} disabled={loading}>
            {loading ? "Saving…" : configId ? "Save Changes" : "Create Config"}
          </Button>
        </>
      )}
    </>
  );
}
