import cookieParser from "cookie-parser";
import cors from "cors"; // Import CORS middleware
import dotenv from "dotenv";
import express, { Request, RequestHandler, Response } from "express";
import fs from "fs";
import { createServer } from "http";
import path from "path";
import connectToDatabase from "./db/db";
import routes from "./routes";
import { initSocket } from "./utils/socket";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000; // Will be 3000 in docker-compose
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "https://app.int-labs.com"; // Default to the deployed client URL
const isProdLike = process.env.NODE_ENV !== "development";

// Build dynamic allowed origins list: envs or dev defaults
const rawAllowed = [
  process.env.CLIENT_ORIGIN,
  process.env.ALLOWED_ORIGINS, // comma-separated optional
  process.env.RENDER_EXTERNAL_URL, // Render-provided in some setups
]
  .filter(Boolean)
  .join(",");

const allowedOrigins = new Set(
  rawAllowed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

// Always allow common local dev origins
[
  "http://localhost:3000",
  "http://localhost:3005",
  "http://localhost:5173",
].forEach((o) => allowedOrigins.add(o));

// Connect to MongoDB
connectToDatabase();

console.log("Using CORS origin:", CLIENT_ORIGIN);

// Middleware
const corsConfig: cors.CorsOptions = {
  origin: (origin, cb) => {
    // Same-origin/no-origin (SSR, curl) → allow
    if (!origin) return cb(null, true);
    const normalized = origin.replace(/\/$/, "");
    if (allowedOrigins.has(normalized)) return cb(null, true);
    // In prod-like, be strict; otherwise allow for DX
    return cb(null, !isProdLike);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsConfig));
app.options("*", cors(corsConfig));

app.use(cookieParser()); // Middleware to parse cookies

app.use(express.json({ limit: "500kb" })); // Middleware to parse JSON requests

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Register API routes
app.use("/api", routes);

// In Docker/production, serve the React build from ../public (copied in Dockerfile)
// On Render Native environments, it remains in ../../client/build
if (isProdLike || process.env.SERVE_CLIENT === "true") {
  const dockerPublicDir = path.join(__dirname, "../public");
  const nativePublicDir = path.join(__dirname, "../../client/build");

  let publicDir = null;
  if (fs.existsSync(path.join(dockerPublicDir, "index.html")))
    publicDir = dockerPublicDir;
  else if (fs.existsSync(path.join(nativePublicDir, "index.html")))
    publicDir = nativePublicDir;

  if (publicDir) {
    app.use(express.static(publicDir));

    // SPA fallback: send index.html for non-API routes
    const spaFallbackHandler: RequestHandler = (
      req: Request,
      res: Response
    ) => {
      // Do not intercept API routes
      if (req.path.startsWith("/api")) {
        res.status(404).end();
        return;
      }
      res.sendFile(path.join(publicDir, "index.html"));
    };
    app.get("*", spaFallbackHandler);
  } else {
    // If the client build does not exist, this is an API-only deployment.
    // We must return 200 OK on '/' so that Render's health checks pass without throwing ENOENT.
    app.get("/", (req, res) => {
      res.status(200).send("Stratagem API Server Running");
    });
  }
}

const srv = createServer(app);
const io = initSocket(srv, CLIENT_ORIGIN);

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
});

// Start server
const server = srv.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export app and server
export { app, io, server };
