import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import * as readline from "readline";

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (query: string): Promise<string> =>
  new Promise((resolve) => rl.question(query, resolve));

async function main() {
  const sourceUri = process.env.SOURCE_MONGO_URI || process.env.MONGO_URI;
  const targetUri =
    process.env.TARGET_MONGO_URI || process.env.PROD_MONGO_URI_WITH_DB;
  const simulationTypeIdArg = process.argv[2];

  if (!sourceUri || !targetUri) {
    console.error(
      "\x1b[31mERROR: Source and Target Mongo URIs must be set in your .env or shell.\x1b[0m"
    );
    console.error(
      "The script looks for 'SOURCE_MONGO_URI' (fallback: 'MONGO_URI')"
    );
    console.error(
      "And 'TARGET_MONGO_URI' (fallback: 'PROD_MONGO_URI_WITH_DB')"
    );
    process.exit(1);
  }

  if (!simulationTypeIdArg) {
    console.error(
      "\x1b[31mERROR: Please provide the SimulationType ID as an argument.\x1b[0m"
    );
    process.exit(1);
  }

  let simTypeId: ObjectId;
  try {
    simTypeId = new ObjectId(simulationTypeIdArg);
  } catch (err) {
    console.error("\x1b[31mERROR: Invalid MongoDB ObjectId.\x1b[0m");
    process.exit(1);
    return;
  }

  const collectionsConfig = [
    { name: "simulationTypes", queryField: "_id" },
    { name: "segments", queryField: "simulationTypeId" },
    { name: "bizperfconfigs", queryField: "simulationTypeId" },
    { name: "globalInputs", queryField: "simulationTypeId" },
    { name: "products", queryField: "simulationTypeId" },
    { name: "baseData", queryField: "simulationTypeId" },
    { name: "cashflowconfigs", queryField: "simulationTypeId" },
    { name: "balancesheetconfigs", queryField: "simulationTypeId" },
    { name: "events", queryField: "simulationTypeId" },
    { name: "pnlconfigs", queryField: "simulationTypeId" },
  ];

  const sourceClient = new MongoClient(sourceUri);
  const targetClient = new MongoClient(targetUri);

  try {
    await sourceClient.connect();
    await targetClient.connect();

    const sourceDb = sourceClient.db();
    const targetDb = targetClient.db();

    // Verify source exists
    const sourceSim = await sourceDb
      .collection("simulationTypes")
      .findOne({ _id: simTypeId });
    if (!sourceSim) {
      console.error(
        `\n\x1b[31m[ABORT] SimulationType ${simTypeId} DOES NOT EXIST in the source database.\x1b[0m`
      );
      process.exit(1);
    }

    // Check if target exists
    const targetSim = await targetDb
      .collection("simulationTypes")
      .findOne({ _id: simTypeId });

    if (targetSim) {
      console.log("\n\x1b[1m\x1b[33m" + "=".repeat(60) + "\x1b[0m");
      console.log(
        "\x1b[1m\x1b[41m\x1b[37m" +
          "  !!! ATTENTION: TARGET SIMULATION ALREADY EXISTS !!!  " +
          "\x1b[0m"
      );
      console.log("\x1b[1m\x1b[33m" + "=".repeat(60) + "\x1b[0m");
      console.log(`\n\x1b[1mTarget Database Simulation Type Info:\x1b[0m`);
      console.log(`- \x1b[36mName:\x1b[0m ${targetSim.name}`);
      console.log(`- \x1b[36mKey:\x1b[0m  ${targetSim.key}`);
      console.log(`- \x1b[36mDescription:\x1b[0m ${targetSim.description}`);
      console.log(`- \x1b[36mID:\x1b[0m   ${simTypeId}`);
      console.log(
        "\n\x1b[1m\x1b[31m" +
          "CAUTION: This will DELETE all related documents (Segments, Products, Configs, etc.)".toUpperCase() +
          "\x1b[0m"
      );
      console.log(
        "\x1b[1m\x1b[31m" +
          "in the TARGET database and REPLACE them with data from the SOURCE.".toUpperCase() +
          "\x1b[0m"
      );
      console.log("\x1b[1m\x1b[33m" + "=".repeat(60) + "\x1b[0m\n");

      const answer = await askQuestion(
        "\x1b[1m\x1b[35mType 'YES' (all caps) to confirm this OVERWRITE: \x1b[0m"
      );
      if (answer !== "YES") {
        console.log("\nUpdate cancelled by user.");
        process.exit(0);
      }
    } else {
      console.log(
        `\x1b[32mSimulationType ${simTypeId} does not exist in target. Proceeding with sync.\x1b[0m`
      );
    }

    console.log(`\nUpdating from: \x1b[34m${sourceUri}\x1b[0m`);
    console.log(`Updating to:   \x1b[34m${targetUri}\x1b[0m\n`);

    let totalDeleted = 0;
    let totalInserted = 0;

    for (const config of collectionsConfig) {
      const query = { [config.queryField]: simTypeId };

      // Fetch from source
      const sourceDocs = await sourceDb
        .collection(config.name)
        .find(query)
        .toArray();

      // Delete in target
      const delResult = await targetDb
        .collection(config.name)
        .deleteMany(query);
      totalDeleted += delResult.deletedCount;

      if (sourceDocs.length > 0) {
        const insResult = await targetDb
          .collection(config.name)
          .insertMany(sourceDocs);
        totalInserted += insResult.insertedCount;
        console.log(
          `\x1b[32m[REPLACED] ${config.name.padEnd(20)}: Deleted ${delResult.deletedCount}, Inserted ${insResult.insertedCount} docs.\x1b[0m`
        );
      } else {
        console.log(
          `\x1b[33m[  SKIP   ] ${config.name.padEnd(20)}: 0 documents found in source.\x1b[0m`
        );
      }
    }

    console.log(`\n\x1b[1m\x1b[32m` + "=".repeat(60) + "\x1b[0m");
    console.log(
      `\x1b[1m\x1b[32m✅ UPDATE COMPLETE: Simulation and related configs successfully replaced.\x1b[0m`
    );
    console.log(`Total documents deleted:  ${totalDeleted}`);
    console.log(`Total documents inserted: ${totalInserted}`);
    console.log(`\x1b[1m\x1b[32m` + "=".repeat(60) + "\x1b[0m\n");
  } catch (err) {
    console.error(
      "\n\x1b[31mAn error occurred during update procedure:\x1b[0m",
      err
    );
    process.exit(1);
  } finally {
    await sourceClient.close();
    await targetClient.close();
    rl.close();
  }
}

main();
