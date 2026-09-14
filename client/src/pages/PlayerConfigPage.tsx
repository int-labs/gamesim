import { useState, useEffect, type CSSProperties } from "react";
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
  id: "", imageAssetId: "", caseStudy: { ...BLANK_CASE_STUDY },
  label: "", hint: "", description: "", bestFor: "", watchOut: "",
};

/** Table-cell helpers. The entry table shows what a section actually stores, so
 *  a copy-only section is not rendered against case-study columns. */
const dash = <span style={{ color: "#aaa" }}>—</span>;
const cellClamp: CSSProperties = {
  maxWidth: 220,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
/** Bullet lists preview as "a · b · c" — the cell is one line, and joining on a
 *  separator keeps it readable without hiding that there are several. */
const bullets = (v: string[] | undefined) => (v?.length ? v.join(" · ") : dash);

/** The form as it is STORED — the two bullet lists split back into arrays. */
const toEntry = (f: EntryForm): ConfigEntry => ({
  ...f,
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
        // Deduped across products: the same field key appears on every product,
        // and one hint describes the axis, not one product's copy of it.
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
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const normaliseEntry = (raw: any): ConfigEntry => ({
    id:           raw.id ?? "",
    imageAssetId: raw.imageAssetId ?? "",
    label:        raw.label ?? "",
    hint:         raw.hint ?? "",
    description:  raw.description ?? "",
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
      imageAssetId: entry.imageAssetId,
      label:        entry.label ?? "",
      hint:         entry.hint ?? "",
      description:  entry.description ?? "",
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

  return (
    <div>
      <h2>Player Config</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {saved && <p style={{ color: "green" }}>Saved.</p>}

      <label>
        Simulation Type:{" "}
        <select value={selectedSimTypeId} onChange={e => { setSelectedSimTypeId(e.target.value); resetForm(); }}>
          <option value="">-- select --</option>
          {simTypes.map((st: any) => (
            <option key={st._id} value={st._id}>{st.name ?? st._id}</option>
          ))}
        </select>
      </label>

      {selectedSimTypeId && (
        <>
          <p style={{ fontSize: 12, color: "#666" }}>
            Config ID: {configId ?? "(none — will be created on first save)"}
          </p>

          {/* ── Section tabs ── */}
          <div style={{ marginTop: 12, marginBottom: 8 }}>
            {SECTIONS.map(s => (
              <button
                key={s.key}
                onClick={() => { setActiveSection(s.key); resetForm(); }}
                style={{
                  marginRight: 4,
                  fontWeight: activeSection === s.key ? "bold" : "normal",
                  background: activeSection === s.key ? "#eef" : "none",
                  border: "1px solid #aaa",
                  padding: "4px 10px",
                  cursor: "pointer",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* ── Available IDs, from whichever source this section declares ── */}
          {availableIds[activeSection].length > 0 && (
            <p style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>
              Available IDs from <code>{sectionMeta.idsFrom}</code>:{" "}
              {availableIds[activeSection].map((a) => a.label).join(", ")}
            </p>
          )}

          {/* ── Entry table ── */}
          <table border={1} cellPadding={4} style={{ fontSize: 12, marginBottom: 12 }}>
            <thead>
              <tr>
                <th>ID</th>
                {sectionFields(activeSection).includes("image") && <th>Image Asset ID</th>}
                {/* Columns follow the section, or a copy-only section like
                    products/drivers showed three case-study columns that are
                    always empty for it — the saved values were invisible. */}
                {sectionFields(activeSection).includes("copy") && (
                  <>
                    <th>{activeSection === "products" ? "Name override" : "Label override"}</th>
                    <th>{activeSection === "products" ? "Blurb" : "Hint"}</th>
                  </>
                )}
                {activeSection === "products" && (
                  <>
                    <th>Description</th>
                    <th>Best for</th>
                    <th>Watch out</th>
                  </>
                )}
                {sectionFields(activeSection).includes("caseStudy") && (
                  <>
                    <th>Case Study Title</th>
                    <th>Best When</th>
                    <th>Watch Out</th>
                  </>
                )}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sectionRows.length === 0 && (
                <tr><td colSpan={9} style={{ color: "#aaa" }}>No entries yet.</td></tr>
              )}
              {sectionRows.map((row, i) => (
                <tr key={i} style={{ background: editingIndex === i ? "#fffbe6" : "transparent" }}>
                  <td><code>{row.id}</code></td>
                  {sectionFields(activeSection).includes("image") && (
                    <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.imageAssetId || dash}
                    </td>
                  )}
                  {sectionFields(activeSection).includes("copy") && (
                    <>
                      <td>{row.label || dash}</td>
                      <td style={cellClamp}>{row.hint || dash}</td>
                    </>
                  )}
                  {activeSection === "products" && (
                    <>
                      <td style={cellClamp}>{row.description || dash}</td>
                      <td style={cellClamp}>{bullets(row.bestFor)}</td>
                      <td style={cellClamp}>{bullets(row.watchOut)}</td>
                    </>
                  )}
                  {sectionFields(activeSection).includes("caseStudy") && (
                    <>
                      <td>{row.caseStudy.title || dash}</td>
                      <td>{row.caseStudy.bestWhen || dash}</td>
                      <td>{row.caseStudy.watchOut || dash}</td>
                    </>
                  )}
                  <td>
                    <button onClick={() => handleEdit(i)}>Edit</button>{" "}
                    <button onClick={() => handleRemove(i)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── Entry form ── */}
          <h4 style={{ marginBottom: 4 }}>{editingIndex !== null ? "Edit Entry" : "Add Entry"} — {sectionMeta.label}</h4>
          <table>
            <tbody>
              <tr>
                <td>ID (input key)</td>
                <td>
                  <input
                    value={entryForm.id}
                    onChange={e => setEntryForm(f => ({ ...f, id: e.target.value }))}
                    disabled={editingIndex !== null}
                    style={{ width: 200 }}
                  />
                  {availableIds[activeSection].length > 0 && editingIndex === null && (
                    <select
                      style={{ marginLeft: 6 }}
                      value=""
                      onChange={e => setEntryForm(f => ({ ...f, id: e.target.value }))}
                    >
                      <option value="">pick from list…</option>
                      {availableIds[activeSection].map(a => (
                        <option key={a.id} value={a.id}>{a.label}</option>
                      ))}
                    </select>
                  )}
                </td>
              </tr>
              {/* The NAME always comes from the backend object; these overrides
                  exist for when the player-facing wording should differ from the
                  one the operator administers by. */}
              {sectionFields(activeSection).includes("copy") && (
                <>
                  <tr>
                    <td>Label override</td>
                    <td>
                      <input
                        placeholder={
                          activeSection === "products"
                            ? "blank = use the Product's own productName"
                            : "blank = use the ProductField's own label"
                        }
                        value={entryForm.label}
                        onChange={e => setEntryForm(f => ({ ...f, label: e.target.value }))}
                        style={{ width: 320 }}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>{activeSection === "products" ? "Blurb" : "Hint"}</td>
                    <td>
                      <textarea
                        placeholder={
                          activeSection === "products"
                            ? "one line under the notebook's name"
                            : "tooltip on the driver row — blank = no tooltip"
                        }
                        value={entryForm.hint}
                        onChange={e => setEntryForm(f => ({ ...f, hint: e.target.value }))}
                        rows={2}
                        style={{ width: 320 }}
                      />
                    </td>
                  </tr>
                  {activeSection === "products" && (
                    <>
                      <tr>
                        <td>Description</td>
                        <td>
                          <textarea
                            placeholder="the longer prose the Details tab shows"
                            value={entryForm.description}
                            onChange={e => setEntryForm(f => ({ ...f, description: e.target.value }))}
                            rows={4}
                            style={{ width: 320 }}
                          />
                        </td>
                      </tr>
                      {/* Both render as BULLET LISTS on the Details tab, so the
                          textarea is line-per-bullet. Blank = the panel renders
                          empty, which is a legitimate state. */}
                      <tr>
                        <td>Best for (Strengths)</td>
                        <td>
                          <textarea
                            placeholder="one strength per line"
                            value={entryForm.bestFor}
                            onChange={e => setEntryForm(f => ({ ...f, bestFor: e.target.value }))}
                            rows={4}
                            style={{ width: 320 }}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td>Watch out (Weakness)</td>
                        <td>
                          <textarea
                            placeholder="one weakness per line"
                            value={entryForm.watchOut}
                            onChange={e => setEntryForm(f => ({ ...f, watchOut: e.target.value }))}
                            rows={4}
                            style={{ width: 320 }}
                          />
                        </td>
                      </tr>
                    </>
                  )}
                </>
              )}
              {/* Channels render no artwork, so the player's hydrator ignores
                  imageAssetId for them — offering the picker would invite an
                  operator to set a value that does nothing. */}
              {sectionFields(activeSection).includes("image") && (
              <tr>
                <td>Image Asset</td>
                <td>
                  <input
                    placeholder="imageAssetId URL or leave blank"
                    value={entryForm.imageAssetId}
                    onChange={e => setEntryForm(f => ({ ...f, imageAssetId: e.target.value }))}
                    style={{ width: 320 }}
                  />
                  {imageAssets.length > 0 && (
                    <select
                      style={{ marginLeft: 6 }}
                      value=""
                      onChange={e => setEntryForm(f => ({ ...f, imageAssetId: e.target.value }))}
                    >
                      <option value="">pick from uploads…</option>
                      {imageAssets.map((a: any) => (
                        <option key={a._id} value={a.url ?? a._id}>{a.filename ?? a._id}</option>
                      ))}
                    </select>
                  )}
                </td>
              </tr>
              )}
              {sectionFields(activeSection).includes("caseStudy") && (
                <>
                  <tr><td colSpan={2}><strong>Case Study</strong></td></tr>
                  <tr>
                    <td>Title</td>
                    <td><input value={entryForm.caseStudy.title} onChange={e => setCaseStudyField("title", e.target.value)} style={{ width: 320 }} /></td>
                  </tr>
                  <tr>
                    <td>Brief</td>
                    <td><textarea value={entryForm.caseStudy.brief} onChange={e => setCaseStudyField("brief", e.target.value)} rows={3} style={{ width: 320 }} /></td>
                  </tr>
                  <tr>
                    <td>Best When</td>
                    <td><textarea value={entryForm.caseStudy.bestWhen} onChange={e => setCaseStudyField("bestWhen", e.target.value)} rows={2} style={{ width: 320 }} /></td>
                  </tr>
                  <tr>
                    <td>Watch Out</td>
                    <td><textarea value={entryForm.caseStudy.watchOut} onChange={e => setCaseStudyField("watchOut", e.target.value)} rows={2} style={{ width: 320 }} /></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
          <div style={{ marginTop: 6 }}>
            <button onClick={handleAddOrUpdate}>{editingIndex !== null ? "Update" : "Add"}</button>
            {editingIndex !== null && <button onClick={resetForm} style={{ marginLeft: 4 }}>Cancel</button>}
          </div>

          {/* ── Save ── */}
          <div style={{ marginTop: 16, borderTop: "1px solid #ccc", paddingTop: 12 }}>
            <button onClick={handleSave} disabled={loading} style={{ fontWeight: "bold" }}>
              {loading ? "Saving…" : configId ? "Save Changes" : "Create Config"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
