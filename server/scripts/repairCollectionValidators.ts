/**
 * Reconcile the MongoDB collection validators with the Mongoose models.
 *
 * Several collections carry a server-side `$jsonSchema` written for an older
 * shape. MongoDB enforces those independently of Mongoose, so a write that is
 * perfectly valid to the application is rejected by the database with the
 * unhelpful message "Document failed validation" — no field name, no reason.
 *
 *   npm run repair-validators          # apply
 *   npm run repair-validators -- --dry # report only
 *
 * Three kinds of repair happen here.
 *
 * ── 1. Numeric widening (every collection) ──────────────────────────────────
 * BSON encodes a whole number that fits in 32 bits as `int` and everything
 * else as `double`. Which one you get is an encoding detail of the value, not
 * a property of the field: `costConsumption: 250` arrives as an int and
 * `250.5` as a double. A validator that pins such a field to `double` alone
 * therefore rejects every round number — which is exactly why an initiative
 * could never be created from the console, while nothing in the application
 * logs said so. Any field already declared as some subset of int/long/double
 * is widened to accept all three.
 *
 * ── 2. Explicit nulls (every collection) ────────────────────────────────────
 * Mongoose writes `null` — it does not omit — for any path declared with
 * `default: null`. JSON Schema counts null as its own bsonType, so a
 * `{ bsonType: "string" }` optional field rejects the document Mongoose
 * actually produces. `Initiative.details` is the case that surfaced it:
 * creating an initiative WITH a description worked and creating one WITHOUT
 * failed, which looks like nonsense until you know that leaving the field
 * blank is precisely what writes the null. Optional properties now accept it;
 * required ones do not, because there a null is a real error.
 *
 * ── 3. Named corrections (below) ────────────────────────────────────────────
 * Places where the declared type or `required` list contradicts the model.
 * Each entry says what the model actually does.
 *
 * What this deliberately does NOT do is change `validationLevel` or
 * `validationAction`. Several collections are on `warn`, which is how a wrong
 * validator has been surviving unnoticed; tightening them to `error` in the
 * same pass would turn a silent log line into a live outage. Correct the
 * schema first, decide about enforcement separately.
 *
 * Idempotent: re-running with nothing to fix reports "already current".
 */
import mongoose from "mongoose";
import connectToDatabase from "../src/db/db";

type JsonSchema = {
  bsonType?: string | string[];
  required?: string[];
  properties?: Record<string, any>;
  [k: string]: any;
};

const NUMERIC = ["int", "long", "double"] as const;
const NUMERIC_SET = new Set<string>(NUMERIC);

/** Per-collection fixes, applied on top of the numeric widening. */
const CORRECTIONS: Record<
  string,
  { why: string; apply: (schema: JsonSchema) => void }
> = {
  products: {
    why: '`active` is declared "string" but the model is `{ type: Boolean }`',
    apply: (s) => {
      if (s.properties?.active) s.properties.active = { bsonType: "bool" };
    },
  },

  simulations: {
    why: "`status` is required but was never declared, and simulationTypeId/config were missing entirely",
    apply: (s) => {
      s.properties = s.properties ?? {};
      s.properties.status = {
        bsonType: "string",
        enum: ["Active", "Inactive", "Completed"],
      };
      s.properties.simulationTypeId = { bsonType: "objectId" };
      // `config` holds totalRounds/currRounds and is Mixed in the model.
      s.properties.config = { bsonType: "object" };
    },
  },

  decisions: {
    why: "productId/segmentId live inside inputs[], not at the top level, and inputs is an array",
    apply: (s) => {
      s.required = (s.required ?? []).filter(
        (k) => k !== "productId" && k !== "segmentId"
      );
      if (s.properties) {
        delete s.properties.productId;
        delete s.properties.segmentId;
        s.properties.inputs = { bsonType: "array" };
      }
    },
  },

  paramList: {
    why: "`parameters` is declared an object but the model is an ARRAY of parameter subdocuments",
    apply: (s) => {
      if (s.properties) s.properties.parameters = { bsonType: ["array", "null"] };
    },
  },

  drivers: {
    why: "a driver hangs off a product only — the model has no segmentId",
    apply: (s) => {
      if (s.properties) delete s.properties.segmentId;
    },
  },
};

/** Widen any int/long/double field to accept all three encodings. */
function widenNumerics(schema: JsonSchema): string[] {
  const widened: string[] = [];
  for (const [key, prop] of Object.entries(schema.properties ?? {})) {
    const t = prop?.bsonType;
    const types = Array.isArray(t) ? t : typeof t === "string" ? [t] : [];
    if (types.length === 0 || !types.every((x) => NUMERIC_SET.has(x))) continue;
    if (types.length === NUMERIC.length) continue; // already permissive
    prop.bsonType = [...NUMERIC];
    widened.push(key);
  }
  return widened;
}

/**
 * Let every optional property be null.
 *
 * Mongoose does not omit a path declared `{ type: String, default: null }` —
 * it writes an explicit `null`. JSON Schema treats null as its own bsonType,
 * so `{ bsonType: "string" }` rejects that document, and the only clue is
 * "Document failed validation" with no field named.
 *
 * `Initiative.details` is exactly this: creating an initiative WITH a
 * description succeeded and creating one WITHOUT it failed, which reads as
 * random until you know that omitting the field is what writes the null.
 *
 * Required properties are left alone — a required field being null is a real
 * error worth catching.
 */
function allowNullOnOptional(schema: JsonSchema): string[] {
  const required = new Set(schema.required ?? []);
  const relaxed: string[] = [];

  for (const [key, prop] of Object.entries(schema.properties ?? {})) {
    if (required.has(key)) continue;
    const t = prop?.bsonType;
    const types = Array.isArray(t) ? [...t] : typeof t === "string" ? [t] : [];
    if (types.length === 0 || types.includes("null")) continue;
    prop.bsonType = [...types, "null"];
    relaxed.push(key);
  }

  return relaxed;
}

async function main() {
  const dryRun = process.argv.includes("--dry");

  await connectToDatabase();
  const db = mongoose.connection.db!;

  const collections: any[] = await db.listCollections().toArray();
  let changed = 0;
  let untouched = 0;

  for (const col of collections) {
    const schema: JsonSchema | undefined = col.options?.validator?.$jsonSchema;
    if (!schema) continue;

    const next: JsonSchema = JSON.parse(JSON.stringify(schema));
    const notes: string[] = [];

    const widened = widenNumerics(next);
    if (widened.length > 0) {
      notes.push(`numeric: ${widened.join(", ")}`);
    }

    const nullable = allowNullOnOptional(next);
    if (nullable.length > 0) {
      notes.push(`nullable (Mongoose writes explicit nulls): ${nullable.join(", ")}`);
    }

    const correction = CORRECTIONS[col.name];
    if (correction) {
      correction.apply(next);
      if (JSON.stringify(next) !== JSON.stringify(schema) || (widened.length === 0 && nullable.length === 0)) {
        notes.push(correction.why);
      }
    }

    if (JSON.stringify(next) === JSON.stringify(schema)) {
      untouched++;
      continue;
    }

    changed++;
    console.log(`\n${col.name}`);
    for (const n of notes) console.log(`  · ${n}`);

    if (dryRun) continue;

    await db.command({
      collMod: col.name,
      validator: { $jsonSchema: next },
      // Enforcement is left exactly as it was — see the header.
      validationLevel: col.options.validationLevel ?? "strict",
      validationAction: col.options.validationAction ?? "error",
    });
  }

  console.log(
    `\n${dryRun ? "Would repair" : "Repaired"} ${changed} validator${changed === 1 ? "" : "s"}; ` +
      `${untouched} already current.`
  );

  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error(err?.message ?? err);
  await mongoose.connection.close().catch(() => undefined);
  process.exit(1);
});
