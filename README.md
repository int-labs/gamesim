
# Int Labs

Welcome to the **Int Labs** backend server! This is a banking simulation API designed for tracking and analyzing financial decisions in various banking products like deposits and credit cards. The backend is built using **Node.js** with **MongoDB** for data storage.

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
