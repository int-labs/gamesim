import { Types } from "mongoose";
import BaseData, { BaseDataInterface } from "../models/baseData";
import GlobalInput, { IGlobalInput } from "../models/globalInputs";
import Product, { ProductInterface } from "../models/products";
import Result, { ResultInterface } from "../models/results";
import Segment, { SegmentInterface } from "../models/segments";
import Team from "../models/teams";

// Unified TTLs (ms)
const STATIC_CACHE_TTL = 5 * 60 * 1000;  // 5 min — base data, products, segments, global inputs
const DYNAMIC_CACHE_TTL = 60_000;          // 1 min — team count, prev round result (already existed)

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const baseDataCache = new Map<string, CacheEntry<BaseDataInterface | null>>();
const productsCache = new Map<string, CacheEntry<ProductInterface[]>>();
const segmentsCache = new Map<string, CacheEntry<SegmentInterface[]>>();
const teamCountCache = new Map<string, CacheEntry<number>>();
const globalInputsCache = new Map<string, CacheEntry<IGlobalInput[]>>();
const prevRoundResultCache = new Map<string, CacheEntry<ResultInterface | null>>();

// ─── Helpers ────────────────────────────────────────────────────────────────

function isExpired<T>(entry: CacheEntry<T> | undefined, ttl: number): boolean {
  return !entry || Date.now() - entry.fetchedAt >= ttl;
}

// ─── Fetchers ────────────────────────────────────────────────────────────────

export const getOrFetchBaseData = async (simulationTypeId: string) => {
  const cached = baseDataCache.get(simulationTypeId);
  if (!isExpired(cached, STATIC_CACHE_TTL)) return cached!.data;

  const data = await BaseData.findOne({
    simulationTypeId: new Types.ObjectId(simulationTypeId),
  });
  baseDataCache.set(simulationTypeId, { data, fetchedAt: Date.now() });
  return data;
};

export const getOrFetchProducts = async (simulationTypeId: string) => {
  const cached = productsCache.get(simulationTypeId);
  if (!isExpired(cached, STATIC_CACHE_TTL)) return cached!.data;

  try {
    const data = await Product.find({
      simulationTypeId: new Types.ObjectId(simulationTypeId),
    }).lean();
    productsCache.set(simulationTypeId, { data, fetchedAt: Date.now() });
    return data;
  } catch (error) {
    console.error(error);
    return [];
  }
};

export const getOrFetchSegments = async (simulationTypeId: string) => {
  const cached = segmentsCache.get(simulationTypeId);
  if (!isExpired(cached, STATIC_CACHE_TTL)) return cached!.data;

  try {
    const data = await Segment.find({
      simulationTypeId: new Types.ObjectId(simulationTypeId),
    }).lean();
    segmentsCache.set(simulationTypeId, { data, fetchedAt: Date.now() });
    return data;
  } catch (error) {
    console.error(error);
    return [];
  }
};

export const getOrFetchTeamCount = async (simulationId: string) => {
  const cached = teamCountCache.get(simulationId);
  if (!isExpired(cached, DYNAMIC_CACHE_TTL)) return cached!.data;

  const data = await Team.countDocuments({
    simulationId: new Types.ObjectId(simulationId),
  }).lean();
  teamCountCache.set(simulationId, { data, fetchedAt: Date.now() });
  return data;
};

export const getOrFetchGlobalInputs = async (simulationTypeId: string) => {
  const cached = globalInputsCache.get(simulationTypeId);
  if (!isExpired(cached, STATIC_CACHE_TTL)) return cached!.data;

  try {
    const data = await GlobalInput.find({
      simulationTypeId: new Types.ObjectId(simulationTypeId),
    }).lean();
    globalInputsCache.set(simulationTypeId, { data, fetchedAt: Date.now() });
    return data;
  } catch (error) {
    console.error(error);
    return [];
  }
};

export const getPrevRoundResult = async (
  simulationId: string,
  roundNumber: number
) => {
  const key = `${simulationId}+${roundNumber}`;
  const cached = prevRoundResultCache.get(key);
  if (!isExpired(cached, DYNAMIC_CACHE_TTL)) return cached!.data;

  const data = await Result.findOne({ simulationId, roundNumber })
    .sort({ createdAt: -1 })
    .lean();
  prevRoundResultCache.set(key, { data, fetchedAt: Date.now() });
  return data;
};

// ─── Cache Invalidation ──────────────────────────────────────────────────────
// Call these from the relevant update endpoints so stale data is never served.

export const invalidateSimulationTypeCache = (simulationTypeId: string) => {
  baseDataCache.delete(simulationTypeId);
  productsCache.delete(simulationTypeId);
  segmentsCache.delete(simulationTypeId);
  globalInputsCache.delete(simulationTypeId);
};

export const invalidateTeamCountCache = (simulationId: string) => {
  teamCountCache.delete(simulationId);
};

export const invalidatePrevRoundResultCache = (
  simulationId: string,
  roundNumber: number
) => {
  prevRoundResultCache.delete(`${simulationId}+${roundNumber}`);
};