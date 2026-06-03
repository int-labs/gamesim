import express from "express";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import multer from "multer";
import request from "supertest";

import * as XLSX from "xlsx";
import BaseData from "../models/baseData";
import Product from "../models/products";
import Segment from "../models/segments";
import SimulationType from "../models/simulationTypes";
import {
  downloadMarketModelCSV,
  syncBaseData,
  uploadMarketModelCSV,
} from "./baseDataControllers";

jest.setTimeout(60000);

const upload = multer({
  storage: multer.memoryStorage(),
});

const buildApp = () => {
  const app = express();
  app.use(express.json());

  app.get(
    "/api/simulation-types/:simulationTypeId/base-data/market-model/download",
    downloadMarketModelCSV
  );

  app.post(
    "/api/simulation-types/:simulationTypeId/base-data/market-model/upload",
    upload.single("file"),
    uploadMarketModelCSV
  );

  app.post(
    "/api/simulation-types/:simulationTypeId/base-data/sync",
    syncBaseData
  );

  return app;
};

describe("Market Model CSV Export/Import", () => {
  let mongo: MongoMemoryServer;
  const app = buildApp();
  let simulationTypeId: mongoose.Types.ObjectId;
  let segmentId: mongoose.Types.ObjectId;
  let productId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongo.stop();
  });

  beforeEach(async () => {
    await BaseData.deleteMany({});
    await SimulationType.deleteMany({});
    await Segment.deleteMany({});
    await Product.deleteMany({});

    simulationTypeId = new mongoose.Types.ObjectId();
    segmentId = new mongoose.Types.ObjectId();
    productId = new mongoose.Types.ObjectId();

    await SimulationType.create({
      _id: simulationTypeId,
      name: "Test Type",
      yearRange: { startYear: 2023, baseYear: 2024, endYear: 2025 },
    });

    await Segment.create({
      _id: segmentId,
      name: "Test Segment",
      simulationTypeId,
    });

    await Product.create({
      _id: productId,
      productName: "Test Product",
      segmentId,
      simulationTypeId,
      fields: [
        {
          key: "price",
          label: "Price",
          coefficients: { "2023": 1.0, "2024": 1.1, "2025": 1.2 },
          direction: 1,
          tightening: 3.0,
        },
      ],
    });

    await BaseData.create({
      simulationTypeId,
      marketData: {
        segments: [
          {
            segmentId,
            products: [],
          },
        ],
      },
      marketModel: {
        segments: [
          {
            segmentId,
            products: [
              {
                productId,
                fields: [
                  {
                    key: "price",
                    label: "Price",
                    coefficients: { "2023": 1.0, "2024": 1.1, "2025": 1.2 },
                    direction: 1,
                    tightening: 3.0,
                  },
                ],
                segmentFields: [],
                globalFields: [],
                subProducts: [],
              },
            ],
          },
        ],
      },
    });
  });

  it("should download market model CSV", async () => {
    const res = await request(app)
      .get(
        `/api/simulation-types/${simulationTypeId}/base-data/market-model/download`
      )
      .expect(200);

    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.text).toContain("Test Segment");
    expect(res.text).toContain("Test Product");
    expect(res.text).toContain("Price");
    expect(res.text).toContain("Elasticity");
    expect(res.text).toContain("2023");
  });

  it("should upload market model CSV and update data", async () => {
    // Create a mock CSV file
    const rows = [
      [
        "Segment Name",
        "Product Name",
        "Product ID",
        "Subproduct Key",
        "Field Type",
        "Field Key",
        "Field Label",
        "Direction",
        "Tightening",
        "Elasticity",
        "2023",
        "2024",
        "2025",
      ],
      [
        "Test Segment",
        "Test Product",
        productId.toString(),
        "",
        "Product",
        "price",
        "Price",
        -1, // Changed direction
        5.0, // Changed tightening
        1.5, // Changed elasticity
        2.0, // Changed coefficient
        2.2, // Changed coefficient
        2.4, // Changed coefficient
      ],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Market Model");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "csv" });

    await request(app)
      .post(
        `/api/simulation-types/${simulationTypeId}/base-data/market-model/upload`
      )
      .attach("file", buffer, "market_model.csv")
      .expect(200);

    const updatedBaseData = await BaseData.findOne({ simulationTypeId });
    const field =
      updatedBaseData?.marketModel.segments[0].products[0].fields[0];

    expect(field?.direction).toBe(-1);
    expect(field?.tightening).toBe(5.0);
    expect((field as any)?.elasticity).toBe(1.5);
    expect(field?.coefficients?.["2023"]).toBe(2.0);
    expect(field?.coefficients?.["2024"]).toBe(2.2);
    expect(field?.coefficients?.["2025"]).toBe(2.4);
  });

  it("should preserve dynamic fields during sync", async () => {
    // Add a dynamic field to the existing base data
    const baseData = await BaseData.findOne({ simulationTypeId });
    if (baseData) {
      baseData.marketModel.segments[0].products[0].fields.push({
        key: "dynamic_driver",
        label: "Dynamic Driver",
        coefficients: { "2023": 1.0, "2024": 1.0, "2025": 1.0 },
        direction: 1,
        tightening: 3.0,
        level: "dynamic",
      });
      await baseData.save();
    }

    // Call sync
    await request(app)
      .post(`/api/simulation-types/${simulationTypeId}/base-data/sync`)
      .expect(200);

    // Verify dynamic field is still there
    const updatedBaseData = await BaseData.findOne({ simulationTypeId });
    const fields = updatedBaseData?.marketModel.segments[0].products[0].fields;
    const dynamicField = fields?.find((f) => f.key === "dynamic_driver");

    expect(dynamicField).toBeTruthy();
    expect(dynamicField?.level).toBe("dynamic");
    expect(dynamicField?.label).toBe("Dynamic Driver");
  });
});
