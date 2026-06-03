// src/db/db.ts
import mongoose, { Connection } from "mongoose";
import dotenv from "dotenv";
import path from "path";

/* -------------------------------------------------------------------------- */
/* 1) Environment loading: .env then .env.local (local overrides)             */
/* -------------------------------------------------------------------------- */
dotenv.config({ path: path.join(process.cwd(), ".env") });
dotenv.config({ path: path.join(process.cwd(), ".env.local"), override: true });

/* -------------------------------------------------------------------------- */
/* 2) Resolve effective Mongo URI (prod prefers MONGO_URI; dev prefers LOCAL) */
/* -------------------------------------------------------------------------- */
function mustBeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
function resolveMongoUri(): string {
  const NODE_ENV = process.env.NODE_ENV ?? "development";
  const MONGO_URI = mustBeString(process.env.MONGO_URI);
  const MONGO_URI_LOCAL = mustBeString(process.env.MONGO_URI_LOCAL);

  if (NODE_ENV === "production" && MONGO_URI) return MONGO_URI;
  if (MONGO_URI_LOCAL) return MONGO_URI_LOCAL;
  if (MONGO_URI) return MONGO_URI;

  // Safe local fallback
  return "mongodb://127.0.0.1:27017/dev_local" +
    "?retryWrites=false&directConnection=true&family=4&serverSelectionTimeoutMS=8000";
}
const EFFECTIVE_URI = resolveMongoUri();

/* -------------------------------------------------------------------------- */
/* 3) Mongoose config                                                         */
/* -------------------------------------------------------------------------- */
mongoose.set("strictQuery", true);
if (process.env.MONGO_DEBUG === "true") {
  mongoose.set("debug", true);
}

const CONNECT_OPTIONS: mongoose.ConnectOptions = {
  serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS ?? 8000),
  socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS ?? 20000),
  heartbeatFrequencyMS: Number(process.env.MONGO_HEARTBEAT_MS ?? 10000),
  maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE ?? 10),
  minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE ?? 0),
  // Provide auth/tls via URI or env; don't hardcode here.
};

/* -------------------------------------------------------------------------- */
/* 4) Global singletons (typed) to avoid duplicate connections on hot reload  */
/* -------------------------------------------------------------------------- */
declare global {
  // eslint-disable-next-line no-var
  var __mongoConnPromise: Promise<Connection> | undefined;
  // eslint-disable-next-line no-var
  var __mongoShutdownRegistered: boolean | undefined;
}
global.__mongoConnPromise ??= undefined;
global.__mongoShutdownRegistered ??= undefined;

/* -------------------------------------------------------------------------- */
/* 5) Utilities                                                               */
/* -------------------------------------------------------------------------- */
const redact = (s: string) => s.replace(/\/\/([^:@]+):([^@]+)@/, "//****:****@");
const stateLabel = (s: number) =>
  (["disconnected", "connected", "connecting", "disconnecting"] as const)[s] ?? String(s);
const logState = (prefix = "[mongo]") =>
  console.log(`${prefix} state: ${stateLabel(mongoose.connection.readyState)}`);

/* -------------------------------------------------------------------------- */
/* 6) Core connect logic                                                      */
/* -------------------------------------------------------------------------- */
async function performConnect(): Promise<Connection> {
  console.log("[mongo] connecting to:", redact(EFFECTIVE_URI));
  await mongoose.connect(EFFECTIVE_URI, CONNECT_OPTIONS);
  console.log("[mongo] connected");
  logState();

  // Attach listeners once
  if (mongoose.connection.listenerCount("error") === 0) {
    mongoose.connection.on("error", (err) => {
      console.error("[mongo] connection error:", err);
    });
  }
  if (mongoose.connection.listenerCount("disconnected") === 0) {
    mongoose.connection.on("disconnected", () => {
      console.warn("[mongo] disconnected");
    });
  }

  // Graceful shutdown: register once per process
  if (!global.__mongoShutdownRegistered) {
    const shutdown = async (signal: NodeJS.Signals) => {
      console.log(`[mongo] ${signal} received; closing MongoDB connection...`);
      try {
        await mongoose.connection.close();
        console.log("[mongo] connection closed");
        process.exit(0);
      } catch (e) {
        console.error("[mongo] error during shutdown:", e);
        process.exit(1);
      }
    };
    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));
    global.__mongoShutdownRegistered = true;
  }

  return mongoose.connection;
}

/* -------------------------------------------------------------------------- */
/* 7) Public API: idempotent, TS-safe                                         */
/* -------------------------------------------------------------------------- */
export async function connectToDatabase(): Promise<Connection> {
  // Already connected
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // Reuse in-flight connection if present
  if (!global.__mongoConnPromise) {
    global.__mongoConnPromise = performConnect().catch((err) => {
      // Reset cache on failure so subsequent calls can retry
      global.__mongoConnPromise = undefined;
      throw err;
    });
  }

  return global.__mongoConnPromise;
}

/* -------------------------------------------------------------------------- */
/* 8) Health & maintenance helpers                                            */
/* -------------------------------------------------------------------------- */
/** Ping the DB; throws if unhealthy. */
export async function mongoHealthCheck(timeoutMs = 3000): Promise<void> {
  const t = setTimeout(() => {
    // Soft timeout—doesn't cancel Mongo driver, just bounds our await
    console.warn(`[mongo] health check exceeded ${timeoutMs} ms`);
  }, timeoutMs);

  try {
    await connectToDatabase();
    // @ts-expect-error admin() not perfectly typed on mongoose.Connection
    await mongoose.connection.db.admin().command({ ping: 1 });
  } finally {
    clearTimeout(t);
  }
}

/** Return current connection state as human label. */
export function getMongoState(): string {
  return stateLabel(mongoose.connection.readyState);
}

/** Close the active connection (useful in tests/dev tools). */
export async function closeMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  global.__mongoConnPromise = undefined;
}

/** Redacted URI for diagnostics */
export const MONGO_URI_EFFECTIVE_REDACTED = redact(EFFECTIVE_URI);

/* -------------------------------------------------------------------------- */
/* 9) Default export for existing imports                                     */
/* -------------------------------------------------------------------------- */
export default connectToDatabase;
