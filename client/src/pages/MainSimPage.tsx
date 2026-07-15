import { useEffect, useRef, useState } from "react";
import { loginWithPasskey, getRounds, getSimulationById, getProducts, setAuthToken, getProductFields, recalcProjections, getGlobalInputs, createDecision } from "../api";

// ...inside handleLogin, after resolving the active round:

export default function TeamDecisionPage() {
    const [passkey, setPasskey] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const [submitted, setSubmitted]     = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [submitting, setSubmitting]   = useState(false);

    // Add alongside fieldValues state — tracks field values per product
    const [allProductFieldValues, setAllProductFieldValues] = useState<Record<string, Record<string, string>>>({});
    // keyed by productId → { fieldId: value }

    const [globalInputs, setGlobalInputs] = useState<any[]>([]);
    const [selectedGlobalItems, setSelectedGlobalItems] = useState<Record<string, string[]>>({});
    const [selectedSliderSteps, setSelectedSliderSteps] = useState<Record<string, string>>({});
    // keyed by container._id → array of selected item._id strings
    // capped at container.maxSelections
        
    const [simulationTypeId, setSimulationTypeId] = useState<string | null>(null);
    const [teamId, setTeamId] = useState<string | null>(null);
    const [simulationId, setSimulationId] = useState<string | null>(null);
    const [activeRound, setActiveRound] = useState<any | null>(null);
    const [roundStatus, setRoundStatus] = useState<"loading" | "waiting" | "active">("loading");

    const [products, setProducts] = useState<any[]>([]); 
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
    const [selectedProductId, setSelectedProductId]   = useState(""); // focused product

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
                // restore previously entered values for this product if any
                setFieldValues(allProductFieldValues[selectedProductId] ?? {});
                setPreview(null);
            })
            .catch((e: any) => setPreviewError(e.message));
    }, [selectedProductId]);

    const buildGlobalInputsPayload = (currentGlobalItems: Record<string, string[]>) => {
        const entries: any[] = [];
        globalInputs.forEach((container: any) => {
            const selectedIds = currentGlobalItems[container._id] ?? [];
            container.inputs
            .filter((item: any) => selectedIds.includes(String(item._id)))
            .forEach((item: any) => {
                entries.push({
                globalInputItemId: item._id,
                category:          container.category,
                key:               item.key,
                label:             item.label,
                selectedStepKey:   container.type === "slider"
                    ? (selectedSliderSteps[String(item._id)] ?? null)
                    : item.key,
                options:           item.options,
                impacts:           item.impacts,
                impactLevel:       item.impactLevel,
                cost:              item.cost,
                energy:            item.energy,
                productsImpacted:  item.productsImpacted,
                });
            });
        });
        return entries;
    };

    const buildInputsPayload = () => {
        return selectedProductIds.map((productId) => {
            const product = products.find((p: any) => String(p._id) === productId);
            const values  = allProductFieldValues[productId] ?? {};
            const fields  = Object.entries(values).map(([fieldId, value]) => ({ fieldId, value }));
            return {
            productId,
            segmentId:   product?.segmentId,
            productName: product?.productName,
            fields,
            };
        });
    };

    const triggerRecalc = (
        values:             Record<string, string>,
        currentGlobalItems: Record<string, string[]>
    ) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setPreviewLoading(true);
            setPreviewError("");
            try {
                const res = await recalcProjections({
                    simulationId:     simulationId!,
                    simulationTypeId: simulationTypeId!,
                    teamId:           teamId!,
                    roundNumber:      activeRound.roundNumber,
                    productId:        selectedProductId,
                    fields:           Object.entries(values).map(([fieldId, value]) => ({ fieldId, value })),
                    globalInputs:     buildGlobalInputsPayload(currentGlobalItems),
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

    const globalDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const triggerGlobalRecalc = (
        currentGlobalItems: Record<string, string[]>,
        currentFieldValues: Record<string, string>
    ) => {
        if (globalDebounceRef.current) clearTimeout(globalDebounceRef.current);
        globalDebounceRef.current = setTimeout(async () => {
            setPreviewLoading(true);
            setPreviewError("");
            try {
                const res = await recalcProjections({
                    simulationId:     simulationId!,
                    simulationTypeId: simulationTypeId!,
                    teamId:           teamId!,
                    roundNumber:      activeRound.roundNumber,
                    focusedProductId: selectedProductId || undefined, // which product has active field inputs
                    fields:           Object.entries(currentFieldValues).map(([fieldId, value]) => ({ fieldId, value })),
                    globalInputs:     buildGlobalInputsPayload(currentGlobalItems),
                });
                const projection = res.data?.data ?? res.data;
                if (selectedProductId) {
                    setPreview(projection.projections?.[selectedProductId] ?? null);
                }
            } catch (e: any) {
                setPreviewError(e.response?.data?.message ?? e.message);
            } finally {
                setPreviewLoading(false);
            }
        }, 500);
    };

    const handleFieldChange = (fieldId: string, value: string) => {
        const next = { ...fieldValues, [fieldId]: value };
        const snapshotGlobalItems = { ...selectedGlobalItems }; // capture synchronously
        setFieldValues(next);
        setAllProductFieldValues(prev => ({
            ...prev,
            [selectedProductId]: next,
        }));
        triggerRecalc(next, snapshotGlobalItems);
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

            const globalInputsRes = await getGlobalInputs(sim.simulationTypeId);
            setGlobalInputs(globalInputsRes.data?.data ?? globalInputsRes.data);

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

    const handleSubmit = async () => {
        setSubmitting(true);
        setSubmitError("");
        try {
            await createDecision({
            simulationId:     simulationId!,
            teamId:           teamId!,
            roundNumber:      activeRound.roundNumber,
            inputs:           buildInputsPayload(),
            initiativeInputs: [], // no initiatives in current simulation
            globalInputs:     buildGlobalInputsPayload(selectedGlobalItems),
            });
            setSubmitted(true);
        } catch (e: any) {
            setSubmitError(e.response?.data?.message ?? e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleGlobalItemToggle = (
        containerId:   string,
        item:          any,
        maxSelections: number | null,
        type:          string,
        stepKey?:      string
    ) => {
        const itemId = String(item._id);
        const effectiveMax        = type === "slider" ? 1 : maxSelections;
        const snapshotFieldValues = { ...fieldValues }; // capture synchronously

        setSelectedGlobalItems(prev => {
            const current = prev[containerId] ?? [];
            let next: string[];

            if (type === "radio" || type === "slider") {
                next = [itemId]; // both always cap at 1
            } else if (current.includes(itemId)) {
                next = current.filter(id => id !== itemId);
            } else if (effectiveMax !== null && current.length >= effectiveMax) {
                next = current;
            } else {
                next = [...current, itemId];
            }

            const nextGlobalItems = { ...prev, [containerId]: next };
            triggerGlobalRecalc(nextGlobalItems, snapshotFieldValues);
            return nextGlobalItems;
        });

        if (type === "slider" && stepKey) {
            setSelectedSliderSteps(prev => ({ ...prev, [itemId]: stepKey }));
        }
    };

    const GlobalInputSelector = ({
        container,
        selectedItems,
        selectedSliderSteps,
        disabled,
        onToggle,
    }: {
        container:           any;
        selectedItems:       string[];
        selectedSliderSteps: Record<string, string>;
        disabled:            boolean;
        onToggle:            (item: any, stepKey?: string) => void;
    }) => {
        const { type, inputs, maxSelections, label } = container;

        return (
            <div style={{ marginBottom: 16 }}>
            <strong>{label}</strong>
            {maxSelections !== null && (
                <span style={{ fontSize: 11, color: "#888", marginLeft: 8 }}>
                (select up to {maxSelections})
                </span>
            )}

            {type === "radio" && (
                <div style={{ marginTop: 4 }}>
                {inputs.map((item: any) => (
                    <label key={item._id} style={{ display: "block", marginBottom: 4 }}>
                    <input
                        type="radio"
                        disabled={submitted}
                        name={container._id}
                        checked={selectedItems.includes(item._id)}
                        onChange={() => onToggle(item)}
                    />{" "}
                    {item.label}
                    {item.description && (
                        <span style={{ fontSize: 11, color: "#888", marginLeft: 6 }}>{item.description}</span>
                    )}
                    </label>
                ))}
                </div>
            )}

            {type === "checkbox" && (
                <div style={{ marginTop: 4 }}>
                {inputs.map((item: any) => {
                    const isSelected = selectedItems.includes(String(item._id));
                    const atCap      = maxSelections !== null && selectedItems.length >= maxSelections && !isSelected;
                    return (
                    <label key={item._id} style={{ display: "block", marginBottom: 4, opacity: atCap ? 0.4 : 1 }}>
                        <input
                        type="checkbox"
                        checked={selectedItems.includes(String(item._id))}
                        disabled={atCap || submitted}
                        onChange={() => onToggle(item)}
                        />{" "}
                        {item.label}
                        {item.description && (
                        <span style={{ fontSize: 11, color: "#888", marginLeft: 6 }}>{item.description}</span>
                        )}
                    </label>
                    );
                })}
                </div>
            )}

            {type === "slider" && (
                <div style={{ marginTop: 4 }}>
                    {inputs.map((item: any) => {
                    const steps    = Object.entries(item.options ?? {}) as [string, number][];
                    // sort by numeric value ascending — low to high
                    const sortedSteps = steps.sort(([, a], [, b]) => a - b);
                    const stepKeys    = sortedSteps.map(([k]) => k);

                    return (
                        <div key={item._id} style={{ marginBottom: 8 }}>
                        <div>{item.label}</div>
                        {item.description && (
                            <div style={{ fontSize: 11, color: "#888" }}>{item.description}</div>
                        )}
                        {sortedSteps.length > 0 ? (
                            <div>
                            <input
                                type="range"
                                disabled={submitted}
                                min={0}
                                max={sortedSteps.length - 1}
                                step={1}
                                value={Math.max(0, stepKeys.indexOf(selectedSliderSteps?.[String(item._id)] ?? ""))}
                                onChange={e => {
                                const idx     = Number(e.target.value);
                                const stepKey = stepKeys[idx];
                                if (stepKey) onToggle(item, stepKey);
                                }}
                            />
                            <div style={{ fontSize: 11, display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                                {sortedSteps.map(([k, v], i) => {
                                    const effectiveCost = (item.cost ?? 0) * v;
                                    const isSelected    = stepKeys.indexOf(selectedSliderSteps?.[String(item._id)] ?? "") === i;
                                    return (
                                    <span
                                        key={k}
                                        style={{ fontWeight: isSelected ? "bold" : "normal", textAlign: "center" }}
                                    >
                                        <div>{k}</div>
                                        <div style={{ color: "#888" }}>×{v}</div>
                                        <div>💰 {effectiveCost.toLocaleString()}</div>
                                    </span>
                                    );
                                })}
                                </div>
                            </div>
                        ) : (
                            <p style={{ color: "orange", fontSize: 11 }}>No steps configured yet.</p>
                        )}
                        </div>
                    );
                    })}
                </div>
            )}
            </div>
        );
    };

    // ... product switcher + field inputs + live preview go here, next step
    return (
        <div>
            <h2>Round {activeRound?.roundNumber ?? "—"}</h2>

            {globalInputs.length > 0 && (
            <div style={{ marginBottom: 16 }}>
                <h3>Global Inputs</h3>
                {globalInputs.map((container: any) => (
                <GlobalInputSelector
                    key={container._id}
                    disabled={submitted}
                    container={container}
                    selectedItems={selectedGlobalItems[container._id] ?? []}
                    selectedSliderSteps={selectedSliderSteps}
                    onToggle={(item, stepKey) =>
                        handleGlobalItemToggle(container._id, item, container.maxSelections, container.type, stepKey)
                    }
                />
                ))}
            </div>
            )}

            {/* Add below the global inputs section, above the product switcher */}
            {submitError && <p style={{ color: "red" }}>{submitError}</p>}

            {submitted ? (
                <div style={{ padding: 16, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 4, marginBottom: 16 }}>
                    <strong>Decision submitted.</strong> Your inputs have been locked for this round.
                </div>
            ) : (
                <button
                    onClick={handleSubmit}
                    disabled={submitting || selectedProductIds.length === 0}
                    style={{ marginBottom: 16 }}
                >
                    {submitting ? "Submitting..." : "Submit Decision"}
                </button>
            )}

            <div style={{ marginBottom: 16 }}>
                <h3>Products</h3>
                {products.map((p: any) => (
                    <label key={p._id} style={{ display: "block", marginBottom: 4, opacity: submitted ? 0.6 : 1 }}>
                        <input
                            type="checkbox"
                            disabled={submitted}
                            checked={selectedProductIds.includes(String(p._id))}
                            onChange={() => {
                            const pid  = String(p._id);
                            const next = selectedProductIds.includes(pid)
                                ? selectedProductIds.filter(id => id !== pid)
                                : [...selectedProductIds, pid];
                            setSelectedProductIds(next);
                            // focus the product that was just checked, unfocus if unchecked
                            setSelectedProductId(next.includes(pid) ? pid : (next[next.length - 1] ?? ""));
                            }}
                        />{" "}
                        <span
                            style={{ fontWeight: selectedProductId === String(p._id) ? "bold" : "normal", cursor: "pointer" }}
                            onClick={() => {
                            // clicking the label text switches focus without toggling selection
                            if (selectedProductIds.includes(String(p._id))) {
                                setSelectedProductId(String(p._id));
                            }
                            }}
                        >
                            {p.productName}
                        </span>
                    </label>
                ))}
            </div>

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
                            disabled={submitted}
                            onChange={e => handleFieldChange(field._id, e.target.value)}
                        />
                        </label>
                        {field.type === "money" && field.unitCost != null && (
                        <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                            Unit cost: {field.unitCost.toLocaleString()} × {Number(fieldValues[field._id] ?? 0).toLocaleString()} = {(field.unitCost * Number(fieldValues[field._id] ?? 0)).toLocaleString()}
                        </div>
                        )}
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
                        <tr><td>Selling Price</td><td>{preview.sellingPrice?.toFixed(2)}</td></tr>
                        <tr><td>Product Score (will be hidden)</td><td>{preview.dynamicPrice?.toFixed(2)}</td></tr>
                        <tr><td>Estimated Customer Purchase Rate (will be hidden)</td><td>{preview.productScore?.toFixed(4)}</td></tr>
                        <tr><td>Effective Cost</td><td>{preview.dynamicCost?.toFixed(2)}</td></tr>
                        <tr><td>Revenue</td><td>{preview.revenue?.toFixed(2)}</td></tr>
                        <tr><td>COGS</td><td>{preview.COGS?.toFixed(2)}</td></tr>
                        <tr><td>Gross Profit</td><td>{preview.grossProfit?.toFixed(2)}</td></tr>
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