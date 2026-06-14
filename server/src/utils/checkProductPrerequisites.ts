import { DecisionInterface } from "../models/decisions.js";
import {
  ProductInterface,
  ProductUnlockPrerequisite,
} from "../models/products.js";

export interface PrerequisiteCheckResult {
  isMet: boolean;
  unmetRequirements: Array<{
    prerequisite: ProductUnlockPrerequisite;
    reason: string;
    actualValue?: number;
  }>;
}

/**
 * Check if all prerequisites for a product are met based on the previous round's decision
 */
export function checkProductPrerequisites(
  product: ProductInterface,
  previousRoundDecision: DecisionInterface | null
): PrerequisiteCheckResult {
  // If no prerequisites, product is unlocked by default
  if (
    !product.unlockPrerequisites ||
    product.unlockPrerequisites.length === 0
  ) {
    return {
      isMet: true,
      unmetRequirements: [],
    };
  }

  // If no previous round decision, prerequisites cannot be met (except round 1)
  if (!previousRoundDecision) {
    return {
      isMet: false,
      unmetRequirements: product.unlockPrerequisites.map((prereq) => ({
        prerequisite: prereq,
        reason: "No previous round decision available",
      })),
    };
  }

  const unmetRequirements: PrerequisiteCheckResult["unmetRequirements"] = [];

  // Check each prerequisite
  for (const prereq of product.unlockPrerequisites) {
    let actualValue: number | undefined;
    let found = false;

    // Check based on level
    if (prereq.level === "product") {
      // Find the product decision detail
      const productDecision = previousRoundDecision.decisionDetails.find(
        (dd) => dd.productId.toString() === prereq.targetId.toString()
      );

      if (productDecision) {
        // Find the field
        const field = productDecision.fields.find(
          (f) => f.key === prereq.fieldKey
        );

        if (field) {
          actualValue = field.value;
          found = true;
        }
      }
    } else if (prereq.level === "segment") {
      // Find the segment decision detail
      const segmentDecision =
        previousRoundDecision.segmentDecisionDetails.find(
          (sd) => sd.segmentId.toString() === prereq.targetId.toString()
        );

      if (segmentDecision) {
        // Find the field
        const field = segmentDecision.fields.find(
          (f) => f.key === prereq.fieldKey
        );

        if (field) {
          actualValue = field.value;
          found = true;
        }
      }
    } else if (prereq.level === "global") {
      // Find the global decision detail
      const globalDecision = previousRoundDecision.globalDecisionDetails.find(
        (gd) =>
          gd.globalInputId.toString() === prereq.targetId.toString() &&
          gd.key === prereq.fieldKey
      );

      if (globalDecision) {
        actualValue = globalDecision.value;
        found = true;
      }
    }

    // If field not found in previous decision
    if (!found) {
      unmetRequirements.push({
        prerequisite: prereq,
        reason: `${prereq.targetName || "Target"} field "${prereq.fieldKey}" not found in previous round`,
      });
      continue;
    }

    // Check if condition is met using the operator
    const conditionMet = checkCondition(
      actualValue!,
      prereq.operator,
      prereq.value
    );

    if (!conditionMet) {
      unmetRequirements.push({
        prerequisite: prereq,
        reason: `${prereq.targetName || "Target"} field "${prereq.fieldKey}" must be ${prereq.operator} ${prereq.value}`,
        actualValue: actualValue,
      });
    }
  }

  return {
    isMet: unmetRequirements.length === 0,
    unmetRequirements,
  };
}

/**
 * Check if a value meets the condition based on operator
 */
function checkCondition(
  actualValue: number,
  operator: string,
  requiredValue: number
): boolean {
  switch (operator) {
    case ">=":
      return actualValue >= requiredValue;
    case "<=":
      return actualValue <= requiredValue;
    case "==":
      return actualValue === requiredValue;
    case ">":
      return actualValue > requiredValue;
    case "<":
      return actualValue < requiredValue;
    case "!=":
      return actualValue !== requiredValue;
    default:
      return false;
  }
}

