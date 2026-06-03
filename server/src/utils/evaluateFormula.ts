/**
 * Simple formula evaluator for decision fields
 * Supports basic math operations: +, -, *, /, ()
 * References other fields by key
 */

export type FieldValues = {
  [key: string]: number;
};

export const getTextDropdownCosts = (
  field: any,
  currentTextValue: string,
  subProductKey?: string,
  numericValueFallback?: number
) => {
  let option = field.options?.find((o: any) => o.value === currentTextValue);

  if (!option && numericValueFallback !== undefined) {
    option = field.options?.find(
      (o: any) => o.numericValue === numericValueFallback
    );
  }

  const numericValue = option?.numericValue ?? numericValueFallback ?? 0;

  const findCost = (items: any[], matchKey: string) => {
    if (!items) return 0;
    // Try specific subproduct match first
    const specific = items.find(
      (i) => i[matchKey] === numericValue && i.subProductKey === subProductKey
    );
    if (specific) return specific.cost;
    // Fallback to generic (no subProductKey)
    const generic = items.find(
      (i) => i[matchKey] === numericValue && !i.subProductKey
    );
    return generic ? generic.cost : 0;
  };

  const cost = findCost(field.costs, "selectedValue");
  const energy = findCost(field.energyCosts, "changeValue");

  return { cost, energy };
};

export type FieldResolver = (
  baseFieldKey: string,
  suffix: "_cost" | "_energy"
) => number | undefined;

/**
 * Evaluates a simple math formula with field references
 * @param formula - Formula string (e.g., "field1 + field2 * 0.1")
 * @param fieldValues - Map of field keys to their numeric values
 * @param fieldResolver - Optional resolver for _cost and _energy suffixes
 * @returns Evaluated numeric result
 */
export function evaluateFormula(
  formula: string,
  fieldValues: FieldValues,
  fieldResolver?: FieldResolver
): number {
  if (!formula || typeof formula !== "string") {
    throw new Error("Formula must be a non-empty string");
  }

  try {
    // Replace field references with their values
    let expression = formula.trim();

    // Extract all field references (alphanumeric identifiers)
    const fieldPattern = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
    const fieldKeys = expression.match(fieldPattern) || [];

    // Replace each field reference with its value
    for (const fieldKey of fieldKeys) {
      // Skip if it's a number or operator
      if (/^\d+\.?\d*$/.test(fieldKey)) continue;
      if (
        ["Math", "Math.abs", "Math.round", "Math.floor", "Math.ceil"].includes(
          fieldKey
        )
      )
        continue;

      let value = fieldValues[fieldKey];

      // Handle _cost and _energy suffixes via resolver
      if (
        (value === undefined || value === null) &&
        fieldResolver &&
        (fieldKey.endsWith("_cost") || fieldKey.endsWith("_energy"))
      ) {
        const baseFieldKey = fieldKey.replace(/_(cost|energy)$/, "");
        const suffix = fieldKey.endsWith("_cost") ? "_cost" : "_energy";
        const resolvedValue = fieldResolver(baseFieldKey, suffix);
        if (resolvedValue !== undefined) {
          value = resolvedValue;
        }
      }

      if (value === undefined || value === null) {
        // Default to 0 for missing variables to prevent crashing simple math
        value = 0;
      }

      // Replace the field key with its numeric value
      const regex = new RegExp(`\\b${fieldKey}\\b`, "g");
      expression = expression.replace(regex, String(value));
    }

    // Evaluate the expression safely
    // Using Function constructor for basic math evaluation
    const result = Function(`"use strict"; return (${expression})`)();

    if (typeof result !== "number" || isNaN(result) || !isFinite(result)) {
      throw new Error("Formula evaluation resulted in invalid number");
    }

    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Formula evaluation error: ${error.message}`);
    }
    throw new Error("Unknown error evaluating formula");
  }
}

/**
 * Validates formula syntax (basic check)
 */
export function validateFormula(formula: string): {
  valid: boolean;
  error?: string;
} {
  if (!formula || typeof formula !== "string") {
    return { valid: false, error: "Formula must be a non-empty string" };
  }

  // Basic syntax checks
  const openParens = (formula.match(/\(/g) || []).length;
  const closeParens = (formula.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    return { valid: false, error: "Mismatched parentheses" };
  }

  // Check for dangerous patterns (basic security)
  const dangerousPatterns = [
    /eval\s*\(/i,
    /function\s*\(/i,
    /import\s+/i,
    /require\s*\(/i,
    /process\./i,
    /global\./i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(formula)) {
      return { valid: false, error: "Formula contains unsafe patterns" };
    }
  }

  return { valid: true };
}
