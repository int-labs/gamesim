const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  // Parked suites: the specification of a model that is not wired up yet, kept
  // for when it is rebuilt. See src/sim/calcMarketModel.legacy.ts.
  testPathIgnorePatterns: ["/node_modules/", "\\.legacy\\.test\\.ts$"],
  transform: {
    ...tsJestTransformCfg,
  },
};