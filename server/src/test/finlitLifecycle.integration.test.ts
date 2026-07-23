// End-to-end integration test for the notebook-pixel-sim <-> gamesim wiring:
// bootstrap -> draft save -> preview -> submit -> finalize -> results.
// Builds a throwaway Express app (never imports src/index.ts, which starts a
// real listener) and a MongoMemoryServer, per this repo's stated test
// convention.
import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import jwt from "jsonwebtoken";

import Simulation from "../models/simulations";
import Team from "../models/teams";
import User from "../models/users";
import Round from "../models/rounds";
import TeamRoundDecision from "../models/teamRoundDecisions";
import TeamRoundResult from "../models/teamRoundResults";
import playerRoutes from "../routes/playerRoutes";
import roundRoutes from "../routes/roundRoutes";

process.env.JWT_SECRET = "test-secret";

let mongo: MongoMemoryReplSet;
const app = express();
app.use(express.json());
app.use("/api/player", playerRoutes);
app.use("/api/rounds", roundRoutes);

function signTeamToken(userId: string, teamId: string) {
  return jwt.sign({ id: userId, role: "team", teamId }, process.env.JWT_SECRET as string, { expiresIn: "15m" });
}
function signOperatorToken(userId: string) {
  return jwt.sign({ id: userId, role: "operator" }, process.env.JWT_SECRET as string, { expiresIn: "15m" });
}

const validSpec = { type: "cute", paper: "recycled", size: "a5", pageDesign: "lined", addon: "spiral", cover: "plastic" };
function makePayload(lineId: string, overrides: Partial<{ price: number }> = {}) {
  return {
    lines: [
      {
        id: lineId,
        name: "Cute Co",
        genre: "cute",
        spec: validSpec,
        price: overrides.price ?? 8,
        channels: ["offline", "online"],
        finished: 0,
      },
    ],
    decisions: { route: "self", marketingBudget: 0, salesBudget: 0, demandMult: 1, sellMult: 1 },
  };
}

beforeAll(async () => {
  // finalizeRound uses a multi-document transaction, which requires a
  // replica set — a plain MongoMemoryServer standalone instance rejects
  // `startSession().withTransaction()` outright.
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe("finlit player lifecycle", () => {
  it("runs bootstrap -> draft -> preview -> submit -> finalize -> results for two teams", async () => {
    const simulation = await Simulation.create({
      simulationName: "FinLit Test Sim",
      status: "Active",
      simulationTypeId: new mongoose.Types.ObjectId(),
      config: { totalRounds: 3, currRounds: 1 },
    });

    const teamA = await Team.create({ simulationId: simulation._id, teamName: "Team A" });
    const teamB = await Team.create({ simulationId: simulation._id, teamName: "Team B" });
    const userA = await User.create({ password: "x", role: "team", teamId: teamA._id, simulationId: simulation._id, passkey: "pk-a" });
    const userB = await User.create({ password: "x", role: "team", teamId: teamB._id, simulationId: simulation._id, passkey: "pk-b" });
    const operator = await User.create({ email: "op@test.com", password: "x", role: "operator" });

    const round = await Round.create({ simulationId: simulation._id, roundNumber: 1, status: "Active" });

    const tokenA = signTeamToken(String(userA._id), String(teamA._id));
    const tokenB = signTeamToken(String(userB._id), String(teamB._id));
    const tokenOp = signOperatorToken(String(operator._id));

    // --- bootstrap ---
    const bootA = await request(app).get("/api/player/bootstrap").set("Authorization", `Bearer ${tokenA}`);
    expect(bootA.status).toBe(200);
    expect(bootA.body.team.name).toBe("Team A");
    expect(bootA.body.round.number).toBe(1);
    expect(bootA.body.permissions.canEditDecision).toBe(true);
    expect(bootA.body.permissions.canViewResult).toBe(false);

    // --- team A can't read team B's draft/bootstrap under team B's identity mixed with A's token ---
    const draftNoneA = await request(app).get("/api/player/rounds/current/decision").set("Authorization", `Bearer ${tokenA}`);
    expect(draftNoneA.status).toBe(200);
    expect(draftNoneA.body.decision).toBeNull();

    // --- save draft v0 -> v1 ---
    const saveA1 = await request(app)
      .put("/api/player/rounds/current/decision")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ version: 0, configVersion: "notebook-v3-2026-07", payload: makePayload("line-a") });
    expect(saveA1.status).toBe(201);
    expect(saveA1.body.version).toBe(1);
    expect(saveA1.body.status).toBe("draft");

    // --- stale version conflict ---
    const staleConflict = await request(app)
      .put("/api/player/rounds/current/decision")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ version: 0, configVersion: "notebook-v3-2026-07", payload: makePayload("line-a", { price: 20 }) });
    expect(staleConflict.status).toBe(409);

    // --- correct version succeeds ---
    const saveA2 = await request(app)
      .put("/api/player/rounds/current/decision")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ version: 1, configVersion: "notebook-v3-2026-07", payload: makePayload("line-a", { price: 12 }) });
    expect(saveA2.status).toBe(200);
    expect(saveA2.body.version).toBe(2);

    // --- canonical preview (non-persistent) ---
    const preview = await request(app)
      .post("/api/player/rounds/current/preview")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ decisionVersion: 2, payload: makePayload("line-a", { price: 12 }) });
    expect(preview.status).toBe(200);
    expect(preview.body.result.phase).toBe(1);
    expect(typeof preview.body.result.revenue).toBe("number");
    // Preview must not have written a result.
    expect(await TeamRoundResult.countDocuments({})).toBe(0);

    // --- submit team A ---
    const submitA = await request(app)
      .post("/api/player/rounds/current/decision/submit")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ version: 2 });
    expect(submitA.status).toBe(200);
    expect(submitA.body.status).toBe("submitted");

    // --- idempotent resubmit ---
    const resubmitA = await request(app)
      .post("/api/player/rounds/current/decision/submit")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ version: 2 });
    expect(resubmitA.status).toBe(200);
    expect(resubmitA.body.status).toBe("submitted");

    // --- editing after submit is rejected ---
    const editAfterSubmit = await request(app)
      .put("/api/player/rounds/current/decision")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ version: 2, configVersion: "notebook-v3-2026-07", payload: makePayload("line-a") });
    expect(editAfterSubmit.status).toBe(409);

    // --- finalize should fail: team B hasn't submitted ---
    const finalizeTooEarly = await request(app)
      .post(`/api/rounds/${round._id}/finalize`)
      .set("Authorization", `Bearer ${tokenOp}`);
    expect(finalizeTooEarly.status).toBe(400);
    expect(finalizeTooEarly.body.message).toMatch(/Team B/i);

    // --- team B saves + submits ---
    await request(app)
      .put("/api/player/rounds/current/decision")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ version: 0, configVersion: "notebook-v3-2026-07", payload: makePayload("line-b") });
    await request(app)
      .post("/api/player/rounds/current/decision/submit")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ version: 1 });

    // --- team role cannot finalize ---
    const finalizeAsTeam = await request(app)
      .post(`/api/rounds/${round._id}/finalize`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(finalizeAsTeam.status).toBe(403);

    // --- finalize succeeds ---
    const finalize1 = await request(app)
      .post(`/api/rounds/${round._id}/finalize`)
      .set("Authorization", `Bearer ${tokenOp}`);
    expect(finalize1.status).toBe(200);
    expect(finalize1.body.results).toHaveLength(2);

    const decisionA = await TeamRoundDecision.findOne({ teamId: teamA._id, roundId: round._id });
    expect(decisionA?.status).toBe("locked");
    const roundAfter = await Round.findById(round._id);
    expect(roundAfter?.status).toBe("Completed");

    // --- idempotent re-finalize: no duplicate results ---
    const finalize2 = await request(app)
      .post(`/api/rounds/${round._id}/finalize`)
      .set("Authorization", `Bearer ${tokenOp}`);
    expect(finalize2.status).toBe(200);
    expect(finalize2.body.message).toMatch(/already finalized/i);
    expect(await TeamRoundResult.countDocuments({ roundId: round._id })).toBe(2);

    // --- team A can now view its own result ---
    const resultA = await request(app).get("/api/player/results/current").set("Authorization", `Bearer ${tokenA}`);
    expect(resultA.status).toBe(200);
    expect(resultA.body.payload.phase).toBe(1);
    expect(resultA.body.payload.revenue).toBeCloseTo(preview.body.result.revenue, 6);

    // --- bootstrap now reflects Completed round + viewable result ---
    const bootAfter = await request(app).get("/api/player/bootstrap").set("Authorization", `Bearer ${tokenA}`);
    expect(bootAfter.body.round.status).toBe("Completed");
    expect(bootAfter.body.permissions.canEditDecision).toBe(false);
    expect(bootAfter.body.permissions.canViewResult).toBe(true);
  }, 30000);
});
