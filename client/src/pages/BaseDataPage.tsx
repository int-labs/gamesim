import { useEffect, useState } from "react";
import { getBaseData, createBaseData, getSegments, getProducts, getGlobalInputs } from "../api";
import type { BaseData } from "../types";
import { getSimulationTypes } from "../api";

const BLANK_FIELD = { key: "", label: "", formula: "", type: "", level: "", direction: 1, tightening: 3, elasticity: 1 };
const BLANK_DRIVER = { level: "global", key: "", label: "", productId: "", globalInputId: "", choiceKey: "" };

export default function BaseDataPage() {
  type MarketModelField = {
    key: string; label: string; formula: string; type: string; level?: string;
    direction: number; tightening: number; elasticity: number;
    coefficients: Record<string, number>;
  };

  type CsatDriver = {
    level: string; key: string; label: string;
    productId: string | null; globalInputId: string | null; choiceKey: string | null;
    coefficients: Record<string, number>;
  };

  type MarketModelProductInput = {
    productId: string; productName: string;
    fields: MarketModelField[]; segmentFields: MarketModelField[]; globalFields: MarketModelField[];
  };
  type MarketModelSegmentInput = { segmentId: string; segmentName: string; products: MarketModelProductInput[] };
  type YearData = { marketSize: number; marketGrowth: number };
  type MarketDataProductInput = { productId: string; productName: string; yearlyData: Record<string, YearData> };
  type MarketDataSegmentInput = { segmentId: string; segmentName: string; products: MarketDataProductInput[] };
  type CsatSegmentInput = { segmentId: string; segmentName: string; drivers: CsatDriver[] };

  const [marketDataSegments, setMarketDataSegments] = useState<MarketDataSegmentInput[]>([]);
  const [segmentOptions, setSegmentOptions] = useState<any[]>([]);
  const [selectedSegmentToAdd, setSelectedSegmentToAdd] = useState("");
  const [productOptionsBySegment, setProductOptionsBySegment] = useState<Record<string, any[]>>({});
  const [selectedProductToAddBySegment, setSelectedProductToAddBySegment] = useState<Record<string, string>>({});
  const [yearFormByProduct, setYearFormByProduct] = useState<Record<string, { year: string; marketSize: number; marketGrowth: number }>>({});

  const [record, setRecord] = useState<BaseData | null>(null);
  const [filterSimType, setFilterSimType] = useState("");
  const [error, setError] = useState("");

  const [simulationTypes, setSimulationTypes] = useState<any[]>([]);
  const [newSimTypeId, setNewSimTypeId] = useState("");
  const [constantsJson, setConstantsJson] = useState("[]");
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [creating, setCreating] = useState(false);

  const [marketModelSegments, setMarketModelSegments] = useState<MarketModelSegmentInput[]>([]);
  const [selectedMMSegmentToAdd, setSelectedMMSegmentToAdd] = useState("");
  const [selectedMMProductToAddBySegment, setSelectedMMProductToAddBySegment] = useState<Record<string, string>>({});

  const [csatSegments, setCsatSegments] = useState<CsatSegmentInput[]>([]);
  const [selectedCsatSegmentToAdd, setSelectedCsatSegmentToAdd] = useState("");
  const [globalInputOptions, setGlobalInputOptions] = useState<any[]>([]);

  const selectedSimType = simulationTypes.find((st: any) => st._id === newSimTypeId);
  const yearKeys = selectedSimType?.yearRange
    ? Array.from(
        { length: selectedSimType.yearRange.end - selectedSimType.yearRange.start + 1 },
        (_, i) => String(selectedSimType.yearRange.start + i)
      )
    : [];

  const handleCreateBaseData = async () => {
    setCreating(true);
    setCreateError("");
    setCreateSuccess("");


    try {
      let constants;

      const csatMarketModel = {
        segments: csatSegments.map(s => ({ segmentId: s.segmentId, drivers: s.drivers })),
      };
      
      const marketData = {
        segments: marketDataSegments.map(s => ({
          segmentId: s.segmentId,
          products: s.products.map(p => ({ productId: p.productId, yearlyData: p.yearlyData })),
        })),
      };

      const marketModel = {
        segments: marketModelSegments.map(s => ({
          segmentId: s.segmentId,
          products: s.products.map(p => ({
            productId: p.productId,
            fields: p.fields,
            segmentFields: p.segmentFields,
            globalFields: p.globalFields,
          })),
        })),
      };

      try {
        constants = constantsJson.trim() ? JSON.parse(constantsJson) : [];
      } catch {
        setCreateError("One of the JSON fields is invalid.");
        setCreating(false);
        return;
      }

      if (!newSimTypeId) {
        setCreateError("Simulation Type is required.");
        setCreating(false);
        return;
      }

      const res = await createBaseData({
        simulationTypeId: newSimTypeId,
        constants,
        marketData: marketData,
        marketModel: marketModel,
        csatMarketModel,
      });

      setCreateSuccess(`Created base data (id: ${res.data?.data?._id ?? res.data?._id})`);
      setNewSimTypeId("");
      setConstantsJson("[]");
    } catch (e: any) {
      setCreateError(e.response?.data?.message ?? e.message);
    } finally {
      setCreating(false);
    }
  };

  const load = async () => {
    try {
      const res = await getBaseData(filterSimType || undefined);
      setRecord(res.data?.data ?? res.data ?? null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    getSimulationTypes()
      .then(res => setSimulationTypes(res.data?.data ?? res.data))
      .catch((e: any) => setCreateError(e.message));
  }, []);
  
  //====================================================================
  //     MARKET DATA VIEW
  //====================================================================

  useEffect(() => {
    if (!newSimTypeId) {
      setSegmentOptions([]);
      setMarketDataSegments([]);
      return;
    }
    getSegments(newSimTypeId)
      .then(res => setSegmentOptions(res.data?.data ?? res.data))
      .catch((e: any) => setCreateError(e.message));
  }, [newSimTypeId]);

  const handleAddMarketDataSegment = () => {
    if (!selectedSegmentToAdd || marketDataSegments.some(s => s.segmentId === selectedSegmentToAdd)) return;
    const segment = segmentOptions.find((s: any) => s._id === selectedSegmentToAdd);
    setMarketDataSegments(prev => [...prev, { segmentId: selectedSegmentToAdd, segmentName: segment?.name ?? selectedSegmentToAdd, products: [] }]);
    getProducts(newSimTypeId, selectedSegmentToAdd)
      .then(res => setProductOptionsBySegment(prev => ({ ...prev, [selectedSegmentToAdd]: res.data?.data ?? res.data })))
      .catch((e: any) => setCreateError(e.message));
    setSelectedSegmentToAdd("");
  };

  const handleRemoveMarketDataSegment = (segmentId: string) => {
    setMarketDataSegments(prev => prev.filter(s => s.segmentId !== segmentId));
  };

  const handleAddMarketDataProduct = (segmentId: string) => {
    const productId = selectedProductToAddBySegment[segmentId];
    if (!productId) return;
    const product = (productOptionsBySegment[segmentId] || []).find((p: any) => p._id === productId);
    if (!product) return;
    setMarketDataSegments(prev =>
      prev.map(s =>
        s.segmentId === segmentId && !s.products.some(p => p.productId === productId)
          ? { ...s, products: [...s.products, { productId, productName: product.productName, yearlyData: {} }] }
          : s
      )
    );
    setSelectedProductToAddBySegment(prev => ({ ...prev, [segmentId]: "" }));
  };

  const handleRemoveMarketDataProduct = (segmentId: string, productId: string) => {
    setMarketDataSegments(prev =>
      prev.map(s => (s.segmentId === segmentId ? { ...s, products: s.products.filter(p => p.productId !== productId) } : s))
    );
  };

  const updateYearForm = (segmentId: string, productId: string, field: "year" | "marketSize" | "marketGrowth", value: any) => {
    const key = `${segmentId}:${productId}`;
    setYearFormByProduct(prev => ({ ...prev, [key]: { ...(prev[key] ?? { year: "", marketSize: 0, marketGrowth: 0 }), [field]: value } }));
  };

  const handleAddYearRow = (segmentId: string, productId: string) => {
    const key = `${segmentId}:${productId}`;
    const form = yearFormByProduct[key];
    if (!form || form.year === "") return;
    setMarketDataSegments(prev =>
      prev.map(s =>
        s.segmentId === segmentId
          ? {
              ...s,
              products: s.products.map(p =>
                p.productId === productId
                  ? { ...p, yearlyData: { ...p.yearlyData, [form.year]: { marketSize: form.marketSize, marketGrowth: form.marketGrowth } } }
                  : p
              ),
            }
          : s
      )
    );
    setYearFormByProduct(prev => ({ ...prev, [key]: { year: "", marketSize: 0, marketGrowth: 0 } }));
  };

  const handleRemoveYearRow = (segmentId: string, productId: string, year: string) => {
    setMarketDataSegments(prev =>
      prev.map(s =>
        s.segmentId === segmentId
          ? {
              ...s,
              products: s.products.map(p => {
                if (p.productId !== productId) return p;
                const next = { ...p.yearlyData };
                delete next[year];
                return { ...p, yearlyData: next };
              }),
            }
          : s
      )
    );
  };
  
  //====================================================================
  //     CSAT DRIVERS FIELD
  //====================================================================  

  useEffect(() => {
    if (!newSimTypeId) {
      setGlobalInputOptions([]);
      return;
    }
    getGlobalInputs(newSimTypeId)
      .then(res => setGlobalInputOptions(res.data?.data ?? res.data))
      .catch((e: any) => setCreateError(e.message));
  }, [newSimTypeId]);

  const handleAddCsatSegment = () => {
    if (!selectedCsatSegmentToAdd || csatSegments.some(s => s.segmentId === selectedCsatSegmentToAdd)) return;
    const segment = segmentOptions.find((s: any) => s._id === selectedCsatSegmentToAdd);
    setCsatSegments(prev => [...prev, { segmentId: selectedCsatSegmentToAdd, segmentName: segment?.name ?? selectedCsatSegmentToAdd, drivers: [] }]);
    if (!productOptionsBySegment[selectedCsatSegmentToAdd]) {
      getProducts(newSimTypeId, selectedCsatSegmentToAdd)
        .then(res => setProductOptionsBySegment(prev => ({ ...prev, [selectedCsatSegmentToAdd]: res.data?.data ?? res.data })))
        .catch((e: any) => setCreateError(e.message));
    }
    setSelectedCsatSegmentToAdd("");
  };

  const handleRemoveCsatSegment = (segmentId: string) => {
    setCsatSegments(prev => prev.filter(s => s.segmentId !== segmentId));
  };

  const updateCsatSegmentDrivers = (segmentId: string, drivers: CsatDriver[]) => {
    setCsatSegments(prev => prev.map(s => (s.segmentId === segmentId ? { ...s, drivers } : s)));
  };

  const CsatDriversEditor = ({
    drivers, onChange, yearKeys, productOptions, globalInputOptions,
  }: {
    drivers: CsatDriver[];
    onChange: (drivers: CsatDriver[]) => void;
    yearKeys: string[];
    productOptions: any[];
    globalInputOptions: any[];
  }) => {
    const blankCoefficients = () => Object.fromEntries(yearKeys.map(y => [y, 0]));
    const [form, setForm] = useState({ ...BLANK_DRIVER, coefficients: blankCoefficients() });
    const [editingKey, setEditingKey] = useState<string | null>(null);

    const resetForm = () => {
      setForm({ ...BLANK_DRIVER, coefficients: blankCoefficients() });
      setEditingKey(null);
    };

    const handleAdd = () => {
      if (!form.key || !form.label) return;
      const entry: CsatDriver = {
        level: form.level,
        key: form.key,
        label: form.label,
        productId: form.level === "product" ? (form.productId || null) : null,
        globalInputId: form.level === "global" ? (form.globalInputId || null) : null,
        choiceKey: form.choiceKey || null,
        coefficients: form.coefficients,
      };
      if (editingKey) {
        onChange(drivers.map(d => (d.key === editingKey ? entry : d)));
      } else {
        if (drivers.some(d => d.key === form.key)) return;
        onChange([...drivers, entry]);
      }
      resetForm();
    };

    const handleEdit = (d: CsatDriver) => {
      setEditingKey(d.key);
      setForm({
        level: d.level,
        key: d.key,
        label: d.label,
        productId: d.productId ?? "",
        globalInputId: d.globalInputId ?? "",
        choiceKey: d.choiceKey ?? "",
        coefficients: Object.fromEntries(yearKeys.map(y => [y, d.coefficients?.[y] ?? 0])),
      });
    };

    const handleDelete = (key: string) => {
      onChange(drivers.filter(d => d.key !== key));
      if (editingKey === key) resetForm();
    };

    return (
      <div style={{ marginTop: 6 }}>
        <table border={1} cellPadding={2} style={{ fontSize: 10, width: "100%" }}>
          <thead>
            <tr>
              <th>level</th><th>key</th><th>label</th><th>productId</th><th>globalInputId</th><th>choiceKey</th>
              {yearKeys.map(y => <th key={y}>{y}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {drivers.map(d => (
              <tr key={d.key}>
                <td>{d.level}</td>
                <td>{d.key}</td>
                <td>{d.label}</td>
                <td>{d.productId ?? ""}</td>
                <td>{d.globalInputId ?? ""}</td>
                <td>{d.choiceKey ?? ""}</td>
                {yearKeys.map(y => <td key={y}>{d.coefficients?.[y] ?? 0}</td>)}
                <td>
                  <button onClick={() => handleEdit(d)}>Edit</button>{" "}
                  <button onClick={() => handleDelete(d.key)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 4 }}>
          <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}>
            <option value="global">global</option>
            <option value="product">product</option>
          </select>
          <input placeholder="key" value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value }))} disabled={!!editingKey} />
          <input placeholder="label" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
          <input placeholder="choiceKey (optional)" value={form.choiceKey} onChange={e => setForm(f => ({ ...f, choiceKey: e.target.value }))} />

          {form.level === "product" && (
            <select value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}>
              <option value="">-- select product --</option>
              {productOptions.map((p: any) => (
                <option key={p._id} value={p._id}>{p.productName}</option>
              ))}
            </select>
          )}

          {form.level === "global" && (
            <select value={form.globalInputId} onChange={e => setForm(f => ({ ...f, globalInputId: e.target.value }))}>
              <option value="">-- select global input --</option>
              {globalInputOptions.map((gi: any) => (
                <option key={gi._id} value={gi._id}>[{gi.category}] {gi.label}</option>
              ))}
            </select>
          )}

          <div>
            {yearKeys.map(y => (
              <span key={y} style={{ marginRight: 4 }}>
                {y}:{" "}
                <input
                  type="number"
                  style={{ width: 60 }}
                  value={form.coefficients?.[y] ?? 0}
                  onChange={e => setForm(f => ({ ...f, coefficients: { ...f.coefficients, [y]: Number(e.target.value) } }))}
                />
              </span>
            ))}
          </div>

          <button onClick={handleAdd} disabled={yearKeys.length === 0}>{editingKey ? "Update" : "Add"} Driver</button>
          {editingKey && <button onClick={resetForm}>Cancel</button>}
        </div>
      </div>
    );
  };

  //====================================================================
  //     CSAT DRIVERS VIEW
  //====================================================================  

  const CsatDriversTable = ({ drivers }: { drivers: any[] }) => {
    if (!drivers || drivers.length === 0) return null;

    const yearKeys = Array.from(
      new Set(drivers.flatMap(d => Object.keys(d.coefficients || {})))
    ).sort((a, b) => Number(a) - Number(b));

    return (
      <table style={{ fontSize: 10, borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #ccc", padding: 2, textAlign: "left" }}>key</th>
            <th style={{ border: "1px solid #ccc", padding: 2, textAlign: "left" }}>label</th>
            <th style={{ border: "1px solid #ccc", padding: 2 }}>choiceKey</th>
            {yearKeys.map(y => (
              <th key={y} style={{ border: "1px solid #ccc", padding: 2 }}>{y}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {drivers.map((d, i) => (
            <tr key={`${d.key}-${i}`}>
              <td style={{ border: "1px solid #ccc", padding: 2 }}>{d.key}</td>
              <td style={{ border: "1px solid #ccc", padding: 2 }}>{d.label}</td>
              <td style={{ border: "1px solid #ccc", padding: 2 }}>{d.choiceKey ?? ""}</td>
              {yearKeys.map(y => (
                <td key={y} style={{ border: "1px solid #ccc", padding: 2, textAlign: "right" }}>
                  {d.coefficients?.[y] !== undefined ? String(d.coefficients[y]) : ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const SegmentDriversBlock = ({ drivers }: { drivers: any[] }) => {
    const globalDrivers = drivers.filter(d => d.level === "global");
    const segmentDrivers = drivers.filter(d => d.level === "segment");
    const productDrivers = drivers.filter(d => d.level === "product");

    const productGroups: Record<string, any[]> = {};
    productDrivers.forEach(d => {
      const pid = d.productId?.$oid ?? d.productId ?? "unknown";
      if (!productGroups[pid]) productGroups[pid] = [];
      productGroups[pid].push(d);
    });

    return (
      <div style={{ paddingLeft: 8 }}>
        {globalDrivers.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            <strong style={{ fontSize: 11 }}>Global — affects PnL globally</strong>
            <CsatDriversTable drivers={globalDrivers} />
          </div>
        )}
        {segmentDrivers.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            <strong style={{ fontSize: 11 }}>Segment — affects this segment</strong>
            <CsatDriversTable drivers={segmentDrivers} />
          </div>
        )}
        {Object.keys(productGroups).length > 0 && (
          <div style={{ marginBottom: 6 }}>
            <strong style={{ fontSize: 11 }}>Product — affects specific products</strong>
            {Object.entries(productGroups).map(([productId, ds]) => (
              <div key={productId} style={{ paddingLeft: 8, marginBottom: 4 }}>
                <em style={{ fontSize: 10 }}>Product {productId}</em>
                <CsatDriversTable drivers={ds} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const CsatMarketModelView = ({ csatMarketModel }: { csatMarketModel: any }) => {
    const [openSegments, setOpenSegments] = useState<Record<string, boolean>>({});

    if (!csatMarketModel || !csatMarketModel.segments?.length) {
      return <span style={{ color: "#888" }}>—</span>;
    }

    const toggleSegment = (id: string) =>
      setOpenSegments(prev => ({ ...prev, [id]: !prev[id] }));

    return (
      <div style={{ maxWidth: 480, maxHeight: 280, overflow: "auto", fontSize: 11 }}>
        {csatMarketModel.segments.map((segment: any) => {
          const segmentId = segment.segmentId?.$oid ?? segment.segmentId;
          const segOpen = !!openSegments[segmentId];
          return (
            <div key={segmentId} style={{ marginBottom: 4 }}>
              <button onClick={() => toggleSegment(segmentId)} style={{ fontSize: 11, cursor: "pointer" }}>
                {segOpen ? "▾" : "▸"} Segment {segmentId}
              </button>
              {segOpen && <SegmentDriversBlock drivers={segment.drivers || []} />}
            </div>
          );
        })}
      </div>
    );
  };

  const FieldsTable = ({ title, fields }: { title: string; fields: any[] }) => {
    if (!fields || fields.length === 0) return null;

    const yearKeys = Array.from(
      new Set(fields.flatMap(f => Object.keys(f.coefficients || {})))
    ).sort((a, b) => Number(a) - Number(b));

    return (
      <div style={{ marginBottom: 6 }}>
        <strong style={{ fontSize: 11 }}>{title}</strong>
        <table style={{ fontSize: 10, borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ border: "1px solid #ccc", padding: 2, textAlign: "left" }}>field</th>
              <th style={{ border: "1px solid #ccc", padding: 2 }}>direction</th>
              <th style={{ border: "1px solid #ccc", padding: 2 }}>tightening</th>
              <th style={{ border: "1px solid #ccc", padding: 2 }}>elasticity</th>
              {yearKeys.map(y => (
                <th key={y} style={{ border: "1px solid #ccc", padding: 2 }}>{y}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map(f => (
              <tr key={f.key}>
                <td style={{ border: "1px solid #ccc", padding: 2 }} title={f.key}>{f.label}</td>
                <td style={{ border: "1px solid #ccc", padding: 2, textAlign: "right" }}>{f.direction}</td>
                <td style={{ border: "1px solid #ccc", padding: 2, textAlign: "right" }}>{f.tightening}</td>
                <td style={{ border: "1px solid #ccc", padding: 2, textAlign: "right" }}>{f.elasticity}</td>
                {yearKeys.map(y => (
                  <td key={y} style={{ border: "1px solid #ccc", padding: 2, textAlign: "right" }}>
                    {f.coefficients?.[y] !== undefined ? String(f.coefficients[y]) : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const ProductFieldsBlock = ({ product }: { product: any }) => (
    <div style={{ paddingLeft: 8 }}>
      <FieldsTable title="Fields" fields={product.fields} />
      <FieldsTable title="Segment Fields" fields={product.segmentFields} />
      <FieldsTable title="Global Fields" fields={product.globalFields} />
      {(product.subProducts || []).length > 0 && (
        <div style={{ marginTop: 4 }}>
          <strong style={{ fontSize: 11 }}>Sub-products</strong>
          {product.subProducts.map((sp: any) => (
            <div key={sp._id?.$oid ?? sp._id ?? sp.key} style={{ marginBottom: 4, paddingLeft: 8 }}>
              <span style={{ fontSize: 11 }}>↳ {sp.key}{sp.name ? ` (${sp.name})` : ""}</span>
              <FieldsTable title="Fields" fields={sp.fields} />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  //=======================================================================
  //        MARKET MODEL FIELD
  //=======================================================================

  const MarketModelView = ({ marketModel }: { marketModel: any }) => {
    const [openSegments, setOpenSegments] = useState<Record<string, boolean>>({});
    const [openProducts, setOpenProducts] = useState<Record<string, boolean>>({});

    if (!marketModel || !marketModel.segments?.length) {
      return <span style={{ color: "#888" }}>—</span>;
    }

    const toggleSegment = (id: string) =>
      setOpenSegments(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleProduct = (key: string) =>
      setOpenProducts(prev => ({ ...prev, [key]: !prev[key] }));

    return (
      <div style={{ maxWidth: 480, maxHeight: 280, overflow: "auto", fontSize: 11 }}>
        {marketModel.segments.map((segment: any) => {
          const segOpen = !!openSegments[segment.segmentId];
          return (
            <div key={segment.segmentId} style={{ marginBottom: 4 }}>
              <button onClick={() => toggleSegment(segment.segmentId)} style={{ fontSize: 11, cursor: "pointer" }}>
                {segOpen ? "▾" : "▸"} Segment {segment.segmentId}
              </button>
              {segOpen && (
                <div style={{ paddingLeft: 12 }}>
                  {(segment.products || []).map((product: any) => {
                    const productKey = `${segment.segmentId}:${product.productId}`;
                    const prodOpen = !!openProducts[productKey];
                    return (
                      <div key={productKey} style={{ marginBottom: 4 }}>
                        <button onClick={() => toggleProduct(productKey)} style={{ fontSize: 11, cursor: "pointer" }}>
                          {prodOpen ? "▾" : "▸"} Product {product.productId}
                        </button>
                        {prodOpen && <ProductFieldsBlock product={product} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const handleAddMMSegment = () => {
    if (!selectedMMSegmentToAdd || marketModelSegments.some(s => s.segmentId === selectedMMSegmentToAdd)) return;
    const segment = segmentOptions.find((s: any) => s._id === selectedMMSegmentToAdd);
    setMarketModelSegments(prev => [...prev, { segmentId: selectedMMSegmentToAdd, segmentName: segment?.name ?? selectedMMSegmentToAdd, products: [] }]);
    if (!productOptionsBySegment[selectedMMSegmentToAdd]) {
      getProducts(newSimTypeId, selectedMMSegmentToAdd)
        .then(res => setProductOptionsBySegment(prev => ({ ...prev, [selectedMMSegmentToAdd]: res.data?.data ?? res.data })))
        .catch((e: any) => setCreateError(e.message));
    }
    setSelectedMMSegmentToAdd("");
  };

  const handleRemoveMMSegment = (segmentId: string) => {
    setMarketModelSegments(prev => prev.filter(s => s.segmentId !== segmentId));
  };

  const handleAddMMProduct = (segmentId: string) => {
    const productId = selectedMMProductToAddBySegment[segmentId];
    if (!productId) return;
    const product = (productOptionsBySegment[segmentId] || []).find((p: any) => p._id === productId);
    if (!product) return;
    setMarketModelSegments(prev =>
      prev.map(s =>
        s.segmentId === segmentId && !s.products.some(p => p.productId === productId)
          ? { ...s, products: [...s.products, { productId, productName: product.productName, fields: [], segmentFields: [], globalFields: [] }] }
          : s
      )
    );
    setSelectedMMProductToAddBySegment(prev => ({ ...prev, [segmentId]: "" }));
  };

  const handleRemoveMMProduct = (segmentId: string, productId: string) => {
    setMarketModelSegments(prev =>
      prev.map(s => (s.segmentId === segmentId ? { ...s, products: s.products.filter(p => p.productId !== productId) } : s))
    );
  };

  const updateMMProductFieldList = (
    segmentId: string, productId: string,
    listName: "fields" | "segmentFields" | "globalFields",
    newList: MarketModelField[]
  ) => {
    setMarketModelSegments(prev =>
      prev.map(s =>
        s.segmentId === segmentId
          ? { ...s, products: s.products.map(p => (p.productId === productId ? { ...p, [listName]: newList } : p)) }
          : s
      )
    );
  };

  const MarketModelFieldsEditor = ({
    title, fields, onChange, yearKeys,
  }: {
    title: string;
    fields: MarketModelField[];
    onChange: (fields: MarketModelField[]) => void;
    yearKeys: string[];
  }) => {
    const blankCoefficients = () => Object.fromEntries(yearKeys.map(y => [y, 0]));
    const [form, setForm] = useState({ ...BLANK_FIELD, coefficients: blankCoefficients() });
    const [editingKey, setEditingKey] = useState<string | null>(null);

    const resetForm = () => {
      setForm({ ...BLANK_FIELD, coefficients: blankCoefficients() });
      setEditingKey(null);
    };

    const handleAdd = () => {
      if (!form.key || !form.label) return;
      const entry: MarketModelField = { ...form, level: form.level || undefined };
      if (editingKey) {
        onChange(fields.map(f => (f.key === editingKey ? entry : f)));
      } else {
        if (fields.some(f => f.key === form.key)) return;
        onChange([...fields, entry]);
      }
      resetForm();
    };

    const handleEdit = (f: MarketModelField) => {
      setEditingKey(f.key);
      setForm({ ...f, level: f.level ?? "", coefficients: Object.fromEntries(yearKeys.map(y => [y, f.coefficients?.[y] ?? 0])) });
    };

    const handleDelete = (key: string) => {
      onChange(fields.filter(f => f.key !== key));
      if (editingKey === key) resetForm();
    };

    return (
      <div style={{ marginTop: 6 }}>
        <strong style={{ fontSize: 11 }}>{title}</strong>
        <table border={1} cellPadding={2} style={{ fontSize: 10, width: "100%" }}>
          <thead>
            <tr>
              <th>key</th><th>label</th><th>level</th><th>direction</th><th>tightening</th><th>elasticity</th>
              {yearKeys.map(y => <th key={y}>{y}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {fields.map(f => (
              <tr key={f.key}>
                <td>{f.key}</td>
                <td>{f.label}</td>
                <td>{f.formula}</td>
                <td>{f.type}</td>
                <td>{f.level}</td>
                <td>{f.direction}</td>
                <td>{f.tightening}</td>
                <td>{f.elasticity}</td>
                {yearKeys.map(y => <td key={y}>{f.coefficients?.[y] ?? 0}</td>)}
                <td>
                  <button onClick={() => handleEdit(f)}>Edit</button>{" "}
                  <button onClick={() => handleDelete(f.key)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 4 }}>
          <input placeholder="key" value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value }))} disabled={!!editingKey} />
          <input placeholder="label" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
          <input placeholder="formula (optional)" value={form.formula} onChange={e => setForm(f => ({ ...f, formula: e.target.value }))} />
          <input placeholder="type (optional)" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} />
          <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}>
            <option value="">-- none --</option>
            <option value="global">global</option>
            <option value="segment">segment</option>
            <option value="product">product</option>
          </select>
          <input type="number" placeholder="direction" style={{ width: 70 }} value={form.direction} onChange={e => setForm(f => ({ ...f, direction: Number(e.target.value) }))} />
          <input type="number" placeholder="tightening" style={{ width: 70 }} value={form.tightening} onChange={e => setForm(f => ({ ...f, tightening: Number(e.target.value) }))} />
          <input type="number" placeholder="elasticity (optional)" style={{ width: 70 }} value={form.elasticity} onChange={e => setForm(f => ({ ...f, elasticity: Number(e.target.value) }))} />
          <div>
            {yearKeys.map(y => (
              <span key={y} style={{ marginRight: 4 }}>
                {y}:{" "}
                <input
                  type="number"
                  style={{ width: 60 }}
                  value={form.coefficients?.[y] ?? 0}
                  onChange={e => setForm(f => ({ ...f, coefficients: { ...f.coefficients, [y]: Number(e.target.value) } }))}
                />
              </span>
            ))}
          </div>
          <button onClick={handleAdd} disabled={yearKeys.length === 0}>{editingKey ? "Update" : "Add"} Field</button>
          {editingKey && <button onClick={resetForm}>Cancel</button>}
        </div>
      </div>
    );
  };

  const MarketDataView = ({ marketData }: { marketData: any }) => {
    const [openSegments, setOpenSegments] = useState<Record<string, boolean>>({});
    const [openProducts, setOpenProducts] = useState<Record<string, boolean>>({});

    if (!marketData || !marketData.segments?.length) {
      return <span style={{ color: "#888" }}>—</span>;
    }

    const toggleSegment = (segmentId: string) =>
      setOpenSegments(prev => ({ ...prev, [segmentId]: !prev[segmentId] }));

    const toggleProduct = (key: string) =>
      setOpenProducts(prev => ({ ...prev, [key]: !prev[key] }));

    return (
      <div style={{ maxWidth: 420, maxHeight: 280, overflow: "auto", fontSize: 11 }}>
        {marketData.segments.map((segment: any) => {
          const segOpen = !!openSegments[segment.segmentId];
          return (
            <div key={segment.segmentId} style={{ marginBottom: 4 }}>
              <button onClick={() => toggleSegment(segment.segmentId)} style={{ fontSize: 11, cursor: "pointer" }}>
                {segOpen ? "▾" : "▸"} Segment {segment.segmentId}
              </button>
              {segOpen && (
                <div style={{ paddingLeft: 12 }}>
                  {(segment.products || []).map((product: any) => {
                    const productKey = `${segment.segmentId}:${product.productId}`;
                    const prodOpen = !!openProducts[productKey];
                    const yearKeys = Object.keys(product.yearlyData || {}).sort(
                      (a, b) => Number(a) - Number(b)
                    );
                    const propertyKeys = Array.from(
                      new Set(yearKeys.flatMap(y => Object.keys(product.yearlyData[y] || {})))
                    );

                    return (
                      <div key={productKey} style={{ marginBottom: 4 }}>
                        <button onClick={() => toggleProduct(productKey)} style={{ fontSize: 11, cursor: "pointer" }}>
                          {prodOpen ? "▾" : "▸"} Product {product.productId}
                        </button>
                        {prodOpen && (
                          <table style={{ fontSize: 10, borderCollapse: "collapse", width: "100%" }}>
                            <thead>
                              <tr>
                                <th style={{ border: "1px solid #ccc", padding: 2, textAlign: "left" }}>year</th>
                                {propertyKeys.map(p => (
                                  <th key={p} style={{ border: "1px solid #ccc", padding: 2 }}>{p}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {yearKeys.map(y => (
                                <tr key={y}>
                                  <td style={{ border: "1px solid #ccc", padding: 2 }}>{y}</td>
                                  {propertyKeys.map(p => (
                                    <td key={p} style={{ border: "1px solid #ccc", padding: 2, textAlign: "right" }}>
                                      {product.yearlyData[y]?.[p] !== undefined ? String(product.yearlyData[y][p]) : ""}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  useEffect(() => { load(); }, [filterSimType]);

  return (
    <div>
      <h2>Base Data</h2>
      <h3>Create Base Data</h3>
        {createError && <p style={{ color: "red" }}>{createError}</p>}
        {createSuccess && <p style={{ color: "green" }}>{createSuccess}</p>}
        <table>
          <tbody>
            <tr>
              <td>Simulation Type</td>
              <td>
                <select value={newSimTypeId} onChange={e => setNewSimTypeId(e.target.value)}>
                  <option value="">-- select --</option>
                  {simulationTypes.map((st: any) => (
                    <option key={st._id} value={st._id}>{st.name ?? st._id}</option>
                  ))}
                </select>
              </td>
            </tr>
            <tr>
              <td>Constants (JSON)</td>
              <td><textarea value={constantsJson} onChange={e => setConstantsJson(e.target.value)} rows={4} style={{ width: "100%", fontFamily: "monospace", fontSize: 11 }} /></td>
            </tr>
            <tr>
              <td>Market Data</td>
              <td>
                <select value={selectedSegmentToAdd} onChange={e => setSelectedSegmentToAdd(e.target.value)} disabled={!newSimTypeId}>
                  <option value="">-- select segment to add --</option>
                  {segmentOptions
                    .filter((seg: any) => !marketDataSegments.some(s => s.segmentId === seg._id))
                    .map((seg: any) => (
                      <option key={seg._id} value={seg._id}>{seg.name ?? seg._id}</option>
                    ))}
                </select>
                <button onClick={handleAddMarketDataSegment} disabled={!selectedSegmentToAdd}>Add Segment</button>

                {marketDataSegments.map(seg => (
                  <div key={seg.segmentId} style={{ border: "1px solid #ccc", padding: 8, marginTop: 8 }}>
                    <strong>Segment {seg.segmentName}</strong>{" "}
                    <button onClick={() => handleRemoveMarketDataSegment(seg.segmentId)}>Remove Segment</button>

                    <div style={{ marginTop: 4 }}>
                      <select
                        value={selectedProductToAddBySegment[seg.segmentId] ?? ""}
                        onChange={e => setSelectedProductToAddBySegment(prev => ({ ...prev, [seg.segmentId]: e.target.value }))}
                      >
                        <option value="">-- select product to add --</option>
                        {(productOptionsBySegment[seg.segmentId] || [])
                          .filter((p: any) => !seg.products.some(sp => sp.productId === p._id))
                          .map((p: any) => (
                            <option key={p._id} value={p._id}>{p.productName}</option>
                          ))}
                      </select>
                      <button onClick={() => handleAddMarketDataProduct(seg.segmentId)} disabled={!selectedProductToAddBySegment[seg.segmentId]}>
                        Add Product
                      </button>
                    </div>

                    {seg.products.map(prod => {
                      const key = `${seg.segmentId}:${prod.productId}`;
                      const yf = yearFormByProduct[key] ?? { year: "", marketSize: 0, marketGrowth: 0 };
                      return (
                        <div key={prod.productId} style={{ border: "1px solid #ddd", padding: 6, marginTop: 6, marginLeft: 8 }}>
                          <strong>{prod.productName}</strong>{" "}
                          <button onClick={() => handleRemoveMarketDataProduct(seg.segmentId, prod.productId)}>Remove Product</button>

                          <table border={1} cellPadding={2} style={{ fontSize: 11, marginTop: 4 }}>
                            <thead><tr><th>year</th><th>marketSize</th><th>marketGrowth</th><th></th></tr></thead>
                            <tbody>
                              {Object.entries(prod.yearlyData).map(([year, data]: [string, any]) => (
                                <tr key={year}>
                                  <td>{year}</td>
                                  <td>{data.marketSize}</td>
                                  <td>{data.marketGrowth}</td>
                                  <td><button onClick={() => handleRemoveYearRow(seg.segmentId, prod.productId, year)}>Remove</button></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          <div style={{ marginTop: 4 }}>
                            <input placeholder="year" style={{ width: 60 }} value={yf.year} onChange={e => updateYearForm(seg.segmentId, prod.productId, "year", e.target.value)} />
                            <input type="number" placeholder="marketSize" style={{ width: 100 }} value={yf.marketSize} onChange={e => updateYearForm(seg.segmentId, prod.productId, "marketSize", Number(e.target.value))} />
                            <input type="number" step="0.01" placeholder="marketGrowth" style={{ width: 100 }} value={yf.marketGrowth} onChange={e => updateYearForm(seg.segmentId, prod.productId, "marketGrowth", Number(e.target.value))} />
                            <button onClick={() => handleAddYearRow(seg.segmentId, prod.productId)} disabled={yf.year === ""}>Add Year</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </td>
            </tr>
            <tr>
              <tr>
                <td>Market Model</td>
              </tr>
              <td>
                <select value={selectedMMSegmentToAdd} onChange={e => setSelectedMMSegmentToAdd(e.target.value)} disabled={!newSimTypeId}>
                  <option value="">-- select segment to add --</option>
                  {segmentOptions
                    .filter((seg: any) => !marketModelSegments.some(s => s.segmentId === seg._id))
                    .map((seg: any) => (
                      <option key={seg._id} value={seg._id}>{seg.name ?? seg._id}</option>
                    ))}
                </select>
                <button onClick={handleAddMMSegment} disabled={!selectedMMSegmentToAdd}>Add Segment</button>

                {newSimTypeId && yearKeys.length === 0 && (
                  <p style={{ color: "orange", fontSize: 11 }}>
                    Selected simulation type has no yearRange set — coefficients can't be entered until it does.
                  </p>
                )}

                {marketModelSegments.map(seg => (
                  <div key={seg.segmentId} style={{ border: "1px solid #ccc", padding: 8, marginTop: 8 }}>
                    <strong>Segment {seg.segmentName}</strong>{" "}
                    <button onClick={() => handleRemoveMMSegment(seg.segmentId)}>Remove Segment</button>

                    <div style={{ marginTop: 4 }}>
                      <select
                        value={selectedMMProductToAddBySegment[seg.segmentId] ?? ""}
                        onChange={e => setSelectedMMProductToAddBySegment(prev => ({ ...prev, [seg.segmentId]: e.target.value }))}
                      >
                        <option value="">-- select product to add --</option>
                        {(productOptionsBySegment[seg.segmentId] || [])
                          .filter((p: any) => !seg.products.some(sp => sp.productId === p._id))
                          .map((p: any) => (
                            <option key={p._id} value={p._id}>{p.productName}</option>
                          ))}
                      </select>
                      <button onClick={() => handleAddMMProduct(seg.segmentId)} disabled={!selectedMMProductToAddBySegment[seg.segmentId]}>
                        Add Product
                      </button>
                    </div>

                    {seg.products.map(prod => (
                      <div key={prod.productId} style={{ border: "1px solid #ddd", padding: 6, marginTop: 6, marginLeft: 8 }}>
                        <strong>{prod.productName}</strong>{" "}
                        <button onClick={() => handleRemoveMMProduct(seg.segmentId, prod.productId)}>Remove Product</button>

                        <MarketModelFieldsEditor title="Fields" fields={prod.fields} yearKeys={yearKeys}
                          onChange={next => updateMMProductFieldList(seg.segmentId, prod.productId, "fields", next)} />
                        <MarketModelFieldsEditor title="Segment Fields" fields={prod.segmentFields} yearKeys={yearKeys}
                          onChange={next => updateMMProductFieldList(seg.segmentId, prod.productId, "segmentFields", next)} />
                        <MarketModelFieldsEditor title="Global Fields" fields={prod.globalFields} yearKeys={yearKeys}
                          onChange={next => updateMMProductFieldList(seg.segmentId, prod.productId, "globalFields", next)} />
                      </div>
                    ))}
                  </div>
                ))}
              </td>
            </tr>
            <tr>
              <td>CSAT Market Model</td>
              <td>
                <select value={selectedCsatSegmentToAdd} onChange={e => setSelectedCsatSegmentToAdd(e.target.value)} disabled={!newSimTypeId}>
                  <option value="">-- select segment to add --</option>
                  {segmentOptions
                    .filter((seg: any) => !csatSegments.some(s => s.segmentId === seg._id))
                    .map((seg: any) => (
                      <option key={seg._id} value={seg._id}>{seg.name ?? seg._id}</option>
                    ))}
                </select>
                <button onClick={handleAddCsatSegment} disabled={!selectedCsatSegmentToAdd}>Add Segment</button>

                {newSimTypeId && yearKeys.length === 0 && (
                  <p style={{ color: "orange", fontSize: 11 }}>Selected simulation type has no yearRange set — coefficients can't be entered yet.</p>
                )}
                {newSimTypeId && globalInputOptions.length === 0 && (
                  <p style={{ color: "orange", fontSize: 11 }}>No Global Inputs exist yet for this simulation type — "global"-level drivers won't have anything to pick from.</p>
                )}

                {csatSegments.map(seg => (
                  <div key={seg.segmentId} style={{ border: "1px solid #ccc", padding: 8, marginTop: 8 }}>
                    <strong>Segment {seg.segmentName}</strong>{" "}
                    <button onClick={() => handleRemoveCsatSegment(seg.segmentId)}>Remove Segment</button>

                    <CsatDriversEditor
                      drivers={seg.drivers}
                      yearKeys={yearKeys}
                      productOptions={productOptionsBySegment[seg.segmentId] || []}
                      globalInputOptions={globalInputOptions}
                      onChange={next => updateCsatSegmentDrivers(seg.segmentId, next)}
                    />
                  </div>
                ))}
              </td>
            </tr>
          </tbody>
        </table>
        <button onClick={handleCreateBaseData} disabled={creating}>Create</button>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <label>Filter Simulation Type ID: <input value={filterSimType} onChange={e => setFilterSimType(e.target.value)} /></label>
      {" "}
      <button onClick={load}>Refresh</button>

      <h3>All Base Data</h3>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>_id</th><th>SimTypeId</th><th>constants</th><th>marketData</th><th>marketModel</th><th>csatMarketModel</th>
          </tr>
        </thead>
        <tbody>
          {record && (
            <tr key={record._id}>
              <td>{record._id}</td>
              <td>{record.simulationTypeId}</td>
              <td><pre style={{ margin: 0, maxWidth: 200, overflow: "auto", fontSize: 11 }}>{JSON.stringify(record.constants, null, 2)}</pre></td>
              <td><MarketDataView marketData={record.marketData} /></td>
              <td><MarketModelView marketModel={record.marketModel} /></td>
              <td><CsatMarketModelView csatMarketModel={record.csatMarketModel} /></td>
              <td><pre style={{ margin: 0, maxWidth: 200, overflow: "auto", fontSize: 11 }}>{JSON.stringify(record.csatMarketModel, null, 2)}</pre></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
