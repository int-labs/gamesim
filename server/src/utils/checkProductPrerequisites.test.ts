import mongoose from "mongoose";
import { checkProductPrerequisites } from "./checkProductPrerequisites";
import { ProductInterface } from "../models/products";
import { DecisionInterface } from "../models/decisions";

describe("checkProductPrerequisites", () => {
  // Helper function to create a mock product
  const createMockProduct = (
    unlockPrerequisites: ProductInterface["unlockPrerequisites"] = []
  ): Partial<ProductInterface> => {
    return {
      _id: new mongoose.Types.ObjectId(),
      unlockPrerequisites: unlockPrerequisites || [],
    } as Partial<ProductInterface>;
  };

  // Helper function to create a mock decision
  const createMockDecision = (
    decisionDetails: DecisionInterface["decisionDetails"] = [],
    segmentDecisionDetails: DecisionInterface["segmentDecisionDetails"] = [],
    globalDecisionDetails: DecisionInterface["globalDecisionDetails"] = []
  ): DecisionInterface => {
    return {
      decisionDetails,
      segmentDecisionDetails,
      globalDecisionDetails,
    } as DecisionInterface;
  };

  describe("No prerequisites", () => {
    it("should return isMet: true when product has no prerequisites", () => {
      const product = createMockProduct();
      const result = checkProductPrerequisites(
        product as ProductInterface,
        null
      );

      expect(result.isMet).toBe(true);
      expect(result.unmetRequirements).toEqual([]);
    });

    it("should return isMet: true when product has empty prerequisites array", () => {
      const product = createMockProduct([]);
      const result = checkProductPrerequisites(
        product as ProductInterface,
        null
      );

      expect(result.isMet).toBe(true);
      expect(result.unmetRequirements).toEqual([]);
    });

    it("should return isMet: true when product has undefined prerequisites", () => {
      const product = createMockProduct(undefined);
      const result = checkProductPrerequisites(
        product as ProductInterface,
        null
      );

      expect(result.isMet).toBe(true);
      expect(result.unmetRequirements).toEqual([]);
    });
  });

  describe("Missing previous decision", () => {
    it("should return isMet: false when no previous decision exists", () => {
      const product = createMockProduct([
        {
          level: "product",
          targetId: new mongoose.Types.ObjectId(),
          fieldKey: "productLevel",
          operator: ">=",
          value: 5,
        },
      ]);

      const result = checkProductPrerequisites(
        product as ProductInterface,
        null
      );

      expect(result.isMet).toBe(false);
      expect(result.unmetRequirements).toHaveLength(1);
      expect(result.unmetRequirements[0].reason).toBe(
        "No previous round decision available"
      );
    });
  });

  describe("Product-level prerequisites", () => {
    it("should return isMet: true when product prerequisite is met (>=)", () => {
      const targetProductId = new mongoose.Types.ObjectId();
      const product = createMockProduct([
        {
          level: "product",
          targetId: targetProductId,
          fieldKey: "productLevel",
          operator: ">=",
          value: 5,
        },
      ]);

      const decision = createMockDecision([
        {
          productId: targetProductId,
          segmentId: new mongoose.Types.ObjectId(),
          fields: [{ key: "productLevel", value: 7 }],
        },
      ]);

      const result = checkProductPrerequisites(
        product as ProductInterface,
        decision
      );

      expect(result.isMet).toBe(true);
      expect(result.unmetRequirements).toEqual([]);
    });

    it("should return isMet: false when product prerequisite is not met (>=)", () => {
      const targetProductId = new mongoose.Types.ObjectId();
      const product = createMockProduct([
        {
          level: "product",
          targetId: targetProductId,
          fieldKey: "productLevel",
          operator: ">=",
          value: 5,
        },
      ]);

      const decision = createMockDecision([
        {
          productId: targetProductId,
          segmentId: new mongoose.Types.ObjectId(),
          fields: [{ key: "productLevel", value: 3 }],
        },
      ]);

      const result = checkProductPrerequisites(
        product as ProductInterface,
        decision
      );

      expect(result.isMet).toBe(false);
      expect(result.unmetRequirements).toHaveLength(1);
      expect(result.unmetRequirements[0].actualValue).toBe(3);
    });

    it("should return isMet: false when product field is not found", () => {
      const targetProductId = new mongoose.Types.ObjectId();
      const product = createMockProduct([
        {
          level: "product",
          targetId: targetProductId,
          fieldKey: "productLevel",
          operator: ">=",
          value: 5,
        },
      ]);

      const decision = createMockDecision([
        {
          productId: targetProductId,
          segmentId: new mongoose.Types.ObjectId(),
          fields: [{ key: "differentField", value: 10 }],
        },
      ]);

      const result = checkProductPrerequisites(
        product as ProductInterface,
        decision
      );

      expect(result.isMet).toBe(false);
      expect(result.unmetRequirements).toHaveLength(1);
      expect(result.unmetRequirements[0].reason).toContain("not found");
    });

    it("should return isMet: false when target product is not in decision", () => {
      const targetProductId = new mongoose.Types.ObjectId();
      const otherProductId = new mongoose.Types.ObjectId();
      const product = createMockProduct([
        {
          level: "product",
          targetId: targetProductId,
          fieldKey: "productLevel",
          operator: ">=",
          value: 5,
        },
      ]);

      const decision = createMockDecision([
        {
          productId: otherProductId,
          segmentId: new mongoose.Types.ObjectId(),
          fields: [{ key: "productLevel", value: 10 }],
        },
      ]);

      const result = checkProductPrerequisites(
        product as ProductInterface,
        decision
      );

      expect(result.isMet).toBe(false);
      expect(result.unmetRequirements).toHaveLength(1);
      expect(result.unmetRequirements[0].reason).toContain("not found");
    });
  });

  describe("Segment-level prerequisites", () => {
    it("should return isMet: true when segment prerequisite is met (<=)", () => {
      const targetSegmentId = new mongoose.Types.ObjectId();
      const product = createMockProduct([
        {
          level: "segment",
          targetId: targetSegmentId,
          fieldKey: "marketingSpend",
          operator: "<=",
          value: 1000,
        },
      ]);

      const decision = createMockDecision(
        [],
        [
          {
            segmentId: targetSegmentId,
            fields: [{ key: "marketingSpend", value: 800 }],
          },
        ]
      );

      const result = checkProductPrerequisites(
        product as ProductInterface,
        decision
      );

      expect(result.isMet).toBe(true);
      expect(result.unmetRequirements).toEqual([]);
    });

    it("should return isMet: false when segment prerequisite is not met (<=)", () => {
      const targetSegmentId = new mongoose.Types.ObjectId();
      const product = createMockProduct([
        {
          level: "segment",
          targetId: targetSegmentId,
          fieldKey: "marketingSpend",
          operator: "<=",
          value: 1000,
        },
      ]);

      const decision = createMockDecision(
        [],
        [
          {
            segmentId: targetSegmentId,
            fields: [{ key: "marketingSpend", value: 1500 }],
          },
        ]
      );

      const result = checkProductPrerequisites(
        product as ProductInterface,
        decision
      );

      expect(result.isMet).toBe(false);
      expect(result.unmetRequirements).toHaveLength(1);
      expect(result.unmetRequirements[0].actualValue).toBe(1500);
    });

    it("should return isMet: false when segment field is not found", () => {
      const targetSegmentId = new mongoose.Types.ObjectId();
      const product = createMockProduct([
        {
          level: "segment",
          targetId: targetSegmentId,
          fieldKey: "marketingSpend",
          operator: "<=",
          value: 1000,
        },
      ]);

      const decision = createMockDecision(
        [],
        [
          {
            segmentId: targetSegmentId,
            fields: [{ key: "differentField", value: 500 }],
          },
        ]
      );

      const result = checkProductPrerequisites(
        product as ProductInterface,
        decision
      );

      expect(result.isMet).toBe(false);
      expect(result.unmetRequirements).toHaveLength(1);
      expect(result.unmetRequirements[0].reason).toContain("not found");
    });
  });

  describe("Global-level prerequisites", () => {
    it("should return isMet: true when global prerequisite is met (==)", () => {
      const targetGlobalInputId = new mongoose.Types.ObjectId();
      const product = createMockProduct([
        {
          level: "global",
          targetId: targetGlobalInputId,
          fieldKey: "infrastructureLevel",
          operator: "==",
          value: 3,
        },
      ]);

      const decision = createMockDecision(
        [],
        [],
        [
          {
            globalInputId: targetGlobalInputId,
            key: "infrastructureLevel",
            value: 3,
          },
        ]
      );

      const result = checkProductPrerequisites(
        product as ProductInterface,
        decision
      );

      expect(result.isMet).toBe(true);
      expect(result.unmetRequirements).toEqual([]);
    });

    it("should return isMet: false when global prerequisite is not met (==)", () => {
      const targetGlobalInputId = new mongoose.Types.ObjectId();
      const product = createMockProduct([
        {
          level: "global",
          targetId: targetGlobalInputId,
          fieldKey: "infrastructureLevel",
          operator: "==",
          value: 3,
        },
      ]);

      const decision = createMockDecision(
        [],
        [],
        [
          {
            globalInputId: targetGlobalInputId,
            key: "infrastructureLevel",
            value: 5,
          },
        ]
      );

      const result = checkProductPrerequisites(
        product as ProductInterface,
        decision
      );

      expect(result.isMet).toBe(false);
      expect(result.unmetRequirements).toHaveLength(1);
      expect(result.unmetRequirements[0].actualValue).toBe(5);
    });

    it("should return isMet: false when global field is not found", () => {
      const targetGlobalInputId = new mongoose.Types.ObjectId();
      const product = createMockProduct([
        {
          level: "global",
          targetId: targetGlobalInputId,
          fieldKey: "infrastructureLevel",
          operator: "==",
          value: 3,
        },
      ]);

      const decision = createMockDecision(
        [],
        [],
        [
          {
            globalInputId: targetGlobalInputId,
            key: "differentKey",
            value: 3,
          },
        ]
      );

      const result = checkProductPrerequisites(
        product as ProductInterface,
        decision
      );

      expect(result.isMet).toBe(false);
      expect(result.unmetRequirements).toHaveLength(1);
      expect(result.unmetRequirements[0].reason).toContain("not found");
    });
  });

  describe("Different operators", () => {
    const targetProductId = new mongoose.Types.ObjectId();

    it("should handle > operator correctly", () => {
      const product = createMockProduct([
        {
          level: "product",
          targetId: targetProductId,
          fieldKey: "productLevel",
          operator: ">",
          value: 5,
        },
      ]);

      const decisionMet = createMockDecision([
        {
          productId: targetProductId,
          segmentId: new mongoose.Types.ObjectId(),
          fields: [{ key: "productLevel", value: 6 }],
        },
      ]);

      const decisionNotMet = createMockDecision([
        {
          productId: targetProductId,
          segmentId: new mongoose.Types.ObjectId(),
          fields: [{ key: "productLevel", value: 5 }],
        },
      ]);

      expect(
        checkProductPrerequisites(product as ProductInterface, decisionMet).isMet
      ).toBe(true);
      expect(
        checkProductPrerequisites(
          product as ProductInterface,
          decisionNotMet
        ).isMet
      ).toBe(false);
    });

    it("should handle < operator correctly", () => {
      const product = createMockProduct([
        {
          level: "product",
          targetId: targetProductId,
          fieldKey: "productLevel",
          operator: "<",
          value: 5,
        },
      ]);

      const decisionMet = createMockDecision([
        {
          productId: targetProductId,
          segmentId: new mongoose.Types.ObjectId(),
          fields: [{ key: "productLevel", value: 3 }],
        },
      ]);

      const decisionNotMet = createMockDecision([
        {
          productId: targetProductId,
          segmentId: new mongoose.Types.ObjectId(),
          fields: [{ key: "productLevel", value: 5 }],
        },
      ]);

      expect(
        checkProductPrerequisites(product as ProductInterface, decisionMet).isMet
      ).toBe(true);
      expect(
        checkProductPrerequisites(
          product as ProductInterface,
          decisionNotMet
        ).isMet
      ).toBe(false);
    });

    it("should handle != operator correctly", () => {
      const product = createMockProduct([
        {
          level: "product",
          targetId: targetProductId,
          fieldKey: "productLevel",
          operator: "!=",
          value: 5,
        },
      ]);

      const decisionMet = createMockDecision([
        {
          productId: targetProductId,
          segmentId: new mongoose.Types.ObjectId(),
          fields: [{ key: "productLevel", value: 3 }],
        },
      ]);

      const decisionNotMet = createMockDecision([
        {
          productId: targetProductId,
          segmentId: new mongoose.Types.ObjectId(),
          fields: [{ key: "productLevel", value: 5 }],
        },
      ]);

      expect(
        checkProductPrerequisites(product as ProductInterface, decisionMet).isMet
      ).toBe(true);
      expect(
        checkProductPrerequisites(
          product as ProductInterface,
          decisionNotMet
        ).isMet
      ).toBe(false);
    });

    it("should handle >= operator correctly (boundary case)", () => {
      const product = createMockProduct([
        {
          level: "product",
          targetId: targetProductId,
          fieldKey: "productLevel",
          operator: ">=",
          value: 5,
        },
      ]);

      const decisionBoundary = createMockDecision([
        {
          productId: targetProductId,
          segmentId: new mongoose.Types.ObjectId(),
          fields: [{ key: "productLevel", value: 5 }],
        },
      ]);

      expect(
        checkProductPrerequisites(
          product as ProductInterface,
          decisionBoundary
        ).isMet
      ).toBe(true);
    });

    it("should handle <= operator correctly (boundary case)", () => {
      const product = createMockProduct([
        {
          level: "product",
          targetId: targetProductId,
          fieldKey: "productLevel",
          operator: "<=",
          value: 5,
        },
      ]);

      const decisionBoundary = createMockDecision([
        {
          productId: targetProductId,
          segmentId: new mongoose.Types.ObjectId(),
          fields: [{ key: "productLevel", value: 5 }],
        },
      ]);

      expect(
        checkProductPrerequisites(
          product as ProductInterface,
          decisionBoundary
        ).isMet
      ).toBe(true);
    });
  });

  describe("Multiple prerequisites", () => {
    it("should return isMet: true when all prerequisites are met", () => {
      const targetProductId = new mongoose.Types.ObjectId();
      const targetSegmentId = new mongoose.Types.ObjectId();
      const product = createMockProduct([
        {
          level: "product",
          targetId: targetProductId,
          fieldKey: "productLevel",
          operator: ">=",
          value: 5,
        },
        {
          level: "segment",
          targetId: targetSegmentId,
          fieldKey: "marketingSpend",
          operator: "<=",
          value: 1000,
        },
      ]);

      const decision = createMockDecision(
        [
          {
            productId: targetProductId,
            segmentId: new mongoose.Types.ObjectId(),
            fields: [{ key: "productLevel", value: 7 }],
          },
        ],
        [
          {
            segmentId: targetSegmentId,
            fields: [{ key: "marketingSpend", value: 800 }],
          },
        ]
      );

      const result = checkProductPrerequisites(
        product as ProductInterface,
        decision
      );

      expect(result.isMet).toBe(true);
      expect(result.unmetRequirements).toEqual([]);
    });

    it("should return isMet: false when some prerequisites are not met", () => {
      const targetProductId = new mongoose.Types.ObjectId();
      const targetSegmentId = new mongoose.Types.ObjectId();
      const product = createMockProduct([
        {
          level: "product",
          targetId: targetProductId,
          fieldKey: "productLevel",
          operator: ">=",
          value: 5,
        },
        {
          level: "segment",
          targetId: targetSegmentId,
          fieldKey: "marketingSpend",
          operator: "<=",
          value: 1000,
        },
      ]);

      const decision = createMockDecision(
        [
          {
            productId: targetProductId,
            segmentId: new mongoose.Types.ObjectId(),
            fields: [{ key: "productLevel", value: 7 }], // Met
          },
        ],
        [
          {
            segmentId: targetSegmentId,
            fields: [{ key: "marketingSpend", value: 1500 }], // Not met
          },
        ]
      );

      const result = checkProductPrerequisites(
        product as ProductInterface,
        decision
      );

      expect(result.isMet).toBe(false);
      expect(result.unmetRequirements).toHaveLength(1);
      expect(result.unmetRequirements[0].prerequisite.fieldKey).toBe(
        "marketingSpend"
      );
    });

    it("should return isMet: false when no prerequisites are met", () => {
      const targetProductId = new mongoose.Types.ObjectId();
      const targetSegmentId = new mongoose.Types.ObjectId();
      const product = createMockProduct([
        {
          level: "product",
          targetId: targetProductId,
          fieldKey: "productLevel",
          operator: ">=",
          value: 5,
        },
        {
          level: "segment",
          targetId: targetSegmentId,
          fieldKey: "marketingSpend",
          operator: "<=",
          value: 1000,
        },
      ]);

      const decision = createMockDecision(
        [
          {
            productId: targetProductId,
            segmentId: new mongoose.Types.ObjectId(),
            fields: [{ key: "productLevel", value: 3 }], // Not met
          },
        ],
        [
          {
            segmentId: targetSegmentId,
            fields: [{ key: "marketingSpend", value: 1500 }], // Not met
          },
        ]
      );

      const result = checkProductPrerequisites(
        product as ProductInterface,
        decision
      );

      expect(result.isMet).toBe(false);
      expect(result.unmetRequirements).toHaveLength(2);
    });
  });

  describe("Edge cases", () => {
    it("should include targetName in reason when provided", () => {
      const targetProductId = new mongoose.Types.ObjectId();
      const product = createMockProduct([
        {
          level: "product",
          targetId: targetProductId,
          targetName: "Premium Product",
          fieldKey: "productLevel",
          operator: ">=",
          value: 5,
        },
      ]);

      const decision = createMockDecision([
        {
          productId: targetProductId,
          segmentId: new mongoose.Types.ObjectId(),
          fields: [{ key: "productLevel", value: 3 }],
        },
      ]);

      const result = checkProductPrerequisites(
        product as ProductInterface,
        decision
      );

      expect(result.unmetRequirements[0].reason).toContain("Premium Product");
    });

    it("should handle zero values correctly", () => {
      const targetProductId = new mongoose.Types.ObjectId();
      const product = createMockProduct([
        {
          level: "product",
          targetId: targetProductId,
          fieldKey: "productLevel",
          operator: ">=",
          value: 0,
        },
      ]);

      const decision = createMockDecision([
        {
          productId: targetProductId,
          segmentId: new mongoose.Types.ObjectId(),
          fields: [{ key: "productLevel", value: 0 }],
        },
      ]);

      const result = checkProductPrerequisites(
        product as ProductInterface,
        decision
      );

      expect(result.isMet).toBe(true);
    });

    it("should handle negative values correctly", () => {
      const targetProductId = new mongoose.Types.ObjectId();
      const product = createMockProduct([
        {
          level: "product",
          targetId: targetProductId,
          fieldKey: "productLevel",
          operator: ">=",
          value: -5,
        },
      ]);

      const decision = createMockDecision([
        {
          productId: targetProductId,
          segmentId: new mongoose.Types.ObjectId(),
          fields: [{ key: "productLevel", value: -3 }],
        },
      ]);

      const result = checkProductPrerequisites(
        product as ProductInterface,
        decision
      );

      expect(result.isMet).toBe(true);
    });

    it("should handle large numbers correctly", () => {
      const targetProductId = new mongoose.Types.ObjectId();
      const product = createMockProduct([
        {
          level: "product",
          targetId: targetProductId,
          fieldKey: "productLevel",
          operator: ">=",
          value: 1000000,
        },
      ]);

      const decision = createMockDecision([
        {
          productId: targetProductId,
          segmentId: new mongoose.Types.ObjectId(),
          fields: [{ key: "productLevel", value: 2000000 }],
        },
      ]);

      const result = checkProductPrerequisites(
        product as ProductInterface,
        decision
      );

      expect(result.isMet).toBe(true);
    });
  });
});

