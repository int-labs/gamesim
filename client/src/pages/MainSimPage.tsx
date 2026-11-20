import { useEffect, useRef, useState } from "react";
import {
    Alert, Button, Card, Checkbox, DataTable, Heading, PageHeader, Select, Slider, Text, TextField,
    type DataTableColumn,
} from "@stratagem/design-system";
import { loginWithPasskey, getRounds, getSimulationById, getProducts, setAuthToken, getProductFields, recalcProjections, getGlobalInputs, createDecision, getSegments } from "../api";

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
    // keyed by productId → pms value (0–1)
    // keyed by productId → { fieldId: value }

    const [segments, setSegments]               = useState<any[]>([]);
    const [selectedSegmentId, setSelectedSegmentId] = useState("");

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

    useEffect(() => {
        if (!selectedSegmentId || !simulationTypeId) {
            setProducts([]);
            setSelectedProductIds([]);
            setSelectedProductId("");
            return;
        }
        getProducts(simulationTypeId, selectedSegmentId)
            .then(res => setProducts(res.data?.data ?? res.data))
            .catch((e: any) => setError(e.message));
    }, [selectedSegmentId]);

    const buildGlobalInputsPayload = (
        currentGlobalItems:  Record<string, string[]>,
        currentSliderSteps?: Record<string, string>
    ) => {
        const stepsToUse = currentSliderSteps ?? selectedSliderSteps;
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
                selectedStepKey: container.type === "slider"
                    ? (stepsToUse[String(item._id)] ?? null)
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
            return {
                productId,
                segmentId:   selectedSegmentId, // from selected segment, not product object
                productName: product?.productName,
                fields:      Object.entries(values).map(([fieldId, value]) => ({ fieldId, value })),
            };
        });
    };

    const triggerRecalc = (
        values:             Record<string, string>,
        currentGlobalItems: Record<string, string[]>,
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
                    focusedProductId: selectedProductId,
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
        currentFieldValues: Record<string, string>,
        currentSliderSteps?: Record<string, string>
    ) => {
        const stepsToUse = currentSliderSteps ?? selectedSliderSteps;

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
                    globalInputs: buildGlobalInputsPayload(currentGlobalItems, stepsToUse),
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
        setFieldValues(next);
        setAllProductFieldValues(prev => ({
            ...prev,
            [selectedProductId]: next,
        }));
        triggerRecalc(next, { ...selectedGlobalItems });
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
            const sim    = simRes.data?.data ?? simRes.data;
            setSimulationTypeId(sim.simulationTypeId);

            const segmentsRes = await getSegments(sim.simulationTypeId);
            setSegments(segmentsRes.data?.data ?? segmentsRes.data);
            // products no longer fetched here — deferred until segment is selected

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
        <>
            <PageHeader title="Team Login" />
            {error && <Alert tone="danger">{error}</Alert>}
            <Card>
                <TextField label="Passkey" placeholder="Enter your passkey" value={passkey} onChange={e => setPasskey(e.target.value)} />
                <Button className="self-start" onClick={handleLogin} disabled={loading}>Log In</Button>
            </Card>
        </>
        );
    }

    if (roundStatus === "waiting") {
        return <Text>Waiting for the round to start...</Text>;
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
        const itemId          = String(item._id);
        const effectiveMax    = type === "slider" ? 1 : maxSelections;
        const snapshotFieldValues = { ...fieldValues };

        // snapshot slider steps with new stepKey already merged in
        const snapshotSliderSteps = type === "slider" && stepKey
            ? { ...selectedSliderSteps, [itemId]: stepKey }
            : { ...selectedSliderSteps };

        // update slider steps state immediately
        if (type === "slider" && stepKey) {
            setSelectedSliderSteps(snapshotSliderSteps);
        }

        setSelectedGlobalItems(prev => {
            const current = prev[containerId] ?? [];
            let next: string[];

            if (type === "radio" || type === "slider") {
                next = current.includes(itemId) && !stepKey
                ? current.filter(id => id !== itemId) // deactivate if no stepKey
                : [itemId];
            } else if (current.includes(itemId)) {
                next = current.filter(id => id !== itemId);
            } else if (effectiveMax !== null && current.length >= effectiveMax) {
                next = current;
            } else {
                next = [...current, itemId];
            }

            const nextGlobalItems = { ...prev, [containerId]: next };
            triggerGlobalRecalc(nextGlobalItems, snapshotFieldValues, snapshotSliderSteps);
            return nextGlobalItems;
        });
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
            <div className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
                <Text as="strong" weight="semibold">{label}</Text>
                {maxSelections !== null && (
                    <Text as="span" variant="caption" tone="subtle">
                    (select up to {maxSelections})
                    </Text>
                )}
            </div>

            {type === "radio" && (
                <div className="flex flex-col gap-1">
                {inputs.map((item: any) => (
                    <label key={item._id} className="flex items-center gap-2 type-body">
                    {/* The design system has no radio primitive, so the native input stays */}
                    <input
                        type="radio"
                        disabled={submitted}
                        name={container._id}
                        checked={selectedItems.includes(item._id)}
                        onChange={() => onToggle(item)}
                    />
                    {item.label}
                    {item.description && (
                        <Text as="span" variant="caption" tone="subtle">{item.description}</Text>
                    )}
                    </label>
                ))}
                </div>
            )}

            {type === "checkbox" && (
                <div className="flex flex-col gap-1">
                {inputs.map((item: any) => {
                    const isSelected = selectedItems.includes(String(item._id));
                    const atCap      = maxSelections !== null && selectedItems.length >= maxSelections && !isSelected;
                    return (
                    <label key={item._id} className={`flex items-center gap-2 type-body ${atCap ? "opacity-40" : ""}`}>
                        <Checkbox
                        checked={selectedItems.includes(String(item._id))}
                        disabled={atCap || submitted}
                        onCheckedChange={() => onToggle(item)}
                        />
                        {item.label}
                        {item.description && (
                        <Text as="span" variant="caption" tone="subtle">{item.description}</Text>
                        )}
                    </label>
                    );
                })}
                </div>
            )}

            {type === "slider" && (
                <div className="flex flex-col gap-2">
                    {inputs.map((item: any) => {
                    const steps       = Object.entries(item.options ?? {}) as [string, number][];
                    const sortedSteps = steps.sort(([, a], [, b]) => a - b);
                    const stepKeys    = sortedSteps.map(([k]) => k);
                    const isActivated = selectedItems.includes(String(item._id));
                    const lowestStepKey = sortedSteps[0]?.[0] ?? null;
                    const selectedIdx = Math.max(0, stepKeys.indexOf(selectedSliderSteps?.[String(item._id)] ?? lowestStepKey ?? ""));

                    return (
                        <div key={item._id} className="flex flex-col gap-1">
                        <label className="flex items-center gap-2 type-body">
                            <Checkbox
                            disabled={disabled}
                            checked={isActivated}
                            onCheckedChange={() => {
                                if (!isActivated && lowestStepKey) {
                                // seed to lowest step on first activation
                                onToggle(item, lowestStepKey);
                                } else {
                                onToggle(item);
                                }
                            }}
                            />
                            {item.label}
                        </label>
                        {item.description && (
                            <Text variant="caption" tone="subtle">{item.description}</Text>
                        )}
                        {isActivated && sortedSteps.length > 0 && (
                            <div className="flex flex-col gap-1">
                            <Slider
                                aria-label={item.label}
                                disabled={disabled}
                                labels={stepKeys}
                                value={selectedIdx}
                                onValueChange={idx => {
                                const stepKey = stepKeys[idx];
                                if (stepKey) onToggle(item, stepKey);
                                }}
                            />
                            <div className="flex justify-between type-caption">
                                {sortedSteps.map(([k, v], i) => {
                                const effectiveCost = (item.cost ?? 0) * v;
                                const isSelected    = selectedIdx === i;
                                return (
                                    <span key={k} className={`text-center ${isSelected ? "font-semibold" : ""}`}>
                                    <Text as="span" tone="subtle" className="block">×{v}</Text>
                                    <span className="block">💰 {effectiveCost.toLocaleString()}</span>
                                    </span>
                                );
                                })}
                            </div>
                            </div>
                        )}
                        {isActivated && sortedSteps.length === 0 && (
                            <Text variant="caption" tone="warning">No steps configured yet.</Text>
                        )}
                        </div>
                    );
                    })}
                </div>
            )}
            </div>
        );
    };

    const previewRows: [string, string | undefined][] = preview ? [
        ["Demand", preview.customersObtained?.toFixed(2)],
        ["Selling Price", preview.sellingPrice?.toFixed(2)],
        ["Product Score (will be hidden)", preview.dynamicPrice?.toFixed(2)],
        ["Estimated Customer Purchase Rate (will be hidden)", preview.productScore?.toFixed(4)],
        ["Effective Cost", preview.dynamicCost?.toFixed(2)],
        ["Revenue", preview.revenue?.toFixed(2)],
        ["COGS", preview.COGS?.toFixed(2)],
        ["Gross Profit", preview.grossProfit?.toFixed(2)],
    ] : [];

    // ... product switcher + field inputs + live preview go here, next step
    return (
        <>
            <PageHeader title={`Round ${activeRound?.roundNumber ?? "—"}`} />

            {globalInputs.length > 0 && (
            <Card>
                <Heading level={3}>Global Inputs</Heading>
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
            </Card>
            )}

            {/* Add below the global inputs section, above the product switcher */}
            {submitError && <Alert tone="danger">{submitError}</Alert>}

            {submitted ? (
                <Alert tone="success">
                    <strong>Decision submitted.</strong> Your inputs have been locked for this round.
                </Alert>
            ) : (
                <Button
                    className="self-start"
                    onClick={handleSubmit}
                    disabled={submitting || selectedProductIds.length === 0}
                >
                    {submitting ? "Submitting..." : "Submit Decision"}
                </Button>
            )}

            <Select
                label="Segment"
                placeholder="-- select a segment --"
                value={selectedSegmentId || null}
                onValueChange={v => {
                    setSelectedSegmentId(v ?? "");
                    setSelectedProductIds([]);
                    setSelectedProductId("");
                    setFieldValues({});
                    setPreview(null);
                }}
                disabled={submitted}
                options={segments.map((s: any) => ({ value: s._id, label: s.name ?? s._id }))}
            />

            <Card>
            <Heading level={3}>Products</Heading>
                {!selectedSegmentId && (
                    <Text variant="caption" tone="subtle">Select a segment first.</Text>
                )}
                {selectedSegmentId && products.map((p: any) => (
                    <div key={p._id} className={`flex items-center gap-2 type-body ${submitted ? "opacity-60" : ""}`}>
                    <Checkbox
                        aria-label={p.productName}
                        disabled={submitted}
                        checked={selectedProductIds.includes(String(p._id))}
                        onCheckedChange={() => {
                        const pid  = String(p._id);
                        const next = selectedProductIds.includes(pid)
                            ? selectedProductIds.filter(id => id !== pid)
                            : [...selectedProductIds, pid];
                        setSelectedProductIds(next);
                        setSelectedProductId(next.includes(pid) ? pid : (next[next.length - 1] ?? ""));
                        }}
                    />
                    <Button
                        variant={selectedProductId === String(p._id) ? "secondary" : "text"}
                        onClick={() => {
                        if (selectedProductIds.includes(String(p._id))) {
                            setSelectedProductId(String(p._id));
                        }
                        }}
                    >
                        {p.productName}
                    </Button>
                    </div>
                ))}
            </Card>

            {selectedProductId && (
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <Heading level={3}>Decision Inputs</Heading>
                    {productFields.map((field: any) => (
                    <TextField
                        key={field._id}
                        label={`${field.label}${field.required ? " *" : ""}`}
                        value={fieldValues[field._id] ?? ""}
                        disabled={submitted}
                        onChange={e => handleFieldChange(field._id, e.target.value)}
                        description={field.type === "money" && field.unitCost != null
                            ? `Unit cost: ${field.unitCost.toLocaleString()} × ${Number(fieldValues[field._id] ?? 0).toLocaleString()} = ${(field.unitCost * Number(fieldValues[field._id] ?? 0)).toLocaleString()}`
                            : undefined}
                    />
                    ))}
                </Card>

                <Card>
                <div className="flex items-baseline gap-2">
                    <Heading level={3}>Live Preview</Heading>
                    {previewLoading && <Text as="span" variant="caption" tone="subtle">(updating...)</Text>}
                </div>
                {previewError && <Alert tone="danger">{previewError}</Alert>}
                {!preview && !previewLoading && <Text tone="subtle">Start entering values to see a preview.</Text>}
                {preview && (
                    <DataTable label="Live preview" density="compact" columns={PREVIEW_COLUMNS} rows={previewRows} rowKey={([label]) => label} />
                )}
                {preview?.productCostBreakdown?.length > 0 && (
                    <>
                        <Heading level={4}>Cost Breakdown</Heading>
                        <DataTable
                            label="Cost Breakdown"
                            density="compact"
                            columns={BREAKDOWN_COLUMNS}
                            rows={preview.productCostBreakdown}
                            rowKey={(entry: any) => entry.key}
                        />
                    </>
                )}
                {preview?.incurredCosts?.length > 0 && (
                    <>
                        <Heading level={4}>Incurred Costs (per unit)</Heading>
                        <DataTable
                            label="Incurred Costs (per unit)"
                            density="compact"
                            columns={INCURRED_COLUMNS}
                            rows={preview.incurredCosts}
                            // A category can land on BOTH sides of the line, so the treatment is part of the row identity
                            rowKey={(entry: any) => entry.treatment + ':' + entry.key}
                        />
                    </>
                )}
                {preview?.globalInputCosts?.length > 0 && (
                    <>
                        <Heading level={4}>Global Input Costs</Heading>
                        {/* No Qty/Cost-Unit columns: the charge is already final, so there is no quantity to divide by */}
                        <DataTable
                            label="Global Input Costs"
                            density="compact"
                            columns={GLOBAL_COST_COLUMNS}
                            rows={preview.globalInputCosts}
                            rowKey={(entry: any) => entry.treatment + ':' + entry.category}
                        />
                    </>
                )}
                </Card>
            </div>
            )}
        </>
    );
}

const fixed2 = (v: unknown) => Number(v ?? 0).toFixed(2);

const PREVIEW_COLUMNS: DataTableColumn<[string, string | undefined]>[] = [
    { id: "metric", header: "Metric", cell: ([label]) => label, primary: true },
    { id: "value", header: "Value", cell: ([, value]) => value, align: "end" },
];

const BREAKDOWN_COLUMNS: DataTableColumn<any>[] = [
    { id: "field", header: "Field", cell: (entry: any) => entry.label, primary: true },
    { id: "value", header: "Cost Contribution", cell: (entry: any) => fixed2(entry.value), align: "end" },
];

const INCURRED_COLUMNS: DataTableColumn<any>[] = [
    { id: "category", header: "Category", cell: (entry: any) => entry.category },
    { id: "item", header: "Item", cell: (entry: any) => entry.label, primary: true },
    { id: "qty", header: "Qty", cell: (entry: any) => fixed2(entry.inputQty), align: "end" },
    { id: "leftover", header: "Leftover", cell: (entry: any) => fixed2(entry.leftover), align: "end" },
    { id: "costPerUnit", header: "Cost/Unit", cell: (entry: any) => fixed2(entry.costPerUnit), align: "end" },
    { id: "incurred", header: "Incurred", cell: (entry: any) => fixed2(entry.incurredCost), align: "end" },
];

const GLOBAL_COST_COLUMNS: DataTableColumn<any>[] = [
    { id: "category", header: "Category", cell: (entry: any) => entry.label, primary: true },
    { id: "side", header: "Side", cell: (entry: any) => entry.treatment },
    {
        id: "contributors",
        header: "Contributing items",
        cell: (entry: any) => (entry.contributors ?? [])
            .map((c: any) => `${c.label} (×${Number(c.stepValue ?? 0)}) ${Number(c.incurredCost ?? 0).toFixed(2)}`)
            .join(', '),
    },
    { id: "incurred", header: "Incurred", cell: (entry: any) => fixed2(entry.incurredCost), align: "end" },
];