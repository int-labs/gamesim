import { useState, useEffect } from "react";
import {
  getSimulations,
  getTeams,
  getProducts,
  getProductFields,
  getInitiatives,
  getImageAssets,
  getDecisions,
  createDecision,
  deleteDecision,
} from "../api"; // adjust path to match the rest of the pages

type AddedProductInput = {
  productId: string;
  segmentId: string;
  productName: string;
  fieldConfigs: any[]; // from getProductFields — used for rendering only, not submitted directly
  fieldValues: Record<string, { value: string; imageAssets: string[] }>;
};

const DecisionDetail = ({ decision }: { decision: any }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(o => !o)} style={{ fontSize: 11, cursor: "pointer" }}>
        {open ? "▾" : "▸"} {decision.inputs?.length ?? 0} product(s), {decision.initiativeInputs?.length ?? 0} initiative(s)
      </button>
      {open && (
        <div style={{ paddingLeft: 8, fontSize: 11 }}>
          {(decision.inputs || []).map((inp: any, i: number) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <strong>{inp.productName}</strong> ({inp.segmentId})
              <table border={1} cellPadding={2} style={{ fontSize: 10 }}>
                <thead><tr><th>fieldId</th><th>value</th><th>images</th></tr></thead>
                <tbody>
                  {(inp.fields || []).map((f: any, j: number) => (
                    <tr key={j}>
                      <td>{f.fieldId}</td>
                      <td>{f.value}</td>
                      <td>
                        {(f.imageAssets || []).map((img: any) => (
                          <img
                            key={img._id}
                            src={img.imageUrl}
                            alt=""
                            style={{ width: 30, height: 30, objectFit: "cover", marginRight: 2 }}
                          />
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {(decision.initiativeInputs || []).length > 0 && (
            <div>
              <strong>Initiatives</strong>
              <table border={1} cellPadding={2} style={{ fontSize: 10 }}>
                <thead><tr><th>name</th><th>details</th><th>cost</th><th>energy</th></tr></thead>
                <tbody>
                  {decision.initiativeInputs.map((init: any, k: number) => (
                    <tr key={k}>
                      <td>{init.name}</td>
                      <td>{init.details}</td>
                      <td>{init.costConsumption}</td>
                      <td>{init.energyConsumption}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function DecisionsPage() {
  // ---- create form state ----
  const [simulations, setSimulations] = useState<any[]>([]);
  const [selectedSimulationId, setSelectedSimulationId] = useState("");
  const [selectedSimulationTypeId, setSelectedSimulationTypeId] = useState("");

  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");

  const [roundNumber, setRoundNumber] = useState(0);

  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductToAdd, setSelectedProductToAdd] = useState("");
  const [addedProducts, setAddedProducts] = useState<AddedProductInput[]>([]);

  const [initiatives, setInitiatives] = useState<any[]>([]);
  const [checkedInitiativeIds, setCheckedInitiativeIds] = useState<string[]>([]);

  const [imageAssets, setImageAssets] = useState<any[]>([]);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ---- list/filter state ----
  const [filterSim, setFilterSim] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterRound, setFilterRound] = useState("");
  const [rows, setRows] = useState<any[]>([]);

  // ---- initial fetches ----
  useEffect(() => {
    getSimulations().then(res => setSimulations(res.data?.data ?? res.data)).catch((e: any) => setError(e.message));
    getInitiatives().then(res => setInitiatives(res.data?.data ?? res.data)).catch((e: any) => setError(e.message));
    getImageAssets().then(res => setImageAssets(res.data?.data ?? res.data)).catch((e: any) => setError(e.message));
  }, []);

  // ---- simulation changes: derive simulationTypeId, load teams, reset dependents ----
  useEffect(() => {
    setSelectedTeamId("");
    setTeams([]);
    setAddedProducts([]);
    setProducts([]);
    setSelectedProductToAdd("");

    if (!selectedSimulationId) {
      setSelectedSimulationTypeId("");
      return;
    }

    const sim = simulations.find((s: any) => s._id === selectedSimulationId);
    setSelectedSimulationTypeId(sim?.simulationTypeId ?? "");

    getTeams(selectedSimulationId)
      .then(res => setTeams(res.data?.data ?? res.data))
      .catch((e: any) => setError(e.message));
  }, [selectedSimulationId]);

  // ---- derived simulationTypeId changes: load products ----
  useEffect(() => {
    if (!selectedSimulationTypeId) {
      setProducts([]);
      return;
    }
    getProducts(selectedSimulationTypeId)
      .then(res => setProducts(res.data?.data ?? res.data))
      .catch((e: any) => setError(e.message));
  }, [selectedSimulationTypeId]);

  const handleAddProduct = async () => {
    if (!selectedProductToAdd) return;
    if (addedProducts.some(p => p.productId === selectedProductToAdd)) {
      setError("That product has already been added.");
      return;
    }
    const product = products.find((p: any) => p._id === selectedProductToAdd);
    if (!product) return;

    try {
      const res = await getProductFields(selectedProductToAdd);
      const fieldConfigs = res.data?.data ?? res.data;
      setAddedProducts(prev => [
        ...prev,
        {
          productId: product._id,
          segmentId: product.segmentId,
          productName: product.productName,
          fieldConfigs,
          fieldValues: {},
        },
      ]);
      setSelectedProductToAdd("");
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRemoveProduct = (productId: string) => {
    setAddedProducts(prev => prev.filter(p => p.productId !== productId));
  };

  const handleFieldValueChange = (productId: string, fieldId: string, value: string) => {
    setAddedProducts(prev =>
      prev.map(p =>
        p.productId === productId
          ? {
              ...p,
              fieldValues: {
                ...p.fieldValues,
                [fieldId]: { ...(p.fieldValues[fieldId] ?? { value: "", imageAssets: [] }), value },
              },
            }
          : p
      )
    );
  };

  const handleToggleFieldImage = (productId: string, fieldId: string, imageId: string) => {
    setAddedProducts(prev =>
      prev.map(p => {
        if (p.productId !== productId) return p;
        const current = p.fieldValues[fieldId]?.imageAssets ?? [];
        const next = current.includes(imageId)
          ? current.filter((id: string) => id !== imageId)
          : [...current, imageId];
        return {
          ...p,
          fieldValues: {
            ...p.fieldValues,
            [fieldId]: { ...(p.fieldValues[fieldId] ?? { value: "", imageAssets: [] }), imageAssets: next },
          },
        };
      })
    );
  };

  const toggleInitiative = (id: string) => {
    setCheckedInitiativeIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  // ---- list loading — simulationId is required, mirrors the BaseData/Products fix ----
  const load = async () => {
    if (!filterSim) {
      setRows([]);
      return;
    }
    try {
      const res = await getDecisions(
        filterSim,
        filterTeam || undefined,
        filterRound !== "" ? Number(filterRound) : undefined
      );
      setRows(res.data?.data ?? res.data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
  }, [filterSim, filterTeam, filterRound]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this decision?")) return;
    try {
      await deleteDecision(id);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  const canSubmit = addedProducts.length > 0 && checkedInitiativeIds.length > 0;

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      const inputs = addedProducts.map(p => ({
        productId: p.productId,
        segmentId: p.segmentId,
        productName: p.productName,
        fields: Object.entries(p.fieldValues).map(([fieldId, v]) => ({
          fieldId,
          value: v.value,
          imageAssets: v.imageAssets,
        })),
      }));

      const initiativeInputs = initiatives
        .filter((i: any) => checkedInitiativeIds.includes(i._id))
        .map((i: any) => ({
          name: i.name,
          details: i.details,
          costConsumption: i.costConsumption,
          energyConsumption: i.energyConsumption,
        }));

      await createDecision({
        simulationId: selectedSimulationId,
        teamId: selectedTeamId,
        roundNumber: Number(roundNumber),
        inputs,
        initiativeInputs,
        globalInputs: [], // DEFERRED — designed after calc layer
      });

      setSelectedSimulationId("");
      setSelectedTeamId("");
      setRoundNumber(0);
      setAddedProducts([]);
      setCheckedInitiativeIds([]);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Decisions</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <h3>Create</h3>
      <table>
        <tbody>
          <tr>
            <td>Simulation</td>
            <td>
              <select value={selectedSimulationId} onChange={e => setSelectedSimulationId(e.target.value)}>
                <option value="">-- select --</option>
                {simulations.map((s: any) => (
                  <option key={s._id} value={s._id}>{s.name ?? s._id}</option>
                ))}
              </select>
            </td>
          </tr>
          <tr>
            <td>Team</td>
            <td>
              <select value={selectedTeamId} onChange={e => setSelectedTeamId(e.target.value)} disabled={!selectedSimulationId}>
                <option value="">-- select --</option>
                {teams.map((t: any) => (
                  <option key={t._id} value={t._id}>{t.teamName ?? t._id}</option>
                ))}
              </select>
            </td>
          </tr>
          <tr>
            <td>Round Number</td>
            <td><input type="number" value={roundNumber} onChange={e => setRoundNumber(Number(e.target.value))} /></td>
          </tr>
        </tbody>
      </table>

      <h4>Products</h4>
      <select value={selectedProductToAdd} onChange={e => setSelectedProductToAdd(e.target.value)} disabled={!selectedSimulationTypeId}>
        <option value="">-- select product to add --</option>
        {products
          .filter((p: any) => !addedProducts.some(ap => ap.productId === p._id))
          .map((p: any) => (
            <option key={p._id} value={p._id}>{p.productName}</option>
          ))}
      </select>
      <button onClick={handleAddProduct} disabled={!selectedProductToAdd}>Add Product</button>

      {addedProducts.map(p => (
        <div key={p.productId} style={{ border: "1px solid #ccc", padding: 8, marginTop: 8 }}>
          <strong>{p.productName}</strong>{" "}
          <button onClick={() => handleRemoveProduct(p.productId)}>Remove</button>
          <table>
            <tbody>
              {p.fieldConfigs.map((fc: any) => (
                <tr key={fc._id}>
                  <td>{fc.label}{fc.required ? " *" : ""}</td>
                  <td>
                    {fc.type.includes("image") ? (
                      <div>
                        {imageAssets.map((img: any) => (
                          <label key={img._id} style={{ marginRight: 8 }}>
                            <input
                              type="checkbox"
                              checked={(p.fieldValues[fc._id]?.imageAssets ?? []).includes(img._id)}
                              onChange={() => handleToggleFieldImage(p.productId, fc._id, img._id)}
                            />
                            {img.imageUrl
                              ? <img src={img.imageUrl} alt="" style={{ width: 24, height: 24, objectFit: "cover" }} />
                              : img._id}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <input
                        value={p.fieldValues[fc._id]?.value ?? ""}
                        onChange={e => handleFieldValueChange(p.productId, fc._id, e.target.value)}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <h4>Initiatives</h4>
      {initiatives.map((i: any) => (
        <label key={i._id} style={{ display: "block" }}>
          <input
            type="checkbox"
            checked={checkedInitiativeIds.includes(i._id)}
            onChange={() => toggleInitiative(i._id)}
          />
          {" "}{i.name}
        </label>
      ))}

      <div style={{ marginTop: 8 }}>
        <button onClick={handleCreate} disabled={loading || !canSubmit}>Create</button>
      </div>

      <h3>All Decisions</h3>
      <label>Filter Sim ID (required): <input value={filterSim} onChange={e => setFilterSim(e.target.value)} /></label>
      {" "}
      <label>Filter Team ID: <input value={filterTeam} onChange={e => setFilterTeam(e.target.value)} /></label>
      {" "}
      <label>Filter Round#: <input type="number" value={filterRound} onChange={e => setFilterRound(e.target.value)} style={{ width: 60 }} /></label>

      <table border={1} cellPadding={4} style={{ marginTop: 8 }}>
        <thead>
          <tr><th>_id</th><th>SimId</th><th>TeamId</th><th>Round</th><th>Details</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r._id}>
              <td>{r._id}</td>
              <td>{r.simulationId}</td>
              <td>{r.teamId}</td>
              <td>{r.roundNumber}</td>
              <td><DecisionDetail decision={r} /></td>
              <td><button onClick={() => handleDelete(r._id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}