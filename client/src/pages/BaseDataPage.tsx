import { useEffect, useState } from "react";
import {
  Alert, Button, Card, DataTable, Heading, Input, PageHeader, Select, Text, TextArea, TextField,
  type DataTableColumn,
} from "@stratagem/design-system";
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

    const columns: DataTableColumn<CsatDriver>[] = [
      { id: "level", header: "level", cell: d => d.level },
      { id: "key", header: "key", cell: d => d.key, primary: true },
      { id: "label", header: "label", cell: d => d.label },
      { id: "productId", header: "productId", cell: d => d.productId ?? "" },
      { id: "globalInputId", header: "globalInputId", cell: d => d.globalInputId ?? "" },
      { id: "choiceKey", header: "choiceKey", cell: d => d.choiceKey ?? "" },
      ...yearKeys.map(y => ({ id: `y${y}`, header: y, align: "end" as const, cell: (d: CsatDriver) => d.coefficients?.[y] ?? 0 })),
    ];

    return (
      <div className="flex flex-col gap-2">
        <DataTable
          label="CSAT drivers"
          density="compact"
          columns={columns}
          rows={drivers}
          rowKey={d => d.key}
          rowActions={d => (
            <>
              <Button variant="text" onClick={() => handleEdit(d)}>Edit</Button>
              <Button variant="text" tone="danger" onClick={() => handleDelete(d.key)}>Delete</Button>
            </>
          )}
        />

        <div className="flex flex-wrap items-end gap-2">
          <Select
            size="sm"
            width="fit"
            aria-label="level"
            value={form.level}
            onValueChange={v => v && setForm(f => ({ ...f, level: v }))}
            options={[
              { value: "global", label: "global" },
              { value: "product", label: "product" },
            ]}
          />
          <Input size="sm" aria-label="key" placeholder="key" value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value }))} disabled={!!editingKey} />
          <Input size="sm" aria-label="label" placeholder="label" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
          <Input size="sm" aria-label="choiceKey" placeholder="choiceKey (optional)" value={form.choiceKey} onChange={e => setForm(f => ({ ...f, choiceKey: e.target.value }))} />

          {form.level === "product" && (
            <Select
              size="sm"
              width="fit"
              aria-label="product"
              placeholder="-- select product --"
              value={form.productId || null}
              onValueChange={v => setForm(f => ({ ...f, productId: v ?? "" }))}
              options={productOptions.map((p: any) => ({ value: p._id, label: p.productName }))}
            />
          )}

          {form.level === "global" && (
            <Select
              size="sm"
              width="fit"
              aria-label="global input"
              placeholder="-- select global input --"
              value={form.globalInputId || null}
              onValueChange={v => setForm(f => ({ ...f, globalInputId: v ?? "" }))}
              options={globalInputOptions.map((gi: any) => ({ value: gi._id, label: `[${gi.category}] ${gi.label}` }))}
            />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {yearKeys.map(y => (
            <TextField
              key={y}
              label={y}
              type="number"
              className="w-24"
              value={form.coefficients?.[y] ?? 0}
              onChange={e => {
                const value = Number(e.target.value);
                setForm(f => ({ ...f, coefficients: { ...f.coefficients, [y]: value } }));
              }}
            />
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleAdd} disabled={yearKeys.length === 0}>{editingKey ? "Update" : "Add"} Driver</Button>
          {editingKey && <Button variant="text" size="sm" onClick={resetForm}>Cancel</Button>}
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

    const columns: DataTableColumn<{ d: any; i: number }>[] = [
      { id: "key", header: "key", cell: ({ d }) => d.key, primary: true },
      { id: "label", header: "label", cell: ({ d }) => d.label },
      { id: "choiceKey", header: "choiceKey", cell: ({ d }) => d.choiceKey ?? "" },
      ...yearKeys.map(y => ({
        id: `y${y}`,
        header: y,
        align: "end" as const,
        cell: ({ d }: { d: any }) => (d.coefficients?.[y] !== undefined ? String(d.coefficients[y]) : ""),
      })),
    ];

    return (
      <DataTable
        label="CSAT drivers"
        density="compact"
        columns={columns}
        rows={drivers.map((d, i) => ({ d, i }))}
        rowKey={({ d, i }) => `${d.key}-${i}`}
      />
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
      <div className="flex flex-col gap-2 ps-2">
        {globalDrivers.length > 0 && (
          <div className="flex flex-col gap-1">
            <Text as="strong" variant="caption" weight="semibold">Global — affects PnL globally</Text>
            <CsatDriversTable drivers={globalDrivers} />
          </div>
        )}
        {segmentDrivers.length > 0 && (
          <div className="flex flex-col gap-1">
            <Text as="strong" variant="caption" weight="semibold">Segment — affects this segment</Text>
            <CsatDriversTable drivers={segmentDrivers} />
          </div>
        )}
        {Object.keys(productGroups).length > 0 && (
          <div className="flex flex-col gap-1">
            <Text as="strong" variant="caption" weight="semibold">Product — affects specific products</Text>
            {Object.entries(productGroups).map(([productId, ds]) => (
              <div key={productId} className="flex flex-col gap-1 ps-2">
                <Text as="em" variant="caption">Product {productId}</Text>
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
      return <Text as="span" tone="faint">—</Text>;
    }

    const toggleSegment = (id: string) =>
      setOpenSegments(prev => ({ ...prev, [id]: !prev[id] }));

    return (
      <div className="flex max-h-72 max-w-96 flex-col gap-1 overflow-auto">
        {csatMarketModel.segments.map((segment: any) => {
          const segmentId = segment.segmentId?.$oid ?? segment.segmentId;
          const segOpen = !!openSegments[segmentId];
          return (
            <div key={segmentId} className="flex flex-col gap-1">
              <Button variant="text" size="xs" className="self-start" onClick={() => toggleSegment(segmentId)}>
                {segOpen ? "▾" : "▸"} Segment {segmentId}
              </Button>
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

    const columns: DataTableColumn<any>[] = [
      { id: "field", header: "field", primary: true, cell: (f: any) => <span title={f.key}>{f.label}</span> },
      { id: "direction", header: "direction", align: "end", cell: (f: any) => f.direction },
      { id: "tightening", header: "tightening", align: "end", cell: (f: any) => f.tightening },
      { id: "elasticity", header: "elasticity", align: "end", cell: (f: any) => f.elasticity },
      ...yearKeys.map(y => ({
        id: `y${y}`,
        header: y,
        align: "end" as const,
        cell: (f: any) => (f.coefficients?.[y] !== undefined ? String(f.coefficients[y]) : ""),
      })),
    ];

    return (
      <div className="flex flex-col gap-1">
        <Text as="strong" variant="caption" weight="semibold">{title}</Text>
        <DataTable label={title} density="compact" columns={columns} rows={fields} rowKey={(f: any) => f.key} />
      </div>
    );
  };

  const ProductFieldsBlock = ({ product }: { product: any }) => (
    <div className="flex flex-col gap-2 ps-2">
      <FieldsTable title="Fields" fields={product.fields} />
      <FieldsTable title="Segment Fields" fields={product.segmentFields} />
      <FieldsTable title="Global Fields" fields={product.globalFields} />
      {(product.subProducts || []).length > 0 && (
        <div className="flex flex-col gap-1">
          <Text as="strong" variant="caption" weight="semibold">Sub-products</Text>
          {product.subProducts.map((sp: any) => (
            <div key={sp._id?.$oid ?? sp._id ?? sp.key} className="flex flex-col gap-1 ps-2">
              <Text as="span" variant="caption">↳ {sp.key}{sp.name ? ` (${sp.name})` : ""}</Text>
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
      return <Text as="span" tone="faint">—</Text>;
    }

    const toggleSegment = (id: string) =>
      setOpenSegments(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleProduct = (key: string) =>
      setOpenProducts(prev => ({ ...prev, [key]: !prev[key] }));

    return (
      <div className="flex max-h-72 max-w-96 flex-col gap-1 overflow-auto">
        {marketModel.segments.map((segment: any) => {
          const segOpen = !!openSegments[segment.segmentId];
          return (
            <div key={segment.segmentId} className="flex flex-col gap-1">
              <Button variant="text" size="xs" className="self-start" onClick={() => toggleSegment(segment.segmentId)}>
                {segOpen ? "▾" : "▸"} Segment {segment.segmentId}
              </Button>
              {segOpen && (
                <div className="flex flex-col gap-1 ps-3">
                  {(segment.products || []).map((product: any) => {
                    const productKey = `${segment.segmentId}:${product.productId}`;
                    const prodOpen = !!openProducts[productKey];
                    return (
                      <div key={productKey} className="flex flex-col gap-1">
                        <Button variant="text" size="xs" className="self-start" onClick={() => toggleProduct(productKey)}>
                          {prodOpen ? "▾" : "▸"} Product {product.productId}
                        </Button>
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

    // One header per rendered cell; the old table listed 6 headers over 8 cells
    const columns: DataTableColumn<MarketModelField>[] = [
      { id: "key", header: "key", cell: f => f.key, primary: true },
      { id: "label", header: "label", cell: f => f.label },
      { id: "formula", header: "formula", cell: f => f.formula },
      { id: "type", header: "type", cell: f => f.type },
      { id: "level", header: "level", cell: f => f.level },
      { id: "direction", header: "direction", align: "end", cell: f => f.direction },
      { id: "tightening", header: "tightening", align: "end", cell: f => f.tightening },
      { id: "elasticity", header: "elasticity", align: "end", cell: f => f.elasticity },
      ...yearKeys.map(y => ({ id: `y${y}`, header: y, align: "end" as const, cell: (f: MarketModelField) => f.coefficients?.[y] ?? 0 })),
    ];

    return (
      <div className="flex flex-col gap-2">
        <Text as="strong" variant="caption" weight="semibold">{title}</Text>
        <DataTable
          label={title}
          density="compact"
          columns={columns}
          rows={fields}
          rowKey={f => f.key}
          rowActions={f => (
            <>
              <Button variant="text" onClick={() => handleEdit(f)}>Edit</Button>
              <Button variant="text" tone="danger" onClick={() => handleDelete(f.key)}>Delete</Button>
            </>
          )}
        />

        <div className="flex flex-wrap items-end gap-2">
          <Input size="sm" aria-label="key" placeholder="key" value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value }))} disabled={!!editingKey} />
          <Input size="sm" aria-label="label" placeholder="label" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
          <Input size="sm" aria-label="formula" placeholder="formula (optional)" value={form.formula} onChange={e => setForm(f => ({ ...f, formula: e.target.value }))} />
          <Input size="sm" aria-label="type" placeholder="type (optional)" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} />
          <Select
            size="sm"
            width="fit"
            aria-label="level"
            placeholder="-- none --"
            value={form.level || null}
            onValueChange={v => setForm(f => ({ ...f, level: v ?? "" }))}
            options={[
              { value: "", label: "-- none --" },
              { value: "global", label: "global" },
              { value: "segment", label: "segment" },
              { value: "product", label: "product" },
            ]}
          />
          <Input size="sm" className="w-20" aria-label="direction" type="number" placeholder="direction" value={form.direction} onChange={e => setForm(f => ({ ...f, direction: Number(e.target.value) }))} />
          <Input size="sm" className="w-20" aria-label="tightening" type="number" placeholder="tightening" value={form.tightening} onChange={e => setForm(f => ({ ...f, tightening: Number(e.target.value) }))} />
          <Input size="sm" className="w-20" aria-label="elasticity" type="number" placeholder="elasticity (optional)" value={form.elasticity} onChange={e => setForm(f => ({ ...f, elasticity: Number(e.target.value) }))} />
        </div>
        <div className="flex flex-wrap gap-2">
          {yearKeys.map(y => (
            <TextField
              key={y}
              label={y}
              type="number"
              className="w-24"
              value={form.coefficients?.[y] ?? 0}
              onChange={e => {
                const value = Number(e.target.value);
                setForm(f => ({ ...f, coefficients: { ...f.coefficients, [y]: value } }));
              }}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleAdd} disabled={yearKeys.length === 0}>{editingKey ? "Update" : "Add"} Field</Button>
          {editingKey && <Button variant="text" size="sm" onClick={resetForm}>Cancel</Button>}
        </div>
      </div>
    );
  };

  const MarketDataView = ({ marketData }: { marketData: any }) => {
    const [openSegments, setOpenSegments] = useState<Record<string, boolean>>({});
    const [openProducts, setOpenProducts] = useState<Record<string, boolean>>({});

    if (!marketData || !marketData.segments?.length) {
      return <Text as="span" tone="faint">—</Text>;
    }

    const toggleSegment = (segmentId: string) =>
      setOpenSegments(prev => ({ ...prev, [segmentId]: !prev[segmentId] }));

    const toggleProduct = (key: string) =>
      setOpenProducts(prev => ({ ...prev, [key]: !prev[key] }));

    return (
      <div className="flex max-h-72 max-w-96 flex-col gap-1 overflow-auto">
        {marketData.segments.map((segment: any) => {
          const segOpen = !!openSegments[segment.segmentId];
          return (
            <div key={segment.segmentId} className="flex flex-col gap-1">
              <Button variant="text" size="xs" className="self-start" onClick={() => toggleSegment(segment.segmentId)}>
                {segOpen ? "▾" : "▸"} Segment {segment.segmentId}
              </Button>
              {segOpen && (
                <div className="flex flex-col gap-1 ps-3">
                  {(segment.products || []).map((product: any) => {
                    const productKey = `${segment.segmentId}:${product.productId}`;
                    const prodOpen = !!openProducts[productKey];
                    const yearKeys = Object.keys(product.yearlyData || {}).sort(
                      (a, b) => Number(a) - Number(b)
                    );
                    const propertyKeys = Array.from(
                      new Set(yearKeys.flatMap(y => Object.keys(product.yearlyData[y] || {})))
                    );
                    const columns: DataTableColumn<string>[] = [
                      { id: "year", header: "year", cell: y => y, primary: true },
                      ...propertyKeys.map(p => ({
                        id: p,
                        header: p,
                        align: "end" as const,
                        cell: (y: string) => (product.yearlyData[y]?.[p] !== undefined ? String(product.yearlyData[y][p]) : ""),
                      })),
                    ];

                    return (
                      <div key={productKey} className="flex flex-col gap-1">
                        <Button variant="text" size="xs" className="self-start" onClick={() => toggleProduct(productKey)}>
                          {prodOpen ? "▾" : "▸"} Product {product.productId}
                        </Button>
                        {prodOpen && (
                          <DataTable label={`Product ${product.productId}`} density="compact" columns={columns} rows={yearKeys} rowKey={y => y} />
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

  const segmentPicker = (
    label: string,
    value: string,
    onValue: (v: string) => void,
    taken: { segmentId: string }[],
  ) => (
    <Select
      size="sm"
      width="fit"
      aria-label={label}
      placeholder="-- select segment to add --"
      value={value || null}
      onValueChange={v => onValue(v ?? "")}
      disabled={!newSimTypeId}
      options={segmentOptions
        .filter((seg: any) => !taken.some(s => s.segmentId === seg._id))
        .map((seg: any) => ({ value: seg._id, label: seg.name ?? seg._id }))}
    />
  );

  const productPicker = (
    label: string,
    segmentId: string,
    value: string,
    onValue: (v: string) => void,
    taken: { productId: string }[],
  ) => (
    <Select
      size="sm"
      width="fit"
      aria-label={label}
      placeholder="-- select product to add --"
      value={value || null}
      onValueChange={v => onValue(v ?? "")}
      options={(productOptionsBySegment[segmentId] || [])
        .filter((p: any) => !taken.some(sp => sp.productId === p._id))
        .map((p: any) => ({ value: p._id, label: p.productName }))}
    />
  );

  const recordColumns: DataTableColumn<any>[] = [
    { id: "_id", header: "_id", cell: (r: any) => r._id },
    { id: "simulationTypeId", header: "SimTypeId", cell: (r: any) => r.simulationTypeId },
    { id: "constants", header: "constants", cell: (r: any) => <pre className="m-0 max-w-52 overflow-auto type-caption">{JSON.stringify(r.constants, null, 2)}</pre> },
    { id: "marketData", header: "marketData", cell: (r: any) => <MarketDataView marketData={r.marketData} /> },
    { id: "marketModel", header: "marketModel", cell: (r: any) => <MarketModelView marketModel={r.marketModel} /> },
    { id: "csatMarketModel", header: "csatMarketModel", cell: (r: any) => <CsatMarketModelView csatMarketModel={r.csatMarketModel} /> },
    // The old table rendered this cell without a header of its own
    { id: "csatJson", header: "csatMarketModel (JSON)", cell: (r: any) => <pre className="m-0 max-w-52 overflow-auto type-caption">{JSON.stringify(r.csatMarketModel, null, 2)}</pre> },
  ];

  return (
    <>
      <PageHeader title="Base Data" />

      <Card>
        <Heading level={3}>Create Base Data</Heading>
        {createError && <Alert tone="danger">{createError}</Alert>}
        {createSuccess && <Alert tone="success">{createSuccess}</Alert>}

        <Select
          label="Simulation Type"
          placeholder="-- select --"
          value={newSimTypeId || null}
          onValueChange={v => setNewSimTypeId(v ?? "")}
          options={simulationTypes.map((st: any) => ({ value: st._id, label: st.name ?? st._id }))}
        />
        <TextArea label="Constants (JSON)" className="font-mono" value={constantsJson} onChange={e => setConstantsJson(e.target.value)} minRows={4} />

        {/* ── Market Data ── */}
        <Card variant="panel">
          <Heading level={4}>Market Data</Heading>
          <div className="flex flex-wrap items-center gap-2">
            {segmentPicker("segment to add", selectedSegmentToAdd, setSelectedSegmentToAdd, marketDataSegments)}
            <Button variant="outline" size="sm" onClick={handleAddMarketDataSegment} disabled={!selectedSegmentToAdd}>Add Segment</Button>
          </div>

          {marketDataSegments.map(seg => (
            <Card key={seg.segmentId} variant="nested">
              <div className="flex flex-wrap items-center gap-2">
                <Text as="strong" weight="semibold">Segment {seg.segmentName}</Text>
                <Button variant="text" tone="danger" size="sm" onClick={() => handleRemoveMarketDataSegment(seg.segmentId)}>Remove Segment</Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {productPicker(
                  "product to add",
                  seg.segmentId,
                  selectedProductToAddBySegment[seg.segmentId] ?? "",
                  v => setSelectedProductToAddBySegment(prev => ({ ...prev, [seg.segmentId]: v })),
                  seg.products,
                )}
                <Button variant="outline" size="sm" onClick={() => handleAddMarketDataProduct(seg.segmentId)} disabled={!selectedProductToAddBySegment[seg.segmentId]}>
                  Add Product
                </Button>
              </div>

              {seg.products.map(prod => {
                const key = `${seg.segmentId}:${prod.productId}`;
                const yf = yearFormByProduct[key] ?? { year: "", marketSize: 0, marketGrowth: 0 };
                return (
                  <Card key={prod.productId} variant="panel" className="ms-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Text as="strong" weight="semibold">{prod.productName}</Text>
                      <Button variant="text" tone="danger" size="sm" onClick={() => handleRemoveMarketDataProduct(seg.segmentId, prod.productId)}>Remove Product</Button>
                    </div>

                    <DataTable
                      label={`${prod.productName} yearly data`}
                      density="compact"
                      columns={YEAR_COLUMNS}
                      rows={Object.entries(prod.yearlyData) as [string, any][]}
                      rowKey={([year]) => year}
                      rowActions={([year]) => (
                        <Button variant="text" tone="danger" onClick={() => handleRemoveYearRow(seg.segmentId, prod.productId, year)}>Remove</Button>
                      )}
                    />

                    <div className="flex flex-wrap items-end gap-2">
                      <Input size="sm" className="w-20" aria-label="year" placeholder="year" value={yf.year} onChange={e => updateYearForm(seg.segmentId, prod.productId, "year", e.target.value)} />
                      <Input size="sm" className="w-28" aria-label="marketSize" type="number" placeholder="marketSize" value={yf.marketSize} onChange={e => updateYearForm(seg.segmentId, prod.productId, "marketSize", Number(e.target.value))} />
                      <Input size="sm" className="w-28" aria-label="marketGrowth" type="number" step="0.01" placeholder="marketGrowth" value={yf.marketGrowth} onChange={e => updateYearForm(seg.segmentId, prod.productId, "marketGrowth", Number(e.target.value))} />
                      <Button variant="outline" size="sm" onClick={() => handleAddYearRow(seg.segmentId, prod.productId)} disabled={yf.year === ""}>Add Year</Button>
                    </div>
                  </Card>
                );
              })}
            </Card>
          ))}
        </Card>

        {/* ── Market Model ── */}
        <Card variant="panel">
          <Heading level={4}>Market Model</Heading>
          <div className="flex flex-wrap items-center gap-2">
            {segmentPicker("market model segment to add", selectedMMSegmentToAdd, setSelectedMMSegmentToAdd, marketModelSegments)}
            <Button variant="outline" size="sm" onClick={handleAddMMSegment} disabled={!selectedMMSegmentToAdd}>Add Segment</Button>
          </div>

          {newSimTypeId && yearKeys.length === 0 && (
            <Alert tone="warning">
              Selected simulation type has no yearRange set — coefficients can't be entered until it does.
            </Alert>
          )}

          {marketModelSegments.map(seg => (
            <Card key={seg.segmentId} variant="nested">
              <div className="flex flex-wrap items-center gap-2">
                <Text as="strong" weight="semibold">Segment {seg.segmentName}</Text>
                <Button variant="text" tone="danger" size="sm" onClick={() => handleRemoveMMSegment(seg.segmentId)}>Remove Segment</Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {productPicker(
                  "market model product to add",
                  seg.segmentId,
                  selectedMMProductToAddBySegment[seg.segmentId] ?? "",
                  v => setSelectedMMProductToAddBySegment(prev => ({ ...prev, [seg.segmentId]: v })),
                  seg.products,
                )}
                <Button variant="outline" size="sm" onClick={() => handleAddMMProduct(seg.segmentId)} disabled={!selectedMMProductToAddBySegment[seg.segmentId]}>
                  Add Product
                </Button>
              </div>

              {seg.products.map(prod => (
                <Card key={prod.productId} variant="panel" className="ms-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Text as="strong" weight="semibold">{prod.productName}</Text>
                    <Button variant="text" tone="danger" size="sm" onClick={() => handleRemoveMMProduct(seg.segmentId, prod.productId)}>Remove Product</Button>
                  </div>

                  <MarketModelFieldsEditor title="Fields" fields={prod.fields} yearKeys={yearKeys}
                    onChange={next => updateMMProductFieldList(seg.segmentId, prod.productId, "fields", next)} />
                  <MarketModelFieldsEditor title="Segment Fields" fields={prod.segmentFields} yearKeys={yearKeys}
                    onChange={next => updateMMProductFieldList(seg.segmentId, prod.productId, "segmentFields", next)} />
                  <MarketModelFieldsEditor title="Global Fields" fields={prod.globalFields} yearKeys={yearKeys}
                    onChange={next => updateMMProductFieldList(seg.segmentId, prod.productId, "globalFields", next)} />
                </Card>
              ))}
            </Card>
          ))}
        </Card>

        {/* ── CSAT Market Model ── */}
        <Card variant="panel">
          <Heading level={4}>CSAT Market Model</Heading>
          <div className="flex flex-wrap items-center gap-2">
            {segmentPicker("CSAT segment to add", selectedCsatSegmentToAdd, setSelectedCsatSegmentToAdd, csatSegments)}
            <Button variant="outline" size="sm" onClick={handleAddCsatSegment} disabled={!selectedCsatSegmentToAdd}>Add Segment</Button>
          </div>

          {newSimTypeId && yearKeys.length === 0 && (
            <Alert tone="warning">Selected simulation type has no yearRange set — coefficients can't be entered yet.</Alert>
          )}
          {newSimTypeId && globalInputOptions.length === 0 && (
            <Alert tone="warning">No Global Inputs exist yet for this simulation type — "global"-level drivers won't have anything to pick from.</Alert>
          )}

          {csatSegments.map(seg => (
            <Card key={seg.segmentId} variant="nested">
              <div className="flex flex-wrap items-center gap-2">
                <Text as="strong" weight="semibold">Segment {seg.segmentName}</Text>
                <Button variant="text" tone="danger" size="sm" onClick={() => handleRemoveCsatSegment(seg.segmentId)}>Remove Segment</Button>
              </div>

              <CsatDriversEditor
                drivers={seg.drivers}
                yearKeys={yearKeys}
                productOptions={productOptionsBySegment[seg.segmentId] || []}
                globalInputOptions={globalInputOptions}
                onChange={next => updateCsatSegmentDrivers(seg.segmentId, next)}
              />
            </Card>
          ))}
        </Card>

        <Button className="self-start" onClick={handleCreateBaseData} disabled={creating}>Create</Button>
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex flex-wrap items-end gap-4">
        <TextField label="Filter Simulation Type ID" value={filterSimType} onChange={e => setFilterSimType(e.target.value)} />
        <Button variant="outline" onClick={load}>Refresh</Button>
      </div>

      <Card>
        <Heading level={3}>All Base Data</Heading>
        <DataTable
          label="All Base Data"
          columns={recordColumns}
          rows={record ? [record] : []}
          rowKey={(r: any) => r._id}
        />
      </Card>
    </>
  );
}

const YEAR_COLUMNS: DataTableColumn<[string, any]>[] = [
  { id: "year", header: "year", cell: ([year]) => year, primary: true },
  { id: "marketSize", header: "marketSize", align: "end", cell: ([, data]) => data.marketSize },
  { id: "marketGrowth", header: "marketGrowth", align: "end", cell: ([, data]) => data.marketGrowth },
];
