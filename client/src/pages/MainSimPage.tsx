import { useEffect, useRef, useState } from "react";
import { loginWithPasskey, getRounds, getSimulationById, getProducts, setAuthToken, getProductFields, recalcProjections } from "../api";

// ...inside handleLogin, after resolving the active round:

export default function TeamDecisionPage() {
    const [passkey, setPasskey] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
        
    const [simulationTypeId, setSimulationTypeId] = useState<string | null>(null);
    const [teamId, setTeamId] = useState<string | null>(null);
    const [simulationId, setSimulationId] = useState<string | null>(null);
    const [activeRound, setActiveRound] = useState<any | null>(null);
    const [roundStatus, setRoundStatus] = useState<"loading" | "waiting" | "active">("loading");

    const [products, setProducts] = useState<any[]>([]); 
    const [selectedProductId, setSelectedProductId] = useState("");

    const [productFields, setProductFields] = useState<any[]>([]);
    const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
    const [preview, setPreview] = useState<any | null>(null);
    const [previewError, setPreviewError] = useState("");
    const [previewLoading, setPreviewLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!selectedProductId) {
            setProductFields([]);
            setFieldValues({});
            setPreview(null);
            return;
        }
        getProductFields(selectedProductId)
            .then(res => {
            const fc = res.data?.data ?? res.data;
            setProductFields(fc);
            setFieldValues({});
            setPreview(null);
            })
            .catch((e: any) => setPreviewError(e.message));
        }, [selectedProductId]);

    const triggerRecalc = (values: Record<string, string>) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setPreviewLoading(true);
            setPreviewError("");
            
            try {
                const res = await recalcProjections({
                    simulationId: simulationId!,
                    teamId: teamId!,
                    roundNumber: activeRound.roundNumber,
                    productId: selectedProductId,
                    fields: Object.entries(values).map(([fieldId, value]) => ({ fieldId, value })),
                });
                const projection = res.data?.data ?? res.data;
                setPreview(projection.projections?.[selectedProductId] ?? null);
            } catch (e: any) {
                setPreviewError(e.response?.data?.message ?? e.message);
            } finally {
                setPreviewLoading(false);
            }
        }, 500);
    };

    const handleFieldChange = (fieldId: string, value: string) => {
        const next = { ...fieldValues, [fieldId]: value };
        setFieldValues(next);
        triggerRecalc(next);
    };

    const handleLogin = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await loginWithPasskey(passkey);
            const { token, teamId: tId, simulationId: simId } = res.data;

            setAuthToken(token);

            setTeamId(tId);
            setSimulationId(simId);

            const roundsRes = await getRounds(simId);
            const rounds = roundsRes.data?.data ?? roundsRes.data;
            const active = rounds.find((r: any) => r.status.toString().toLowerCase() === "active");

            if (!active) {
                setRoundStatus("waiting");
                return;
            }

            setActiveRound(active);
            setRoundStatus("active");

            const simRes = await getSimulationById(simId);
            const sim = simRes.data?.data ?? simRes.data;
            setSimulationTypeId(sim.simulationTypeId);

            const productsRes = await getProducts(sim.simulationTypeId);
            setProducts(productsRes.data?.data ?? productsRes.data);
        } catch (e: any) {
            setError(e.response?.data?.message ?? e.message);
        } finally {
            setLoading(false);
        }
    };

    if (!teamId) {
        return (
        <div>
            <h2>Team Login</h2>
            {error && <p style={{ color: "red" }}>{error}</p>}
            <input placeholder="Enter your passkey" value={passkey} onChange={e => setPasskey(e.target.value)} />
            <button onClick={handleLogin} disabled={loading}>Log In</button>
        </div>
        );
    }

    if (roundStatus === "waiting") {
        return <p>Waiting for the round to start...</p>;
    }

    // ... product switcher + field inputs + live preview go here, next step
    return (
        <div>
            <h2>Round {activeRound?.roundNumber ?? "—"}</h2>

            <select value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}>
            <option value="">-- select a product --</option>
            {products.map((p: any) => (
                <option key={p._id} value={p._id}>{p.productName}</option>
            ))}
            </select>

            {selectedProductId && (
            <div style={{ display: "flex", gap: 24, marginTop: 16 }}>
                <div style={{ flex: 1 }}>
                <h3>Decision Inputs</h3>
                {productFields.map((field: any) => (
                    <div key={field._id} style={{ marginBottom: 8 }}>
                    <label>
                        {field.label}{field.required ? " *" : ""}
                        <br />
                        <input
                        value={fieldValues[field._id] ?? ""}
                        onChange={e => handleFieldChange(field._id, e.target.value)}
                        />
                    </label>
                    </div>
                ))}
                </div>

                <div style={{ flex: 1, borderLeft: "1px solid #ccc", paddingLeft: 16 }}>
                <h3>Live Preview {previewLoading && <span style={{ fontSize: 12, color: "#888" }}>(updating...)</span>}</h3>
                {previewError && <p style={{ color: "red" }}>{previewError}</p>}
                {!preview && !previewLoading && <p style={{ color: "#888" }}>Start entering values to see a preview.</p>}
                {preview && (
                    <table>
                        <tbody>
                        <tr><td>Customers Obtained</td><td>{preview.customersObtained?.toFixed(2)}</td></tr>
                        <tr><td>Dynamic Price</td><td>{preview.dynamicPrice?.toFixed(2)}</td></tr>
                        <tr><td>Dynamic Cost</td><td>{preview.dynamicCost?.toFixed(2)}</td></tr>
                        <tr><td>Revenue</td><td>{preview.revenue?.toFixed(2)}</td></tr>
                        <tr><td>COGS</td><td>{preview.COGS?.toFixed(2) ?? "—"}</td></tr>
                        <tr><td>Gross Profit</td><td>{preview.grossProfit?.toFixed(2) ?? "—"}</td></tr>
                        </tbody>
                    </table>
                    )}
                    {preview?.productCostBreakdown?.length > 0 && (
                    <>
                        <h4>Cost Breakdown</h4>
                        <table border={1} cellPadding={4}>
                        <thead>
                            <tr><th>Field</th><th>Cost Contribution</th></tr>
                        </thead>
                        <tbody>
                            {preview.productCostBreakdown.map((entry: any) => (
                            <tr key={entry.key}>
                                <td>{entry.label}</td>
                                <td>{Number(entry.value ?? 0).toFixed(2)}</td>
                            </tr>
                            ))}
                        </tbody>
                        </table>
                    </>
                    )}
                    {preview?.incurredCosts?.length > 0 && (
                    <>
                        <h4>Incurred Costs</h4>
                        <table border={1} cellPadding={4}>
                        <thead>
                            <tr><th>Category</th><th>Item</th><th>Qty</th><th>Leftover</th><th>Cost/Unit</th><th>Incurred</th></tr>
                        </thead>
                        <tbody>
                            {preview.incurredCosts.map((entry: any) => (
                            <tr key={entry.key}>
                                <td>{entry.category}</td>
                                <td>{entry.label}</td>
                                <td>{Number(entry.inputQty ?? 0).toFixed(2)}</td>
                                <td>{Number(entry.leftover ?? 0).toFixed(2)}</td>
                                <td>{Number(entry.costPerUnit ?? 0).toFixed(2)}</td>
                                <td>{Number(entry.incurredCost ?? 0).toFixed(2)}</td>
                            </tr>
                            ))}
                        </tbody>
                        </table>
                    </>
                    )}
                </div>
            </div>
            )}
        </div>
    );
}