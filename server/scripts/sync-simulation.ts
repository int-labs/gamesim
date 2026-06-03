import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";

dotenv.config();

async function main() {
  const sourceUri = process.env.SOURCE_MONGO_URI || process.env.MONGO_URI;
  const targetUri =
    process.env.TARGET_MONGO_URI || process.env.PROD_MONGO_URI_WITH_DB;
  const simulationTypeIdArg = process.argv[2];

  console.log("simTypeIdArg", simulationTypeIdArg);

  if (!sourceUri || !targetUri) {
    console.error(
      "ERROR: Source and Target Mongo URIs must be set in your .env or shell."
    );
    console.error(
      "The script looks for 'SOURCE_MONGO_URI' (fallback: 'MONGO_URI')"
    );
    console.error(
      "And 'TARGET_MONGO_URI' (fallback: 'PROD_MONGO_URI_WITH_DB')"
    );
    console.error("Example:");
    console.error(
      '  export SOURCE_MONGO_URI="mongodb://localhost:27017/stratagem"'
    );
    console.error(
      '  export TARGET_MONGO_URI="mongodb+srv://user:pass@cluster.mongodb.net/prod_db"'
    );
    process.exit(1);
  }

  if (!simulationTypeIdArg) {
    console.error(
      "ERROR: Please provide the SimulationType ID to sync as an argument."
    );
    console.error("Example: npm run sync-sim -- 60d5ecb54d6a123f1c1a2b3c");
    process.exit(1);
  }

  let simTypeId: ObjectId | null = null;
  try {
    simTypeId = new ObjectId(simulationTypeIdArg);
  } catch (err) {
    console.error(
      "ERROR: Provided SimulationType ID is not a valid MongoDB ObjectId."
    );
    process.exit(1);
    return;
  }
  const safeSimTypeId = simTypeId as ObjectId;

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

  console.log(`\nConnecting to databases...`);
  const sourceClient = new MongoClient(sourceUri);
  const targetClient = new MongoClient(targetUri);

  try {
    await sourceClient.connect();
    await targetClient.connect();
    console.log("Found both databases.");

    const sourceDb = sourceClient.db();
    const targetDb = targetClient.db();

    // STRICT PRE-FLIGHT CHECK
    const existingSim = await targetDb
      .collection("simulationTypes")
      .findOne({ _id: safeSimTypeId });
    if (existingSim) {
      console.error(
        `\n[ABORT] SimulationType with ID ${safeSimTypeId.toHexString()} ALREADY EXISTS in the target database!`
      );
      console.error(
        `This script strictly appends data and prohibits overwriting. Aborting to prevent potential data corruption.`
      );
      process.exit(1);
    }

    const verifySourceSim = await sourceDb
      .collection("simulationTypes")
      .findOne({ _id: safeSimTypeId });
    if (!verifySourceSim) {
      console.error(
        `\n[ABORT] SimulationType with ID ${safeSimTypeId.toHexString()} DOES NOT EXIST in the source database.`
      );
      process.exit(1);
      return; // Added return for typescript inference
    }

    console.log(`\nTarget SimulationType verified: "${verifySourceSim.name}"`);
    console.log(
      `Initiating exact-parity cloning. Upserts & replacements are disabled. Strict append mode active.\n`
    );

    let totalInserted = 0;

    for (const config of collectionsConfig) {
      const query = { [config.queryField]: safeSimTypeId };
      const documents = await sourceDb
        .collection(config.name)
        .find(query)
        .toArray();

      if (documents.length === 0) {
        console.log(`[ ] ${config.name.padEnd(20)}: 0 documents found.`);
        continue;
      }

      const info = await targetDb
        .collection(config.name)
        .insertMany(documents, { ordered: false });
      totalInserted += info.insertedCount;
      console.log(
        `[+] ${config.name.padEnd(20)}: Successfully inserted ${info.insertedCount} documents.`
      );
    }

    console.log(`\n======================================================`);
    console.log(`✅ SYNC COMPLETE: SimulationType successfully promoted.`);
    console.log(`Total exact-parity documents inserted: ${totalInserted}`);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error("An error occurred during synchronization:", err);
    process.exit(1);
  } finally {
    await sourceClient.close();
    await targetClient.close();
  }
}

main();
