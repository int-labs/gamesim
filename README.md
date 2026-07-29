# Gamesim

Monorepo for the Int Labs simulation platform:

```
gamesim/
  client/              Operator console (Vite) — same folder as on main, deployed separately
  notebook-pixel-sim/  Notebook pixel player — the integrated build of the standalone
                       project; primary frontend served by the server
  server/              Express + Socket.IO API
  shared/
    finlit-engine/   Pure FinLit phase engine (shared by player preview + server finalize)
    api-contract/    Player HTTP + socket DTO contracts
```

## Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)

## Install

```bash
npm run install:all
```

Or manually:

```bash
npm install
cd shared/finlit-engine && npm install && npm run build
cd ../api-contract && npm install && npm run build
cd ../../server && npm install
cd ../notebook-pixel-sim && npm install
cd ../client && npm install
```

## Environment

Copy [`.env.example`](./.env.example). Important vars:

| Var | Where | Purpose |
|---|---|---|
| `VITE_GAMESIM_API_URL` | `notebook-pixel-sim/` | Player → API base (include `/api`) |
| `CLIENT_ORIGIN` / `PLAYER_ORIGIN` / `ADMIN_ORIGIN` / `ALLOWED_ORIGINS` | `server/` | Shared CORS + Socket.IO allowlist |
| `MONGO_URI` / `JWT_SECRET` / `PORT` | `server/` | Runtime |

## Scripts (root)

| Script | What it runs |
|---|---|
| `npm run dev` | server + player |
| `npm run dev:server` | API only |
| `npm run dev:player` | Notebook player (port 5173) |
| `npm run dev:admin` | Operator admin (port 3001) |
| `npm run build` | shared + server + player |
| `npm run build:server` / `build:player` / `build:admin` | per-app |
| `npm test` | server Jest suite (lifecycle, parity, origins) |

## Docker

- `Dockerfile` — player (`notebook-pixel-sim/`) + server (player static assets copied to `server/public`)
- `Dockerfile.admin` — operator console (`client/`) only, served by nginx
- `Dockerfile.preview` — Render preview (player + server + Atlas tooling)

## Player ↔ server contract

Player authenticates with a team passkey, bootstraps via `GET /api/player/bootstrap`,
saves/submits decisions on the Active round, and listens for Socket.IO events
(`round.*`, `decision.submitted`, `result.published`). On `result.published`,
the player fetches `/api/player/results/:roundNumber` (not `/results/current`)
so a newly activated next round cannot hide the finalized result.
