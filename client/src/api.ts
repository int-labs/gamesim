import axios from "axios";

/** The shared axios instance. Exported so `lib/auth.ts` can set and clear the
 *  Authorization header on the same instance every call below already uses. */
export const api = axios.create({
  baseURL: (import.meta as any).env?.VITE_GAMESIM_API_URL ?? "http://localhost:5000/api",
  withCredentials: true,
});

export const setAuthToken = (token: string) => {
  api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
};

const TOKEN_KEY = "gamesim:console:token";

// Restore the session before the first request goes out. `lib/auth.ts` owns
// this key and the login/logout flow; reading it here keeps the very first
// render from firing an unauthenticated burst of queries on a hard reload.
const stored = localStorage.getItem(TOKEN_KEY);
if (stored) api.defaults.headers.common["Authorization"] = `Bearer ${stored}`;

/**
 * A rejected token ends the session exactly once.
 *
 * `authenticate` answers 401 with no token and 403 with an unverifiable one,
 * so both mean "sign in again". Everything else — a 403 from `authorize`
 * because an operator touched an admin-only route — is a real answer the page
 * should surface, not a reason to log anyone out. Those carry a body, which is
 * how they're told apart here.
 */
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const message: string = error?.response?.data?.message ?? "";
    const sessionDead =
      status === 401 || (status === 403 && /^forbidden\.?$/i.test(message));

    if (sessionDead && localStorage.getItem(TOKEN_KEY)) {
      localStorage.removeItem(TOKEN_KEY);
      delete api.defaults.headers.common["Authorization"];
      // A full reload is deliberate: it drops every cached query and any
      // half-rendered page built from data this session may no longer read.
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

// ── Image Assets ──────────────────────────────────────────────
export const getImageAssets = () => api.get("/image-assets");
export const getImageAssetById = (image_id: string) => api.get(`/image-assets/${image_id}`);
export const uploadImageAsset = (formData: FormData) =>
  api.post("/image-assets", formData, { headers: { "Content-Type": "multipart/form-data" } });
export const deleteImageAsset = (image_id: string) => api.delete(`/image-assets/${image_id}`);
export const getStorageStatus = () => api.get("/image-assets/storage");

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
export const calculateRound = (roundId: string) => api.post(`/rounds/${roundId}/calculate`);
/** Atomic close + calculate + advance. The normal way to finish a round. */
export const endRound = (roundId: string, body: { skipCalculation?: boolean } = {}) =>
  api.post(`/rounds/${roundId}/end`, body);
export const deleteDecisionsByRound = (simulationId: string, roundNumber: number) =>
  api.delete("/decisions", { params: { simulationId, roundNumber } });

export const deleteResultsByRound = (simulationId: string, roundNumber: number) =>
  api.delete("/results", { params: { simulationId, roundNumber } });

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
// Update endpoints the console needs for editing (the controllers existed;
// several were simply never called from here).
export const updateProduct = (id: string, data: object) => api.patch(`/products/${id}`, data);
export const updateSimulationType = (id: string, data: object) => api.patch(`/simulation-types/${id}`, data);
export const updateTeam = (id: string, data: object) => api.patch(`/teams/${id}`, data);


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
export const updateDriver = (id: string, data: object) => api.patch(`/drivers/${id}`, data);
export const deleteDriver = (id: string) => api.delete(`/drivers/${id}`);

// ── Initiatives ───────────────────────────────────────────────
export const getInitiatives = () => api.get("/initiatives");
export const getInitiativeById = (id: string) => api.get(`/initiatives/${id}`);
export const createInitiative = (data: object) => api.post("/initiatives", data);
export const updateInitiative = (id: string, data: object) => api.patch(`/initiatives/${id}`, data);
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
/** Section-scoped and validated, with the calculated-round guard. */
export const patchBaseDataSection = (
  id: string,
  section: string,
  value: unknown,
  force = false
) =>
  api.patch(`/base-data/${id}/section/${section}${force ? "?force=true" : ""}`, value);

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


// ── Team roster & avatars ──────────────────────────────────────
export const getTeamMembers = (teamId: string) => api.get(`/teams/${teamId}/members`);
export const putTeamMembers = (teamId: string, members: unknown[]) =>
  api.put(`/teams/${teamId}/members`, members);
export const putTeamAvatar = (teamId: string, avatar: unknown) =>
  api.put(`/teams/${teamId}/avatar`, avatar);
export const getAvatarStyles = () => api.get("/avatars/styles");
export const previewAvatar = (style: string, seed: string) =>
  api.post("/avatars/preview", { style, seed });
export const createDiceBearAvatar = (style: string, seed: string, label?: string) =>
  api.post("/avatars/dicebear", { style, seed, label });

// ── Round notes ────────────────────────────────────────────────
/** Live per-team progress while a round is open. Staff only. */
export const getTeamProgress = (simulationId: string, roundNumber?: number) =>
  api.get("/team-progress", { params: { simulationId, ...(roundNumber != null ? { roundNumber } : {}) } });

export const getRoundNotes = (simulationId: string, roundNumber?: number) =>
  api.get("/round-notes", {
    params: { simulationId, ...(roundNumber !== undefined ? { roundNumber } : {}) },
  });
export const createRoundNote = (data: object) => api.post("/round-notes", data);
export const updateRoundNote = (id: string, data: object) => api.patch(`/round-notes/${id}`, data);
export const deleteRoundNote = (id: string) => api.delete(`/round-notes/${id}`);

// ── Debrief ────────────────────────────────────────────────────
export const getDebrief = (simulationId: string) =>
  api.get("/debriefs", { params: { simulationId } });
export const putDebrief = (simulationId: string, data: object) =>
  api.put("/debriefs", data, { params: { simulationId } });
export const publishDebrief = (simulationId: string) =>
  api.post("/debriefs/publish", {}, { params: { simulationId } });
export const unpublishDebrief = (simulationId: string) =>
  api.post("/debriefs/unpublish", {}, { params: { simulationId } });

// ── Player Config ──────────────────────────────────────────────
// The operator-editable catalog behind the notebook player. The console edits
// the draft; `getPlayerConfig` without `draft` returns the published snapshot
// (what players actually read).
export const getPlayerConfig = (simulationTypeId: string, draft = false) =>
  api.get(`/player-config/${simulationTypeId}${draft ? "?draft=true" : ""}`);
export const putPlayerConfig = (simulationTypeId: string, data: object) =>
  api.put(`/player-config/${simulationTypeId}`, data);
export const patchPlayerConfigSection = (
  simulationTypeId: string,
  section: string,
  value: unknown
) => api.patch(`/player-config/${simulationTypeId}/section/${section}`, value);
export const publishPlayerConfig = (simulationTypeId: string, note?: string) =>
  api.post(`/player-config/${simulationTypeId}/publish`, { note });
export const revertPlayerConfig = (simulationTypeId: string) =>
  api.post(`/player-config/${simulationTypeId}/revert`);

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