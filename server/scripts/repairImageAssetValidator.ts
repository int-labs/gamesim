/**
 * Bring the `imageAssets` collection validator in line with the model.
 *
 * The collection carries a server-side `$jsonSchema` requiring `mimeType` and
 * `data` — fields from an older design that stored image bytes inside MongoDB.
 * The code moved to object storage and writes `image_id`, `filename` and `url`
 * instead, but the validator was never updated, so **every** upload was
 * rejected with "Document failed validation" regardless of the storage backend.
 *
 * That is why image upload appeared to be purely a Supabase problem: it was
 * broken twice over, and fixing the storage driver alone would not have
 * surfaced this until the first successful write attempt.
 *
 *   npm run repair-images
 *
 * Idempotent, and prints the before/after schema.
 */
import mongoose from "mongoose";
import connectToDatabase from "../src/db/db";

const COLLECTION = "imageAssets";

const NEXT_SCHEMA = {
  $jsonSchema: {
    bsonType: "object",
    required: ["image_id", "filename", "url"],
    properties: {
      image_id: { bsonType: "string" },
      filename: { bsonType: "string" },
      url: { bsonType: "string" },
      // Added when storage became pluggable — the key the object lives under,
      // kept separately because it now carries a file extension.
      storageKey: { bsonType: "string" },
      contentType: { bsonType: "string" },
      size: { bsonType: ["int", "long", "double"] },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
    },
  },
};

async function main() {
  await connectToDatabase();
  const db = mongoose.connection.db!;

  const existing: any[] = await db.listCollections({ name: COLLECTION }).toArray();
  if (existing.length === 0) {
    // No collection yet: create it with the right validator rather than
    // letting the first insert create one with none.
    await db.createCollection(COLLECTION, {
      validator: NEXT_SCHEMA,
      validationLevel: "strict",
      validationAction: "error",
    });
    console.log(`Created "${COLLECTION}" with a current validator.`);
    await mongoose.connection.close();
    return;
  }

  const before = existing[0]?.options?.validator?.$jsonSchema;
  console.log("before:", JSON.stringify(before?.required ?? null));

  await db.command({
    collMod: COLLECTION,
    validator: NEXT_SCHEMA,
    validationLevel: "strict",
    validationAction: "error",
  });

  const after: any[] = await db.listCollections({ name: COLLECTION }).toArray();
  console.log("after: ", JSON.stringify(after[0]?.options?.validator?.$jsonSchema?.required));
  console.log(`\nValidator on "${COLLECTION}" now matches the model.`);

  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error(err?.message ?? err);
  await mongoose.connection.close().catch(() => undefined);
  process.exit(1);
});
