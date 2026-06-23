import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  withCredentials: true,
});

// TEMPORARY: dev-only admin token, emulates ROLES.ADMIN for testing.
// authentication.ts does no DB lookup, so this works even with zero
// users in the database. Remove once real login is wired in — see
// the matching TODO(auth) comments on the locked-down routers.
const DEV_ADMIN_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3ODIwOTg4MjEsImV4cCI6MTc4NDY5MDgyMX0.otmIbMwqH-P7CIhblxw8zgKVq_itqLxJTRGGdTC2E9E";

api.defaults.headers.common["Authorization"] = `Bearer ${DEV_ADMIN_TOKEN}`;

// ── Image Assets ──────────────────────────────────────────────
export const getImageAssets = () => api.get("/image-assets");
export const getImageAssetById = (image_id: string) => api.get(`/image-assets/${image_id}`);
export const uploadImageAsset = (formData: FormData) =>
  api.post("/image-assets", formData, { headers: { "Content-Type": "multipart/form-data" } });
export const deleteImageAsset = (image_id: string) => api.delete(`/image-assets/${image_id}`);

// ── Simulations ───────────────────────────────────────────────
export const getSimulations = () => api.get("/simulations");
export const getSimulationById = (id: string) => api.get(`/simulations/${id}`);
export const createSimulation = (data: object) => api.post("/simulations", data);
export const deleteSimulation = (id: string) => api.delete(`/simulations/${id}`);

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
export const patchRound = (id: string, data: object) => api.patch(`/rounds/${id}`, data);
export const deleteRound = (id: string) => api.delete(`/rounds/${id}`);

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

// ── Segments ──────────────────────────────────────────────────
export const getSegments = (simulationTypeId?: string) =>
  api.get("/segments", { params: simulationTypeId ? { simulationTypeId } : {} });
export const getSegmentById = (id: string) => api.get(`/segments/${id}`);
export const createSegment = (data: object) => api.post("/segments", data);
export const deleteSegment = (id: string) => api.delete(`/segments/${id}`);
export const activateSegment = (id: string) => api.patch(`/segments/${id}/activate`);
export const deactivateSegment = (id: string) => api.patch(`/segments/${id}/deactivate`);

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
