import MongooseTsgen from "mongoose-tsgen";

async function run() {
  const tsgen = new MongooseTsgen();
  await tsgen.generateDefinitions({
    flags: {
      "dry-run": false,
      "no-format": false,
      "no-mongoose": true,
      "no-populate-overload": false,
      "dates-as-strings": true,
      debug: false,
      output: "../client/src/interfaces",
      //   project: "../tsconfig.json",
      project: "../client/tsconfig.json",
    },
    args: {
      model_path: "../server/src/models/**/*.ts", // optional
    },
  });
}

run();
