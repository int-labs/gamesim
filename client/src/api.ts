import axios from "axios";
import type {
  DebriefChartConfig, DebriefChartStyle, DebriefDimensions, RoundDebrief, RoundNote,
} from "./types";

const api = axios.create({
  baseURL: (import.meta as any).env?.VITE_GAMESIM_API_URL ?? "http://localhost:5000/api",
  withCredentials: true,
});

export const setAuthToken = (token: string) => {
  api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
};

// TEMPORARY: dev-only admin token, emulates ROLES.ADMIN for testing.
// authentication.ts does no DB lookup, so this works even with zero
// users in the database. Remove once real login is wired in — see
// the matching TODO(auth) comments on the locked-down routers.
// Reissued 2026-10-27, expires 2027-10-27. `authenticate` 403s on ANY verify
// failure, expiry included — so a blanket 403 across every route means this is
// stale, not a permissions problem. Resign with the server's JWT_SECRET.
const DEV_ADMIN_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3OTMwNzE4MDQsImV4cCI6MTgyNDYwNzgwNH0.7mSs0dyq5rZwheofF1tjTuUB718sLDcdkv1LGEF2MV4";

api.defaults.headers.common["Authorization"] = `Bearer ${DEV_ADMIN_TOKEN}`;

// ── Image Assets ──────────────────────────────────────────────
export const getImageAssets = () => api.get("/image-assets");
export const getImageAssetById = (image_id: string) => api.get(`/image-assets/${image_id}`);
export const uploadImageAsset = (formData: FormData) =>
  api.post("/image-assets", formData, { headers: { "Content-Type": "multipart/form-data" } });
export const deleteImageAsset = (image_id: string) => api.delete(`/image-assets/${image_id}`);
/**
 * Which storage driver is actually live, verified against Supabase rather than
 * inferred from env vars. When `durable` is false, uploads land on the API's
 * local disk and are lost on the next redeploy — so the URLs written into
 * PlayerConfig would be dead. Call this BEFORE an upload session.
 */
export const getStorageStatus = () =>
  api.get<{ driver: "supabase" | "local"; durable: boolean; message: string }>(
    "/image-assets/storage",
  );
/**
 * Buckets an upload may target. There is NO default — the operator must choose,
 * because storage is partitioned by simulation type and no bucket is right to
 * guess. `buckets` is EMPTY on the local driver, where buckets do not apply.
 */
export const getStorageBuckets = () =>
  api.get<{ buckets: { name: string; public: boolean }[] }>("/image-assets/buckets");

// ── Simulations ───────────────────────────────────────────────
export const getSimulations = () => api.get("/simulations");
export const getSimulationById = (id: string) => api.get(`/simulations/${id}`);
export const createSimulation = (data: object) => api.post("/simulations", data);
export const deleteSimulation = (id: string) => api.delete(`/simulations/${id}`);
export const updateSimulation = (id: string, data: object) => api.patch(`/simulations/${id}`, data);

// ── Simulation Types ──────────────────────────────────────────
export const getSimulationTypes = () => api.get("/simulation-types");
export const getSimulationTypeById = (id: string) => api.get(`/simulation-types/${id}`);
export const createSimulationType = (data: object) => api.post("/simulation-types", data);
export const deleteSimulationType = (id: string) => api.delete(`/simulation-types/${id}`);

// ── Rounds ────────────────────────────────────────────────────
export const getRounds = (simulationId?: string) =>
  api.get("/rounds", { params: simulationId ? { simulationId } : {} });
export const getRoundById = (id: string) => api.get(`/rounds/${id}`);
export const createRound = (data: object) => api.post("/rounds", data);
export const patchRound = (id: string, data: object) => api.patch(`/rounds/${id}/status`, data);
export const deleteRound = (id: string) => api.delete(`/rounds/${id}`);
/** Mid-round dry run: calculates but leaves the round Active, so the figures
 *  stay overwritable. Prefer `endRound`. */
export const calculateRound = (roundId: string) => api.post(`/rounds/${roundId}/calculate`);

/** The operator's normal action: calculate + Complete + advance, atomically.
 *  Completing is what freezes the round. */
export const endRound = (roundId: string, opts?: { skipCalculation?: boolean }) =>
  api.post(`/rounds/${roundId}/end`, opts ?? {});
export const deleteDecisionsByRound = (simulationId: string, roundNumber: number) =>
  api.delete("/decisions", { params: { simulationId, roundNumber } });

export const deleteResultsByRound = (simulationId: string, roundNumber: number) =>
  api.delete("/results", { params: { simulationId, roundNumber } });

/** Part of a round RESET — see RoundsPage.handleReset. */
export const deleteProjectionsByRound = (simulationId: string, roundNumber: number) =>
  api.delete("/projections", { params: { simulationId, roundNumber } });

// ── Teams ─────────────────────────────────────────────────────
export const getTeams = (simulationId?: string) =>
  api.get("/teams", { params: simulationId ? { simulationId } : {} });
export const getTeamById = (id: string) => api.get(`/teams/${id}`);
export const createTeam = (data: object) => api.post("/teams", data);
export const deleteTeam = (id: string) => api.delete(`/teams/${id}`);

// ── Users ─────────────────────────────────────────────────────
export const getUsers = () => api.get("/users");
export const getUserById = (id: string) => api.get(`/users/${id}`);
export const createUser = (data: object) => api.post("/users", data);
export const deleteUser = (id: string) => api.delete(`/users/${id}`);
export const regeneratePasskey = (id: string) => api.post(`/users/${id}/regenerate-passkey`);
export const loginWithPasskey = (passkey: string) => api.post("/users/login-passkey", { passkey });

// ── Segments ──────────────────────────────────────────────────
export const getSegments = (simulationTypeId?: string) =>
  api.get("/segments", { params: simulationTypeId ? { simulationTypeId } : {} });
export const getSegmentById = (id: string) => api.get(`/segments/${id}`);
export const createSegment = (data: object) => api.post("/segments", data);
export const deleteSegment = (id: string) => api.delete(`/segments/${id}`);
export const activateSegment = (id: string) => api.patch(`/segments/${id}/activate`);
export const deactivateSegment = (id: string) => api.patch(`/segments/${id}/deactivate`);
export const updateSegment = (id: string, data: object) => api.patch(`/segments/${id}`, data);

// ── Products ──────────────────────────────────────────────────
export const getProducts = (simulationTypeId?: string, segmentId?: string) =>
  api.get("/products", { params: { ...(simulationTypeId ? { simulationTypeId } : {}), ...(segmentId ? { segmentId } : {}) } });
export const getProductById = (id: string) => api.get(`/products/${id}`);
export const createProduct = (data: object) => api.post("/products", data);
export const deleteProduct = (id: string) => api.delete(`/products/${id}`);

// ── Product Fields ──────────────────────────────────────────────────
export const createProductField = (productId: string, data: object) => api.post(`/products/${productId}/fields`, data);
export const getProductFields = (productId: string) => api.get(`/products/${productId}/fields`);
export const updateProductField = (productId: string, fieldId: string, data: object) => api.patch(`/products/${productId}/fields/${fieldId}`, data);
export const deleteProductField = (productId: string, fieldId: string) => api.delete(`/products/${productId}/fields/${fieldId}`);

// ── Drivers ───────────────────────────────────────────────────
export const getDrivers = (productId?: string) =>
  api.get("/drivers", { params: { ...(productId ? { productId } : {}) } });
export const getDriverById = (id: string) => api.get(`/drivers/${id}`);
export const createDriver = (data: object) => api.post("/drivers", data);
export const deleteDriver = (id: string) => api.delete(`/drivers/${id}`);

// ── Initiatives ───────────────────────────────────────────────
export const getInitiatives = () => api.get("/initiatives");
export const getInitiativeById = (id: string) => api.get(`/initiatives/${id}`);
export const createInitiative = (data: object) => api.post("/initiatives", data);
export const deleteInitiative = (id: string) => api.delete(`/initiatives/${id}`);

// ── Decisions ─────────────────────────────────────────────────
export const getDecisions = (simulationId?: string, teamId?: string, roundNumber?: number) =>
  api.get("/decisions", {
    params: {
      ...(simulationId ? { simulationId } : {}),
      ...(teamId ? { teamId } : {}),
      ...(roundNumber !== undefined ? { roundNumber } : {}),
    },
  });
export const getDecisionById = (id: string) => api.get(`/decisions/${id}`);
export const createDecision = (data: object) => api.post("/decisions", data);
export const deleteDecision = (id: string) => api.delete(`/decisions/${id}`);

// ── Param List ────────────────────────────────────────────────
export const getParamLists = (segmentId?: string, productId?: string) =>
  api.get("/param-list", { params: { ...(segmentId ? { segmentId } : {}), ...(productId ? { productId } : {}) } });
export const getParamListById = (id: string) => api.get(`/param-list/${id}`);
export const createParamList = (data: object) => api.post("/param-list", data);
export const deleteParamList = (id: string) => api.delete(`/param-list/${id}`);

// ── Projections ───────────────────────────────────────────────
export const getProjections = (simulationId?: string, teamId?: string, roundNumber?: number) =>
  api.get("/projections", {
    params: {
      ...(simulationId ? { simulationId } : {}),
      ...(teamId ? { teamId } : {}),
      ...(roundNumber !== undefined ? { roundNumber } : {}),
    },
  });
export const getProjectionById = (id: string) => api.get(`/projections/${id}`);
export const deleteProjection = (id: string) => api.delete(`/projections/${id}`);

// ── Results ───────────────────────────────────────────────────
export const getResults = (simulationId?: string, roundNumber?: number, productId?: string, segmentId?: string) =>
  api.get("/results", {
    params: {
      ...(simulationId ? { simulationId } : {}),
      ...(roundNumber !== undefined ? { roundNumber } : {}),
      ...(productId ? { productId } : {}),
      ...(segmentId ? { segmentId } : {}),
    },
  });

// ── Base Data ─────────────────────────────────────────────────
export const getBaseData = (simulationTypeId?: string) =>
  api.get("/base-data", { params: simulationTypeId ? { simulationTypeId } : {} });
export const getBaseDataById = (id: string) => api.get(`/base-data/${id}`);

export const createBaseData = (data: object) => api.post("/base-data", data);

// ── Global Inputs ─────────────────────────────────────────────────
export const getGlobalInputs = (simulationTypeId?: string, category?: string) =>
  api.get("/global-inputs", { params: { ...(simulationTypeId ? { simulationTypeId } : {}), ...(category ? { category } : {}) } });
export const getGlobalInputById = (id: string) => api.get(`/global-inputs/${id}`);
export const createGlobalInput = (data: object) => api.post("/global-inputs", data);
export const updateGlobalInput = (id: string, data: object) => api.patch(`/global-inputs/${id}`, data);
export const deleteGlobalInput = (id: string) => api.delete(`/global-inputs/${id}`);

export const createGlobalInputItem = (id: string, data: object) => api.post(`/global-inputs/${id}/items`, data);
export const getGlobalInputItems = (id: string) => api.get(`/global-inputs/${id}/items`);
export const updateGlobalInputItem = (id: string, itemId: string, data: object) => api.patch(`/global-inputs/${id}/items/${itemId}`, data);
export const deleteGlobalInputItem = (id: string, itemId: string) => api.delete(`/global-inputs/${id}/items/${itemId}`);


// ── Player Config ─────────────────────────────────────────────
export const getPlayerConfig = (simulationTypeId: string) =>
  api.get(`/player-config/${simulationTypeId}`);
export const createPlayerConfig = (data: object) => api.post("/player-config", data);
export const updatePlayerConfig = (id: string, data: object) => api.patch(`/player-config/${id}`, data);
export const deletePlayerConfig = (id: string) => api.delete(`/player-config/${id}`);

// ── Leaderboard Config ────────────────────────────────────────
/** Scores the competitor report's leaderboard. One document per simulationType;
 *  weights must sum to 100 — the server refuses the save otherwise. */
export const getLeaderboardConfig = (simulationTypeId: string) =>
  api.get(`/leaderboard-config/${simulationTypeId}`);
/** UPSERT — REPLACES the whole metric set. Right when the page holds the truth
 *  (it just loaded); wrong for a partial edit, which would drop everything the
 *  caller did not send. */
export const putLeaderboardConfig = (simulationTypeId: string, metrics: object[]) =>
  api.put(`/leaderboard-config/${simulationTypeId}`, { metrics });
/** MERGE BY METRIC KEY — send only what changed. A key that exists is updated
 *  field-by-field, a new one is appended, `removeKeys` deletes. 404s when no
 *  config exists yet: PUT creates, PATCH edits. */
export const patchLeaderboardConfig = (
  simulationTypeId: string,
  body: { metrics?: object[]; removeKeys?: string[] },
) => api.patch(`/leaderboard-config/${simulationTypeId}`, body);
/** The allowed `source` values, from the SERVER, so the dropdown cannot drift
 *  from what the scorer accepts. */
export const getLeaderboardSources = () => api.get(`/leaderboard-config/sources`);

// ── Round reports (PDF) ───────────────────────────────────────
/**
 * Download a round report and hand the browser a save dialog.
 *
 * `blob`, not JSON — the endpoint streams a PDF. The failure path matters: on
 * an error the server still replies JSON, but axios has already been told to
 * expect a blob, so the message has to be read back OUT of it or the operator
 * sees a bare "Request failed with status code 400" for something as ordinary
 * as a round nobody has submitted to yet.
 *
 * Returns the filename it saved under, so the caller can say so.
 */
export const downloadRoundReport = async (
  kind: "decisions" | "competitor",
  simulationId: string,
  roundNumber: number,
): Promise<string> => {
  try {
    const res = await api.get(`/reports/${kind}`, {
      params: { simulationId, roundNumber },
      responseType: "blob",
    });

    // The server's own name for the file, exposed via a header a cross-origin
    // fetch is allowed to read. Falls back to something sane if a proxy eats it.
    const name =
      (res.headers as Record<string, string>)["x-report-filename"] ??
      `${kind}_${simulationId}_round${roundNumber}.pdf`;

    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Freed on the next tick, not immediately: revoking before the browser has
    // started the download cancels it in Safari and older Chrome.
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return name;
  } catch (e: any) {
    const blob = e?.response?.data;
    if (blob instanceof Blob) {
      try {
        const parsed = JSON.parse(await blob.text());
        throw new Error(parsed?.message ?? "Failed to build the report.");
      } catch (inner: any) {
        if (inner instanceof Error && inner.message !== "Unexpected end of JSON input") throw inner;
      }
    }
    throw new Error(e?.response?.data?.message ?? e?.message ?? "Failed to build the report.");
  }
};

// ── Projection ─────────────────────────────────────────────────
export const recalcProjections = (data: {
  simulationId:      string;
  simulationTypeId:  string;
  teamId:            string;
  roundNumber:       number;
  productId?:        string;
  focusedProductId?: string;
  fields?:           { fieldId: string; value: any }[];
  globalInputs:      any[];
}) => api.post("/projections/recalc", data);
// ── Round debrief ──────────────────────────────────────────────
/**
 * GET /round-debrief — the chart data behind the player's limbo slide.
 *
 * The operator reads ANY round; a team token is gated to rounds whose status is
 * "Completed". `you` comes back null here, so nothing is highlighted as "your"
 * team — the operator is not one of the columns.
 *
 * NO `simulationTypeId`. A simulation belongs to exactly one type, so this id
 * already determines it and the controller derives it. The type is required for
 * AUTHORING the charts — those belong to the type and are shared by all its
 * simulations — not for reading a round.
 *
 * Distinct from `/reports/:kind`, which streams a PDF. This is JSON the page
 * charts directly.
 */
export const getRoundDebrief = async (
  simulationId: string,
  roundNumber: number,
): Promise<RoundDebrief> => {
  const res = await api.get("/round-debrief", { params: { simulationId, roundNumber } });
  return res.data as RoundDebrief;
};

// ── Round notes ────────────────────────────────────────────────
/**
 * Facilitator notes on a round, chart descriptions among them.
 *
 * ⚠ THESE ARE THE SAME ROWS `/round-debrief` JOINS ONTO ITS CHARTS. The debrief
 * is the read path — it resolves a chart's description and decides whether the
 * player sees that chart at all. This is the WRITE path, and it is the only
 * reason to read notes directly: a description's `_id`, which the debrief
 * payload does not carry.
 *
 * Writes are ROLES.ADMIN/OPERATOR server-side; the player can only ever GET.
 */
export const getRoundNotes = async (
  simulationId: string,
  roundNumber?: number,
): Promise<RoundNote[]> => {
  const res = await api.get("/round-notes", { params: { simulationId, roundNumber } });
  return (Array.isArray(res.data) ? res.data : []) as RoundNote[];
};

/**
 * `title` is required by the model. A chart description never renders it — the
 * chart's label is the heading — so pass that label rather than prompting for
 * one. `chartId` is the chart's `name`, NEVER its `id`: the ordinal is a sort
 * key and renumbering it would re-point the note.
 */
export const createRoundNote = (data: {
  simulationId: string;
  roundNumber:  number;
  title:        string;
  body:         string;
  chartId?:     string | null;
  /** Which instance, for a `scope: "each"` chart. Null = the summary. */
  productId?:   string | null;
  teamId?:      string | null;
  pinned?:      boolean;
}) => api.post("/round-notes", data);

export const updateRoundNote = (
  id: string,
  data: Partial<{ title: string; body: string; chartId: string | null; teamId: string | null; pinned: boolean }>,
) => api.patch(`/round-notes/${id}`, data);

/** Deleting a chart's description UNRESOLVES that chart — the player stops
 *  seeing it entirely, not just its copy. */
export const deleteRoundNote = (id: string) => api.delete(`/round-notes/${id}`);

// ── Debrief chart styles (the global gallery) ──────────────────
/**
 * Every chart shape the app can draw, as data — family, variant, and the
 * Vega-Lite spec the SERVER compiles.
 *
 * ⚠ THE PLAYER NEVER SEES `shape`. `/round-debrief` resolves it to finished SVG
 * and withholds the spec, so there is no interpreter at the far end. It is
 * still sanitised HERE before it is sent — the console is the boundary, the
 * same rule `products.segments` follows. Writes are admin-only.
 */
export const getDebriefChartStyles = async (): Promise<DebriefChartStyle[]> => {
  const res = await api.get("/debrief-chart-styles");
  return (Array.isArray(res.data) ? res.data : []) as DebriefChartStyle[];
};

export const createDebriefChartStyle = (data: {
  name: string; category?: string; shape?: string;
}) => api.post("/debrief-chart-styles", data);

export const updateDebriefChartStyle = (
  id: string,
  data: Partial<{ name: string; category: string; shape: string }>,
) => api.patch(`/debrief-chart-styles/${id}`, data);

/** 409s while any configured chart still points at it — deliberately, so a
 *  delete cannot silently leave charts that render nothing. */
export const deleteDebriefChartStyle = (id: string) =>
  api.delete(`/debrief-chart-styles/${id}`);

// ── Debrief dimensions ─────────────────────────────────────────
/**
 * What a chart may plot for this simulation type — what the X / Y / grouping
 * selects read. Derived server-side from the type's Products and GlobalInputs,
 * so there is nothing to write.
 */
export const getDebriefDimensions = async (
  simulationTypeId: string,
): Promise<DebriefDimensions> => {
  const res = await api.get("/debrief-dimensions", { params: { simulationTypeId } });
  return (res.data ?? { categorical: [], measures: [], clientCharts: [] }) as DebriefDimensions;
};

// ── Debrief charts (per simulation type) ───────────────────────
/**
 * Which charts a simulation type's debrief shows. One type, one set, shared by
 * every simulation under it.
 *
 * The axes are nullable and a half-configured chart saves and renders as-is —
 * the only thing that hides a chart from a team is a missing description.
 */
export const getDebriefCharts = async (
  simulationTypeId: string,
): Promise<DebriefChartConfig[]> => {
  const res = await api.get("/debrief-charts", { params: { simulationTypeId } });
  return (Array.isArray(res.data) ? res.data : []) as DebriefChartConfig[];
};

export const createDebriefChart = (data: {
  simulationTypeId: string;
  name:        string;
  category?:   string;
  order?:      number;
  scope?:      "overall" | "each";
  chartStyle?: string | null;
  xAxis?:      string | null;
  yAxis?:      string[] | null;
  grouping?:   string | null;
}) => api.post("/debrief-charts", data);

/**
 * Render a DRAFT binding against a real round, before saving.
 *
 * Writes nothing. Deliberately takes a real simulation and round rather than
 * sample data — "does this chart work" means "is it readable with this sim's
 * numbers", which samples cannot answer.
 */
export const previewDebriefChart = async (data: {
  chartStyle:   string;
  /** Drawn as the chart's title — the preview has no panel heading. */
  name?:        string | null;
  simulationId: string;
  roundNumber:  number;
  xAxis?:       string | null;
  yAxis?:       string[] | null;
  grouping?:    string | null;
  /** `each` previews ONE PER NOTEBOOK, which is exactly what the slide will
   *  emit. There is no summary instance — a summary is its own `overall` row. */
  scope?:       "overall" | "each";
}): Promise<{ instances: PreviewInstance[] }> => {
  const res = await api.post("/debrief-charts/preview", data);
  return res.data as { instances: PreviewInstance[] };
};

export interface PreviewInstance {
  /** null = an `overall` chart, which reads every notebook at once. */
  productId:   string | null;
  productName: string | null;
  svg:         string;
  rows:        number;
}

export const updateDebriefChart = (
  id: string,
  data: Partial<{
    name: string; category: string; order: number; scope: "overall" | "each";
    chartStyle: string | null; clientChart: string | null;
    xAxis: string | null; yAxis: string[]; grouping: string | null;
  }>,
) => api.patch(`/debrief-charts/${id}`, data);

/** ⚠ DELETES ITS DESCRIPTIONS TOO, across every round — they are keyed to this
 *  `_id` and a recreated chart gets a new one, so they could never be
 *  reattached. The response reports how many went. */
export const deleteDebriefChart = (id: string) => api.delete(`/debrief-charts/${id}`);
