import { useState, useEffect } from "react";
import {
  getSimulationTypes,
  getGlobalInputs,
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
}

const BLANK_CASE_STUDY: CaseStudy = { title: "", brief: "", bestWhen: "", watchOut: "" };
const BLANK_ENTRY: ConfigEntry = { id: "", imageAssetId: "", caseStudy: { ...BLANK_CASE_STUDY } };

type Section = "vendors" | "candidates" | "marketingTeams";

const SECTIONS: { key: Section; label: string; globalInputKey: string }[] = [
  { key: "vendors",       label: "Vendors",         globalInputKey: "supply_chain" },
  { key: "candidates",    label: "Candidates",       globalInputKey: "hiring" },
  { key: "marketingTeams",label: "Marketing Teams",  globalInputKey: "marketing" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function PlayerConfigPage() {
  const [simTypes, setSimTypes]               = useState<any[]>([]);
  const [selectedSimTypeId, setSelectedSimTypeId] = useState("");

  // Loaded state from backend
  const [configId, setConfigId]               = useState<string | null>(null);
  const [config, setConfig]                   = useState<Record<Section, ConfigEntry[]>>({
    vendors: [], candidates: [], marketingTeams: [],
  });

  // Available IDs per section (from globalInputs, for reference)
  const [availableIds, setAvailableIds]       = useState<Record<Section, string[]>>({
    vendors: [], candidates: [], marketingTeams: [],
  });

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
      setConfig({ vendors: [], candidates: [], marketingTeams: [] });
      setAvailableIds({ vendors: [], candidates: [], marketingTeams: [] });
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
      setConfig({
        vendors:       (cfg.vendors       ?? []).map(normaliseEntry),
        candidates:    (cfg.candidates    ?? []).map(normaliseEntry),
        marketingTeams:(cfg.marketingTeams ?? []).map(normaliseEntry),
      });
    } catch (e: any) {
      // 404 = no config yet; anything else is a real error
      if (e.response?.status !== 404) setError(e.message);
      setConfigId(null);
      setConfig({ vendors: [], candidates: [], marketingTeams: [] });
    }
  };

  const loadAvailableIds = async () => {
    const ids: Record<Section, string[]> = { vendors: [], candidates: [], marketingTeams: [] };
    await Promise.all(
      SECTIONS.map(async ({ key, globalInputKey }) => {
        try {
          const res = await getGlobalInputs(selectedSimTypeId, undefined);
          const all: any[] = res.data?.data ?? res.data;
          const gi = all.find((g: any) => g.key === globalInputKey);
          ids[key] = (gi?.inputs ?? []).map((item: any) => item.key);
        } catch {}
      })
    );
    setAvailableIds(ids);
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const normaliseEntry = (raw: any): ConfigEntry => ({
    id:           raw.id ?? "",
    imageAssetId: raw.imageAssetId ?? "",
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

          {/* ── Available IDs from globalInputs ── */}
          {availableIds[activeSection].length > 0 && (
            <p style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>
              Available IDs from <code>{sectionMeta.globalInputKey}</code>:{" "}
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
