import { Types } from "mongoose";
import { BaseDataInterface } from "../models/baseData";
import { DecisionInterface } from "../models/decisions";
import { EventInterface } from "../models/events";
import { IGlobalInput } from "../models/globalInputs";
import { ProductInterface } from "../models/products";
import { ResultInterface } from "../models/results";
import { RoundInterface } from "../models/rounds";
import { SegmentInterface } from "../models/segments";
import { WinningMetricConfig } from "../models/simulationTypes";

export interface FeedbackReportOptions {
  availableGlobalInputs: IGlobalInput[];
  availableEvents: EventInterface[];
  segments: SegmentInterface[];
  products: ProductInterface[];
  prevRoundDecisions: (DecisionInterface | null)[];
  baseData: BaseDataInterface;
  prevRoundResult?: ResultInterface | null;
  round: RoundInterface;
  download?: boolean;
  winningMetricsConfig?: WinningMetricConfig[];
  currency?: string;
  activeProductIds?: Types.ObjectId[] | null;
}
