
# Int Labs

A business-simulation platform. Teams run product lines across a configurable
number of rounds, submitting decisions that are scored competitively against
every other team. **Node.js** + **MongoDB**.

> The previous description here — "a banking simulation API … deposits and
> credit cards" — described a different product. It is corrected rather than
> preserved: a stale overview is worse than none, because it is believed.

## The three packages

| Package | What it is |
|---|---|
| [`server/`](server/) | The API and the simulation engine. **Owns every monetary figure and the score.** See [`server/README.md`](server/README.md) for the data model and calculation order. |
| [`client/`](client/) | The operator/admin console — configure simulations, run rounds, read results. |
| [`notebook-pixel-sim/`](notebook-pixel-sim/) | The player client. See its [README](notebook-pixel-sim/README.md). |

## Where documentation lives

Present-state architecture belongs in the READMEs; they are the authority and
are expected to change with the code.

- [`server/README.md`](server/README.md) — collections and their one job, round
  numbering, calculation order, the money chain, what freezes a round
- [`notebook-pixel-sim/CLAUDE.md`](notebook-pixel-sim/CLAUDE.md) — **how to work
  with Claude in this repo**, deliberately free of present-state context.
  Instructions about tooling outlive facts about the system, and mixing them is
  how the handover version went months out of date while still reading as
  current.

## Table of Contents

- [Getting Started](#getting-started)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [API Endpoints](#api-endpoints)
- [Folder Structure](#folder-structure)
- [License](#license)

## Getting Started

Follow the steps below to get this backend running locally.

### Prerequisites

Make sure you have the following software installed on your machine:

- **Node.js** (v14 or higher)
- **MongoDB** (locally or MongoDB Atlas account for cloud storage)
- **Git** (for cloning the repository)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/int-labs/stratagem.git
   cd stratagem
   ```

2. Install Dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add the necessary configuration values. You can refer to `.env.example` if available.
   ```plaintext
   MONGO_URI=your-mongodb-connection-string
   PORT=5000
   ```

4. Run the project:
   ```bash
   npm start
   ```

## API Endpoints

- **GET /** - Check if the server is up and running.
- **POST /decision** - Submit a decision log for a team.
- **GET /decisions** - Retrieve all decision logs.
- **POST /finalize-decision** - Submit a finalized decision.
- **GET /dashboard** - Get real-time metrics of the banking simulation.

## Folder Structure

- **controllers/**: Handles logic for interacting with models and responding to HTTP requests.
- **models/**: Defines the schema for the MongoDB collections.
- **modules/**: Contains business logic for specific features, like deposits and credit cards.
- **routes/**: Contains the routes for each API endpoint.
- **utils/**: Utility functions for error handling, logging, validation, etc.

## License

This project is licensed under the [MIT License](LICENSE). You are free to use, modify, and distribute this project, provided that proper attribution is given.
