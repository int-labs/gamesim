import { createServer } from "http";
import { io as ioc, Socket as ClientSocket } from "socket.io-client";
import jwt from "jsonwebtoken";
import { AddressInfo } from "net";

import { initSocket } from "../utils/socket";
import { parseAllowedOrigins } from "../utils/allowedOrigins";

process.env.JWT_SECRET = "test-secret-socket";

describe("socket.io auth + allowed origins", () => {
  let httpServer: ReturnType<typeof createServer>;
  let port: number;
  const clients: ClientSocket[] = [];

  beforeAll((done) => {
    httpServer = createServer();
    const origins = parseAllowedOrigins({
      CLIENT_ORIGIN: "http://localhost:5173",
      ADMIN_ORIGIN: "http://localhost:3001",
    });
    initSocket(httpServer, origins);
    httpServer.listen(0, () => {
      port = (httpServer.address() as AddressInfo).port;
      done();
    });
  });

  afterAll((done) => {
    clients.forEach((c) => c.close());
    httpServer.close(done);
  });

  it("rejects connections without a token", (done) => {
    const client = ioc(`http://127.0.0.1:${port}`, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });
    clients.push(client);
    client.on("connect", () => {
      done(new Error("should not connect without token"));
    });
    client.on("connect_error", (err) => {
      expect(String(err.message)).toMatch(/Unauthorized/i);
      done();
    });
  });

  it("accepts connections with a valid JWT (no teamId → skips Team lookup)", (done) => {
    const token = jwt.sign({ id: "u1", role: "operator" }, process.env.JWT_SECRET as string, {
      expiresIn: "5m",
    });
    const client = ioc(`http://127.0.0.1:${port}`, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
      auth: { token },
    });
    clients.push(client);
    client.on("connect", () => {
      expect(client.connected).toBe(true);
      done();
    });
    client.on("connect_error", (err) => done(err));
  });

  it("parseAllowedOrigins is what Socket.IO cors.origin receives (player+admin)", () => {
    const origins = parseAllowedOrigins({
      PLAYER_ORIGIN: "http://localhost:5173",
      ADMIN_ORIGIN: "http://localhost:3001",
    });
    expect(origins).toEqual(
      expect.arrayContaining(["http://localhost:5173", "http://localhost:3001"]),
    );
  });
});
