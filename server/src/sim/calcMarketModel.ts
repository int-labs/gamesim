// Market-model SHAPES only — the operator authors these on `BaseData`, so the
// types stay live even though nothing computes with them right now.
//
// THE FUNCTION IS GONE. Market share is the normalised `productScore` across
// the teams that chose a product, computed in services/roundCalculation.ts.
// See ../../README.md#market-share.
//
// The previous implementation derived a second VoC from `direction` — which is
// what `productScore` already does — and then multiplied by
// `projected_market_share / (1 / n)`, i.e. pms × n against a pms clamped
// 0..100. Any pms >= 1 drove every team past 1.0 and the clamp pinned them ALL
// at 100%: two teams competing for one product each read a full market, and the
// shares summed to n instead of 1.
//
// It is parked, not deleted, in sim/calcMarketModel.legacy.ts (untracked and
// excluded from the build) together with its 16-test suite, which is the
// specification of what the coefficients-and-drivers model is meant to become.

import mongoose from "mongoose";

/** One scored field on the market model. `direction` and `tightening` are what
 *  the parked implementation competed teams on; `coefficients` is what the
 *  intended drivers-based version will use. */
export interface MarketModelField {
  key:          string;
  label:        string;
  formula?:     string;
  type?:        string;
  level?:       "global" | "segment" | "product" | "subproduct" | "dynamic";
  direction:    number;
  tightening:   number;
  elasticity?:  number;
  coefficients: Record<string, number>;
}

export interface MarketModelProduct {
  productId:     mongoose.Types.ObjectId;
  fields:        MarketModelField[];
  segmentFields: MarketModelField[];
  globalFields:  MarketModelField[];
}

export interface MarketModelSegment {
  segmentId: mongoose.Types.ObjectId;
  products:  MarketModelProduct[];
}

export interface DecisionField {
  fieldId: mongoose.Types.ObjectId;
  value:   number | string | null;
}

export interface DecisionProductInput {
  productId: mongoose.Types.ObjectId;
  fields:    DecisionField[];
}

export interface DecisionDocument {
  teamId: mongoose.Types.ObjectId;
  inputs: DecisionProductInput[];
}

/** A team's share of one product's market. Values across the teams that chose
 *  that product SUM TO 1. */
export interface TeamShare {
  teamId: mongoose.Types.ObjectId;
  value:  number;
}
