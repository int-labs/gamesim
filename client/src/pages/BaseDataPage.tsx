import { useEffect, useState } from "react";
import { getBaseData } from "../api";
import type { BaseData } from "../types";

export default function BaseDataPage() {
  const [record, setRecord] = useState<BaseData | null>(null);
  const [filterSimType, setFilterSimType] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const res = await getBaseData(filterSimType || undefined);
      setRecord(res.data?.data ?? res.data ?? null);
    } catch (e: any) {
      setError(e.message);
    }
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
      <p>Read only.</p>
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
              <td><pre style={{ margin: 0, maxWidth: 200, overflow: "auto", fontSize: 11 }}>{JSON.stringify(record.csatMarketModel, null, 2)}</pre></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
