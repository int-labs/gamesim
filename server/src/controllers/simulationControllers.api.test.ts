import express from "express";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";

import { getAllSimulations } from "./simulationControllers";
import Simulation from "../models/simulations";
import Team from "../models/teams";

// Allow extra time for Mongo binary download/startup
jest.setTimeout(60000);

const buildApp = () => {
  const app = express();
  app.use(express.json());

  // Bypass auth middleware: inject a user and call controller
  app.get(
    "/api/simulations",
    (req, _res, next) => {
      (req as any).user = { role: "admin", userId: "tester" };
      next();
    },
    getAllSimulations
  );

  return app;
};

describe("GET /api/simulations (filtering, sorting, pagination)", () => {
  let mongo: MongoMemoryServer;
  const app = buildApp();

  beforeAll(async () => {
    jest.useRealTimers();

    console.log("[test] beforeAll start");
    console.time("[test] mongomem create");
    mongo = await MongoMemoryServer.create();
    console.timeEnd("[test] mongomem create");

    const uri = mongo.getUri();
    process.env.MONGO_URI = uri;
    process.env.MONGO_URI_LOCAL = uri;
    process.env.NODE_ENV = "test";

    console.log("[test] connect start");
    console.time("[test] mongoose connect");
    await mongoose.connect(uri);
    console.timeEnd("[test] mongoose connect");
    console.log("[test] beforeAll done");
  });

  afterAll(async () => {
    console.log("[test] afterAll start");
    console.time("[test] dropDatabase");
    await mongoose.connection.dropDatabase();
    console.timeEnd("[test] dropDatabase");
    console.time("[test] close connection");
    await mongoose.connection.close();
    console.timeEnd("[test] close connection");
    console.time("[test] stop mongomem");
    await mongo.stop();
    console.timeEnd("[test] stop mongomem");
    jest.useRealTimers();
    console.log("[test] afterAll done");
  });

  beforeEach(async () => {
    console.log("[test] beforeEach start");
    console.time("[test] clear collections");
    await Simulation.deleteMany({});
    await Team.deleteMany({});
    console.timeEnd("[test] clear collections");

    // Calculate dates relative to current time for date filtering tests
    const NOW = new Date();
    const ONE_DAY_AGO = new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000);
    const TWENTY_DAYS_AGO = new Date(NOW.getTime() - 20 * 24 * 60 * 60 * 1000);
    const THREE_MONTHS_AGO = new Date(NOW.getFullYear(), NOW.getMonth() - 3, NOW.getDate());
    const NINE_MONTHS_AGO = new Date(NOW.getFullYear(), NOW.getMonth() - 9, NOW.getDate());

    console.time("[test] insert simulations");
    const sims = await Simulation.insertMany([
      {
        simulationName: "Alpha",
        status: "Active",
        simulationTypeId: new mongoose.Types.ObjectId(),
        config: { totalRounds: 5, currRounds: 1, includeEvents: false, eventSettings: { frequency: "low", types: [] } },
        startDate: ONE_DAY_AGO,
        endDate: null,
        createdAt: ONE_DAY_AGO, // within last 7 days
      },
      {
        simulationName: "Beta",
        status: "Completed",
        simulationTypeId: new mongoose.Types.ObjectId(),
        config: { totalRounds: 10, currRounds: 10, includeEvents: false, eventSettings: { frequency: "low", types: [] } },
        startDate: TWENTY_DAYS_AGO,
        endDate: ONE_DAY_AGO,
        createdAt: TWENTY_DAYS_AGO, // within last 30 days
      },
      {
        simulationName: "Gamma",
        status: "Active",
        simulationTypeId: new mongoose.Types.ObjectId(),
        config: { totalRounds: 3, currRounds: 3, includeEvents: false, eventSettings: { frequency: "low", types: [] } },
        startDate: THREE_MONTHS_AGO,
        endDate: null,
        createdAt: THREE_MONTHS_AGO, // ~3 months ago
      },
      {
        simulationName: "Delta",
        status: "Completed",
        simulationTypeId: new mongoose.Types.ObjectId(),
        config: { totalRounds: 2, currRounds: 2, includeEvents: false, eventSettings: { frequency: "low", types: [] } },
        startDate: NINE_MONTHS_AGO,
        endDate: NINE_MONTHS_AGO,
        createdAt: NINE_MONTHS_AGO, // ~9 months ago
      },
    ]);
    console.timeEnd("[test] insert simulations");

    // Add teams to validate teamCount aggregation does not break the endpoint
    console.time("[test] insert teams");
    await Team.insertMany([
      { 
        simulationId: sims[0]._id, 
        teamName: "Team A", 
        teamLeader: "Leader A",
        score: 0,
        marketShare: 0
      },
      { 
        simulationId: sims[0]._id, 
        teamName: "Team B", 
        teamLeader: "Leader B",
        score: 0,
        marketShare: 0
      },
      { 
        simulationId: sims[1]._id, 
        teamName: "Team C", 
        teamLeader: "Leader C",
        score: 0,
        marketShare: 0
      },
    ]);
    console.timeEnd("[test] insert teams");
    console.log("[test] beforeEach done");
  });

  it("searches by simulation name", async () => {
    const res = await request(app).get("/api/simulations").query({ search: "Alpha" }).expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].simulationName).toBe("Alpha");
  });

  it("filters by status", async () => {
    const res = await request(app).get("/api/simulations").query({ status: "Completed" }).expect(200);
    const names = res.body.data.map((s: any) => s.simulationName);
    expect(names.sort()).toEqual(["Beta", "Delta"]);
  });

  it("filters by current round", async () => {
    const res = await request(app).get("/api/simulations").query({ currentRound: 3 }).expect(200);
    const names = res.body.data.map((s: any) => s.simulationName);
    expect(names).toEqual(["Gamma"]);
  });

  it("filters by dateCreated (last7days)", async () => {
    const res = await request(app).get("/api/simulations").query({ dateCreated: "last7days" }).expect(200);
    const names = res.body.data.map((s: any) => s.simulationName);
    expect(names).toEqual(["Alpha"]);
  });

  it("sorts by simulationName asc/desc", async () => {
    const asc = await request(app)
      .get("/api/simulations")
      .query({ sortField: "simulationName", sortOrder: "asc" })
      .expect(200);
    expect(asc.body.data.map((s: any) => s.simulationName)).toEqual(["Alpha", "Beta", "Delta", "Gamma"]);

    const desc = await request(app)
      .get("/api/simulations")
      .query({ sortField: "simulationName", sortOrder: "desc" })
      .expect(200);
    expect(desc.body.data.map((s: any) => s.simulationName)).toEqual(["Gamma", "Delta", "Beta", "Alpha"]);
  });

  it("paginates with page and limit", async () => {
    const res = await request(app)
      .get("/api/simulations")
      .query({ page: 2, limit: 2, sortField: "simulationName", sortOrder: "asc" })
      .expect(200);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.map((s: any) => s.simulationName)).toEqual(["Delta", "Gamma"]);
    expect(res.body.totalCount).toBe(4);
    expect(res.body.currentPage).toBe(2);
  });
});
