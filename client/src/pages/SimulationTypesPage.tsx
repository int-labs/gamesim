import { useEffect, useState } from "react";
import { getSimulationTypes, createSimulationType, deleteSimulationType } from "../api";
import type { SimulationType } from "../types";

const BLANK = {
  name: "",
  description: "",
  brandName: "",
  yearRange: { start: 0, end: 0 },
  pastData: {} as Record<string, { marketSize: number; marketGrowth: number }>,
  reportPlacement: { cashflow: "product", pnl: "product", balancesheet: "product", bizperf: "product" },
};

export default function SimulationTypesPage() {
  const [rows, setRows] = useState<SimulationType[]>([]);
  const [form, setForm] = useState({ ...BLANK });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [outputsJson, setOutputsJson] = useState("[]");

  const load = async () => {
    try {
      const res = await getSimulationTypes();
      setRows(res.data?.data ?? res.data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    const { start, end } = form.yearRange;
    if (start === undefined || end === undefined || end < start) return;

    setForm(f => {
      const nextPastData: Record<string, { marketSize: number; marketGrowth: number }> = {};
      for (let y = start; y <= end; y++) {
        const key = String(y);
        nextPastData[key] = f.pastData?.[key] ?? { marketSize: 0, marketGrowth: 0 };
      }
      return { ...f, pastData: nextPastData };
    });
  }, [form.yearRange.start, form.yearRange.end]);useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      let outputs;
      try {
        outputs = outputsJson.trim() ? JSON.parse(outputsJson) : [];
      } catch {
        setError("Outputs is not valid JSON.");
        setLoading(false);
        return;
      }

      await createSimulationType({ ...form, outputs });
      setForm({ ...BLANK });
      setOutputsJson("[]");
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this simulation type?")) return;
    try {
      await deleteSimulationType(id);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  return (
    <div>
      <h2>Simulation Types</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <h3>Create</h3>
      <table>
        <tbody>
          <tr>
            <td>Name</td>
            <td><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></td>
          </tr>
          <tr>
            <td>Description</td>
            <td><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></td>
          </tr>
          <tr>
            <td>Brand Name</td>
            <td><input value={form.brandName} onChange={e => setForm(f => ({ ...f, brandName: e.target.value }))} /></td>
          </tr>
          <tr>
            <td>Year Range</td>
            <td>
              Start:{" "}
              <input
                type="number"
                value={form.yearRange.start}
                onChange={e => setForm(f => ({ ...f, yearRange: { ...f.yearRange, start: Number(e.target.value) } }))}
                style={{ width: 80 }}
              />{" "}
              End:{" "}
              <input
                type="number"
                value={form.yearRange.end}
                onChange={e => setForm(f => ({ ...f, yearRange: { ...f.yearRange, end: Number(e.target.value) } }))}
                style={{ width: 80 }}
              />
            </td>
          </tr>
          <tr>
            <td>Past Data</td>
            <td>
              {Object.keys(form.pastData).length === 0 && <span style={{ color: "#888" }}>Set a year range first</span>}
              {Object.entries(form.pastData).map(([year, data]: [string, any]) => (
                <div key={year} style={{ marginBottom: 4 }}>
                  <strong>{year}</strong>{" "}
                  Market Size:{" "}
                  <input
                    type="number"
                    value={data.marketSize}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        pastData: { ...f.pastData, [year]: { ...f.pastData[year], marketSize: Number(e.target.value) } },
                      }))
                    }
                    style={{ width: 100 }}
                  />{" "}
                  Market Growth:{" "}
                  <input
                    type="number"
                    step="0.01"
                    value={data.marketGrowth}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        pastData: { ...f.pastData, [year]: { ...f.pastData[year], marketGrowth: Number(e.target.value) } },
                      }))
                    }
                    style={{ width: 100 }}
                  />
                </div>
              ))}
            </td>
          </tr>
          <tr>
            <td>Outputs (JSON)</td>
            <td>
              <textarea
                value={outputsJson}
                onChange={e => setOutputsJson(e.target.value)}
                rows={6}
                style={{ width: "100%", fontFamily: "monospace", fontSize: 11 }}
              />
            </td>
          </tr>
          <tr>
            <td>Report Placement</td>
            <td>
              {(["cashflow", "pnl", "balancesheet", "bizperf"] as const).map(key => (
                <div key={key} style={{ marginBottom: 4 }}>
                  {key}:{" "}
                  <select
                    value={form.reportPlacement[key]}
                    onChange={e => setForm(f => ({ ...f, reportPlacement: { ...f.reportPlacement, [key]: e.target.value } }))}
                  >
                    <option value="product">product</option>
                    <option value="global">global</option>
                  </select>
                </div>
              ))}
            </td>
          </tr>
        </tbody>
      </table>
      <button onClick={handleCreate} disabled={loading}>Create</button>

      <h3>All Simulation Types</h3>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>_id</th><th>Name</th><th>Description</th><th>Brand</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r._id}>
              <td>{r._id}</td>
              <td>{r.name}</td>
              <td>{r.description}</td>
              <td>{r.brandName}</td>
              <td><button onClick={() => handleDelete(r._id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
