import express from "express";

import {
  deleteBaseDataEntry,
  downloadMarketDataCSV,
  downloadMarketModelCSV,
  getBaseDataBySimulationTypeId,
  syncBaseData,
  uploadMarketDataCSV,
  uploadMarketModelCSV,
  upsertBaseData,
  upsertBaseDataEntry,
  upsertBaseDataSatDrivers,
} from "../controllers/baseDataControllers";
import {
  createGlobalInput,
  listGlobalInputs,
  readGlobalInput,
  updateGlobalInput,
  updateGlobalInputOrder,
  updateGlobalInputTranslations,
} from "../controllers/globalInputControllers";
import { updateProductOrder } from "../controllers/productControllers";
import {
  createSegment,
  listSegments,
  readSegment,
  updateSegment,
  updateSegmentFields,
  updateSegmentOrder,
  updateSegmentTranslations,
} from "../controllers/segmentControllers";
import {
  createSimulationType,
  getSimulationTypePastData,
  listSimulationType,
  readSimulationType,
  readSimulationTypeOutputConfigs,
  readSimulationTypeOutputs,
  readSimulationTypeWinningMetrics,
  syncSimulationTypePastYearData,
  updateSimulationType,
  updateSimulationTypeBalanceSheetConfig,
  updateSimulationTypeBizPerfConfig,
  updateSimulationTypeCashflowConfig,
  updateSimulationTypeOutputs,
  updateSimulationTypePastData,
  updateSimulationTypePnLConfig,
  updateSimulationTypeTranslations,
  updateSimulationTypeWinningMetrics,
  updateSimulationTypeConstants,
  upsertSimulationTypeGlobalPastData,
  upsertSimulationTypeOutputPastData,
  upsertSimulationTypeProductPastData,
  upsertSimulationTypeSegmentPastData,
} from "../controllers/simulationTypeControllers";
import { authenticate } from "../utils/middleware/authentication";
import { authorize } from "../utils/middleware/authorization";

import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

const router = express.Router();

router.get("/", listSimulationType);
router.post("/", authenticate, authorize(["admin"]), createSimulationType);
router.get("/:simulationTypeId", readSimulationType);
router.put(
  "/:simulationTypeId",
  authenticate,
  authorize(["admin"]),
  updateSimulationType
);
router.put(
  "/:simulationTypeId/translations",
  authenticate,
  authorize(["admin"]),
  updateSimulationTypeTranslations
);
router.put(
  "/:simulationTypeId/past-data/sync",
  authenticate,
  authorize(["admin"]),
  syncSimulationTypePastYearData
);
router.put(
  "/:simulationTypeId/past-data",
  authenticate,
  authorize(["admin"]),
  updateSimulationTypePastData
);
router.get("/:simulationTypeId/past-data", getSimulationTypePastData);
router.put(
  "/:simulationTypeId/past-data/product-entry",
  authenticate,
  authorize(["admin"]),
  upsertSimulationTypeProductPastData
);
router.put(
  "/:simulationTypeId/past-data/segment-entry",
  authenticate,
  authorize(["admin"]),
  upsertSimulationTypeSegmentPastData
);
router.put(
  "/:simulationTypeId/past-data/global-entry",
  authenticate,
  authorize(["admin"]),
  upsertSimulationTypeGlobalPastData
);

router.put(
  "/:simulationTypeId/past-data/output-entry",
  authenticate,
  authorize(["admin"]),
  upsertSimulationTypeOutputPastData
);

router.put(
  "/:simulationTypeId/segments/:segmentId/fields",
  authenticate,
  authorize(["admin"]),
  updateSegmentFields
);
router.put(
  "/:simulationTypeId/segments/:segmentId/translations",
  authenticate,
  authorize(["admin"]),
  updateSegmentTranslations
);

router.put(
  "/:simulationTypeId/products/order",
  authenticate,
  authorize(["admin"]),
  updateProductOrder
);

router.use("/:simulationTypeId/segments", (req, res, next) => {
  const innerRouter = express.Router({ mergeParams: true });
  innerRouter.post("/", authenticate, authorize(["admin"]), createSegment);
  innerRouter.get("/", listSegments);
  innerRouter.put(
    "/order",
    authenticate,
    authorize(["admin"]),
    updateSegmentOrder
  );
  innerRouter.get("/:segmentId", readSegment);
  innerRouter.put(
    "/:segmentId",
    authenticate,
    authorize(["admin"]),
    updateSegment
  );
  innerRouter.put(
    "/:segmentId/fields",
    authenticate,
    authorize(["admin"]),
    updateSegmentFields
  );
  innerRouter(req, res, next);
});

router.use("/:simulationTypeId/base-data", (req, res, next) => {
  const innerRouter = express.Router({ mergeParams: true });

  innerRouter.get("", getBaseDataBySimulationTypeId);
  innerRouter.put("", authenticate, authorize(["admin"]), upsertBaseData);
  innerRouter.post("/sync", authenticate, authorize(["admin"]), syncBaseData);
  innerRouter.put(
    "/sat-drivers",
    authenticate,
    authorize(["admin"]),
    upsertBaseDataSatDrivers
  );
  innerRouter.put(
    "/entry",
    authenticate,
    authorize(["admin"]),
    upsertBaseDataEntry
  );
  innerRouter.delete(
    "/entry",
    authenticate,
    authorize(["admin"]),
    deleteBaseDataEntry
  );
  innerRouter.get(
    "/market-data/download",
    authenticate,
    authorize(["admin"]),
    downloadMarketDataCSV
  );
  innerRouter.post(
    "/market-data/upload",
    authenticate,
    authorize(["admin"]),
    upload.single("file"),
    uploadMarketDataCSV
  );
  innerRouter.get(
    "/market-model/download",
    authenticate,
    authorize(["admin"]),
    downloadMarketModelCSV
  );
  innerRouter.post(
    "/market-model/upload",
    authenticate,
    authorize(["admin"]),
    upload.single("file"),
    uploadMarketModelCSV
  );

  innerRouter(req, res, next);
});

router.use("/:simulationTypeId/global-inputs", (req, res, next) => {
  const innerRouter = express.Router({ mergeParams: true });

  innerRouter.get("", listGlobalInputs);
  innerRouter.post("", authenticate, authorize(["admin"]), createGlobalInput);
  innerRouter.put(
    "/order",
    authenticate,
    authorize(["admin"]),
    updateGlobalInputOrder
  );
  innerRouter.put(
    "/:globalInputId",
    authenticate,
    authorize(["admin"]),
    updateGlobalInput
  );
  innerRouter.put(
    "/:globalInputId/translations",
    authenticate,
    authorize(["admin"]),
    updateGlobalInputTranslations
  );
  innerRouter.get("/:globalInputId", readGlobalInput);
  innerRouter(req, res, next);
});

router.use("/:simulationTypeId/outputs", (req, res, next) => {
  const innerRouter = express.Router({ mergeParams: true });
  innerRouter.get("", readSimulationTypeOutputs);
  innerRouter.put(
    "",
    authenticate,
    authorize(["admin"]),
    updateSimulationTypeOutputs
  );
  innerRouter(req, res, next);
});

router.use("/:simulationTypeId/output-configs", (req, res, next) => {
  const innerRouter = express.Router({ mergeParams: true });
  innerRouter.get("", readSimulationTypeOutputConfigs);
  innerRouter.put(
    "/balance-sheet",
    authenticate,
    authorize(["admin"]),
    updateSimulationTypeBalanceSheetConfig
  );
  innerRouter.put(
    "/cashflow",
    authenticate,
    authorize(["admin"]),
    updateSimulationTypeCashflowConfig
  );
  innerRouter.put(
    "/bizperf",
    authenticate,
    authorize(["admin"]),
    updateSimulationTypeBizPerfConfig
  );
  innerRouter.put(
    "/pnl",
    authenticate,
    authorize(["admin"]),
    updateSimulationTypePnLConfig
  );
  // innerRouter.put(
  //   "",
  //   authenticate,
  //   authorize(["admin"]),
  //   updateSimulationTypeOutputConfigs
  // );
  innerRouter(req, res, next);
});

router.put(
  "/:simulationTypeId/winning-metrics",
  authenticate,
  authorize(["admin"]),
  updateSimulationTypeWinningMetrics
);
router.put(
  "/:simulationTypeId/constants",
  authenticate,
  authorize(["admin"]),
  updateSimulationTypeConstants
);
router.get(
  "/:simulationTypeId/winning-metrics",
  readSimulationTypeWinningMetrics
);

export default router;
