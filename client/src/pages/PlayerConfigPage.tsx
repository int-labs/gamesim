import { useState, useEffect } from "react";
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
  /** `drivers` only — overrides the ProductField's own label. Blank = use it. */
  label: string;
  /** `drivers` only — the tooltip on the market card's driver row. */
  hint: string;
}

const BLANK_CASE_STUDY: CaseStudy = { title: "", brief: "", bestWhen: "", watchOut: "" };
const BLANK_ENTRY: ConfigEntry = {
  id: "", imageAssetId: "", caseStudy: { ...BLANK_CASE_STUDY }, label: "", hint: "",
};

type Section = "vendors" | "candidates" | "marketingTeams" | "channels" | "drivers";

// `key` is the section name stored on PlayerConfig.config and read by the
// player's configHydrator. `idsFrom` says where the valid ids come from:
//
//   globalInput:<key>  — that container's ITEM KEYS
//   productFields      — the PRODUCT FIELD keys, across every product
//
// Channels carry case-study copy only; drivers carry label + hint only. In both
// cases the NUMBERS live on the backend object and are read straight off it.
const SECTIONS: { key: Section; label: string; idsFrom: string }[] = [
  { key: "vendors",       label: "Vendors",         idsFrom: "globalInput:supply_chain" },
  { key: "candidates",    label: "Candidates",       idsFrom: "globalInput:hiring" },
  { key: "marketingTeams",label: "Marketing Teams",  idsFrom: "globalInput:marketing" },
  { key: "channels",      label: "Channels",         idsFrom: "globalInput:channel" },
  { key: "drivers",       label: "Customer Drivers", idsFrom: "productFields" },
];

/** Sections whose entries are COPY ONLY — no artwork, no case study. */
const COPY_ONLY_SECTIONS = new Set<Section>(["drivers"]);

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

  // Available IDs per section (from globalInputs, for reference)
  const [availableIds, setAvailableIds]       = useState<Record<Section, string[]>>(
    emptyBySection<string>(),
  );

  // Uploaded image assets for the image picker
  const [imageAssets, setImageAssets]         = useState<any[]>([]);

  // Editing state
  const [activeSection, setActiveSection]     = useState<Section>("vendors");
  const [entryForm, setEntryForm]             = useState<ConfigEntry>({ ...BLANK_ENTRY, caseStudy: { ...BLANK_CASE_STUDY } });
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
      setAvailableIds(emptyBySection<string>());
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
    const ids: Record<Section, string[]> = emptyBySection<string>();

    const needsGlobalInputs = SECTIONS.some((s) => s.idsFrom.startsWith("globalInput:"));
    const needsProductFields = SECTIONS.some((s) => s.idsFrom === "productFields");

    const [giAll, productAll] = await Promise.all([
      needsGlobalInputs
        ? getGlobalInputs(selectedSimTypeId, undefined)
            .then((r) => (r.data?.data ?? r.data) as any[])
            .catch(() => [] as any[])
        : Promise.resolve([] as any[]),
      needsProductFields
        ? getProducts(selectedSimTypeId)
            .then((r) => (r.data?.data ?? r.data) as any[])
            .catch(() => [] as any[])
        : Promise.resolve([] as any[]),
    ]);

    for (const { key, idsFrom } of SECTIONS) {
      if (idsFrom === "productFields") {
        // Deduped across products: the same field key appears on every product,
        // and one hint describes the axis, not one product's copy of it.
        const keys = new Set<string>();
        for (const p of productAll) {
          for (const f of p?.fields ?? []) if (f?.key) keys.add(String(f.key));
        }
        ids[key] = [...keys];
        continue;
      }
      const giKey = idsFrom.slice("globalInput:".length);
      const gi = giAll.find((g: any) => g.key === giKey);
      ids[key] = (gi?.inputs ?? []).map((item: any) => item.key);
    }

    setAvailableIds(ids);
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const normaliseEntry = (raw: any): ConfigEntry => ({
    id:           raw.id ?? "",
    imageAssetId: raw.imageAssetId ?? "",
    label:        raw.label ?? "",
    hint:         raw.hint ?? "",
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
    setEntryForm({ ...BLANK_ENTRY, caseStudy: { ...BLANK_CASE_STUDY } });
    setEditingIndex(null);
  };

  // ── Entry CRUD (local, committed on Save) ──────────────────────────────────

  const handleAddOrUpdate = () => {
    if (!entryForm.id.trim()) { setError("ID is required"); return; }
    setConfig(prev => {
      const rows = [...prev[activeSection]];
      if (editingIndex !== null) {
        rows[editingIndex] = { ...entryForm };
      } else {
        rows.push({ ...entryForm });
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
              {availableIds[activeSection].join(", ")}
            </p>
          )}

          {/* ── Entry table ── */}
          <table border={1} cellPadding={4} style={{ fontSize: 12, marginBottom: 12 }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Image Asset ID</th>
                <th>Case Study Title</th>
                <th>Best When</th>
                <th>Watch Out</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sectionRows.length === 0 && (
                <tr><td colSpan={6} style={{ color: "#aaa" }}>No entries yet.</td></tr>
              )}
              {sectionRows.map((row, i) => (
                <tr key={i} style={{ background: editingIndex === i ? "#fffbe6" : "transparent" }}>
                  <td><code>{row.id}</code></td>
                  <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.imageAssetId || <span style={{ color: "#aaa" }}>—</span>}
                  </td>
                  <td>{row.caseStudy.title || <span style={{ color: "#aaa" }}>—</span>}</td>
                  <td>{row.caseStudy.bestWhen || <span style={{ color: "#aaa" }}>—</span>}</td>
                  <td>{row.caseStudy.watchOut || <span style={{ color: "#aaa" }}>—</span>}</td>
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
                      {availableIds[activeSection].map(id => (
                        <option key={id} value={id}>{id}</option>
                      ))}
                    </select>
                  )}
                </td>
              </tr>
              {/* Drivers: label + hint, and nothing else. The axis NAME already
                  comes from ProductField.label, so this override exists only for
                  when the operator wants player-facing wording that differs from
                  the field name they administer by. */}
              {COPY_ONLY_SECTIONS.has(activeSection) && (
                <>
                  <tr>
                    <td>Label override</td>
                    <td>
                      <input
                        placeholder="blank = use the ProductField's own label"
                        value={entryForm.label}
                        onChange={e => setEntryForm(f => ({ ...f, label: e.target.value }))}
                        style={{ width: 320 }}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>Hint</td>
                    <td>
                      <textarea
                        placeholder="tooltip on the driver row — blank = no tooltip"
                        value={entryForm.hint}
                        onChange={e => setEntryForm(f => ({ ...f, hint: e.target.value }))}
                        rows={2}
                        style={{ width: 320 }}
                      />
                    </td>
                  </tr>
                </>
              )}
              {/* Channels render no artwork, so the player's hydrator ignores
                  imageAssetId for them — offering the picker would invite an
                  operator to set a value that does nothing. */}
              {activeSection !== "channels" && !COPY_ONLY_SECTIONS.has(activeSection) && (
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
              {!COPY_ONLY_SECTIONS.has(activeSection) && (
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
