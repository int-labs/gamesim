import mongoose from "mongoose";
import { DecisionInterface } from "../models/decisions.js";
import { ProductInterface } from "../models/products.js";
import { evaluateFormula, FieldResolver, getTextDropdownCosts } from "./evaluateFormula";

interface ReadonlyCalculationParams {
  product: ProductInterface;
  mappedFields: any[];
  prevRoundDecision: any;
  baseData: any;
  simulationRound: number;
}

export const calculateReadonlyFields = (params: ReadonlyCalculationParams) => {
  const { product, mappedFields, prevRoundDecision, baseData, simulationRound } = params;

  const subProductKeys =
    product.subProducts && product.subProducts.length > 0
      ? product.subProducts.map((sp: any) => sp.key)
      : [undefined];

  for (const spKey of subProductKeys) {
    // Build context for this sub-product
    const context: Record<string, number> = {};

    // 1. Add current decision fields
    mappedFields.forEach((f: any) => {
      if (!f.subProductKey || f.subProductKey === spKey) {
        context[f.key] = f.value;
      }
    });

    // 2. Add simulation parameters
    product.simulationParams?.forEach((p: any) => {
      if (!p.subProductKey || p.subProductKey === spKey) {
        context[`param_${p.key}`] = p.value;
        context[p.key] = p.value;
      }
    });

    const fieldResolver: FieldResolver = (
      baseFieldKey: string,
      suffix: "_cost" | "_energy"
    ) => {
      const fieldDef = product.fields?.find(
        (pf: any) => pf.key === baseFieldKey
      );
      if (!fieldDef) return undefined;

      const selectedValue = context[baseFieldKey];
      if (selectedValue === undefined || selectedValue === null) {
        return undefined;
      }

      if (suffix === "_cost") {
        if (fieldDef.type === "text-dropdown") {
          const fieldData = mappedFields.find(
            (f: any) =>
              f.key === baseFieldKey && f.subProductKey === spKey
          );
          const { cost } = getTextDropdownCosts(
            fieldDef,
            fieldData?.textValue || "",
            spKey,
            selectedValue
          );
          return cost;
        } else if (
          fieldDef.type === "numerical-dropdown" ||
          fieldDef.type === "slider"
        ) {
          return (
            (fieldDef.costs || []).find(
              (c: any) => c.selectedValue === selectedValue
            )?.cost ?? undefined
          );
        }
      } else if (suffix === "_energy") {
        if (fieldDef.type === "text-dropdown") {
          const fieldData = mappedFields.find(
            (f: any) =>
              f.key === baseFieldKey && f.subProductKey === spKey
          );
          const { energy } = getTextDropdownCosts(
            fieldDef,
            fieldData?.textValue || "",
            spKey,
            selectedValue
          );
          return energy;
        } else if (
          fieldDef.type === "numerical-dropdown" ||
          fieldDef.type === "slider"
        ) {
          const prevVal =
            prevRoundDecision?.decisionDetails
              .find(
                (pd: any) =>
                  pd.productId.toString() === product._id.toString()
              )
              ?.fields.find(
                (f: any) =>
                  f.key === baseFieldKey && f.subProductKey === spKey
              )?.value ?? 0;

          const changeValue = selectedValue - prevVal;
          return (
            (fieldDef.energyCosts || []).find(
              (c: any) => c.changeValue === changeValue
            )?.cost ?? undefined
          );
        }
      }
      return undefined;
    };

    // 4. Find and evaluate readonly fields with formulas
    const readonlyFields = product.fields?.filter(
      (f: any) =>
        f.type === "readonly" && f.readonlyTypeConfig?.formula
    );

    readonlyFields?.forEach((rf: any) => {
      try {
        const formula = rf.readonlyTypeConfig.formula;

        // Inject Market Size if referenced in formula
        if (
          formula.includes("market_size") ||
          formula.includes("marketSize")
        ) {
          const chInfo = baseData.getYearlyDataForProduct?.(
            product.segmentId.toString(),
            product._id.toString(),
            simulationRound,
            spKey
          );
          if (chInfo) {
            const val = chInfo.marketSize;
            context["market_size"] = val;
            context["marketSize"] = val;
          }
        }

        const result = evaluateFormula(
          formula,
          context,
          fieldResolver
        );

        // Update or Add to mappedFields
        const existingIdx = mappedFields.findIndex(
          (f: any) => f.key === rf.key && f.subProductKey === spKey
        );
        if (existingIdx !== -1) {
          mappedFields[existingIdx].value = result;
        } else {
          mappedFields.push({
            key: rf.key,
            value: result,
            subProductKey: spKey,
          });
        }
        // Update context in case other readonly fields depend on this one
        context[rf.key] = result;
      } catch (e) {
        console.error(
          `Error evaluating readonly field ${rf.key}:`,
          e
        );
      }
    });
  }
};
