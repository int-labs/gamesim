/**
 * Where uploaded images actually live.
 *
 * The project shipped with Supabase as the only option and a hard `throw` at
 * import time if its two env vars were missing — so a dead or unconfigured
 * Supabase project took the whole API down, and image upload was broken for
 * every feature that needs it (team photos, member avatars, game-content art).
 *
 * There are now two drivers, chosen once at boot:
 *
 *   supabase — used when SUPABASE_URL and SUPABASE_KEY are both set.
 *   local    — writes to server/uploads/, which index.ts already serves at
 *              /uploads. This is the fallback, so a fresh clone can upload
 *              images without any third-party account.
 *
 * LOCAL IS NOT DURABLE ON RENDER. Container filesystems are ephemeral: an
 * upload survives until the next deploy or restart. It is right for local
 * development and for a demo; a real deployment should set the Supabase vars
 * (or swap in S3 here — this module is the only thing that would change).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

const SUPABASE_BUCKET = "imageAsset";
const UPLOAD_DIR = path.join(__dirname, "../../uploads");

export type StorageDriver = "supabase" | "local";

/**
 * Supabase's dashboard shows several URLs, and the one labelled for the API
 * ends in `/rest/v1/`. `createClient` wants the PROJECT base — it appends the
 * service path itself — so pasting the REST URL yields requests to
 * `…/rest/v1/rest/v1/…` that 404 with nothing useful in the message. Normalise
 * it here rather than making the next person diagnose it.
 */
const normaliseSupabaseUrl = (raw?: string): string | undefined => {
  if (!raw) return undefined;
  return raw.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
};

const SUPABASE_URL = normaliseSupabaseUrl(process.env.SUPABASE_URL);
const SUPABASE_KEY = process.env.SUPABASE_KEY?.trim();

let client: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  // `ws` is assigned to globalThis.WebSocket by the caller that needs realtime;
  // storage itself is plain HTTP and needs no such patching.
  client = createClient(SUPABASE_URL, SUPABASE_KEY);
}

export interface StorageHealth {
  driver: StorageDriver;
  durable: boolean;
  /** Why the driver is what it is. Shown to the operator when it isn't durable. */
  detail: string;
}

/**
 * ── CONFIGURATION IS NOT CAPABILITY ─────────────────────────────────────────
 * This used to report "supabase" the moment both env vars were present, with
 * no evidence the project on the other end existed. Credentials for a DELETED
 * project look exactly like credentials for a live one — the subdomain simply
 * stops resolving — so the console cheerfully displayed "durable: true" while
 * every single upload failed with "fetch failed". That is strictly worse than
 * the local fallback, which at least works.
 *
 * So the driver is now decided by asking Supabase a question, once, and
 * caching the answer. A configured-but-unreachable project degrades to local
 * disk and says exactly why, rather than accepting writes it cannot perform.
 *
 * The result is re-probed after a cooldown so that restoring the project (or
 * creating the missing bucket) recovers without restarting the API — but a
 * single network blip won't flap the driver on every request either.
 */
const REPROBE_AFTER_MS = 60_000;

const LOCAL_DETAIL =
  "Uploads are written to the server's local disk. On a container host they are lost on redeploy — set SUPABASE_URL and SUPABASE_KEY for durable storage.";

let cached: StorageHealth | null = null;
let cachedAt = 0;

async function probeSupabase(): Promise<StorageHealth> {
  if (!client) {
    return { driver: "local", durable: false, detail: LOCAL_DETAIL };
  }

  try {
    // Cheapest call that touches both DNS and the bucket: if the project is
    // gone this rejects, and if the bucket is missing it returns an error.
    const { error } = await client.storage.from(SUPABASE_BUCKET).list("", { limit: 1 });
    if (error) throw new Error(error.message);
    return { driver: "supabase", durable: true, detail: "Uploads go to Supabase storage." };
  } catch (err: any) {
    const reason = String(err?.message ?? err);
    // "fetch failed" is undici's message for a host that doesn't resolve — the
    // signature of a project that was deleted rather than merely paused.
    const gone = /fetch failed|ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(reason);
    const detail = gone
      ? `Supabase is configured but the project at ${SUPABASE_URL} is unreachable (${reason}). Uploads are falling back to the server's local disk, which is lost on redeploy.`
      : `Supabase is configured but the "${SUPABASE_BUCKET}" bucket could not be read (${reason}). Uploads are falling back to the server's local disk, which is lost on redeploy.`;
    console.warn(`[storage] ${detail}`);
    return { driver: "local", durable: false, detail };
  }
}

/** The driver that will actually be used, verified rather than assumed. */
export async function resolveStorage(): Promise<StorageHealth> {
  const now = Date.now();
  if (cached && now - cachedAt < REPROBE_AFTER_MS) return cached;
  cached = await probeSupabase();
  cachedAt = now;
  return cached;
}

/**
 * Synchronous best guess, for callers that genuinely cannot await. Prefer
 * `resolveStorage()` — this one can claim "supabase" before the first probe.
 */
export const activeDriver = (): StorageDriver =>
  cached ? cached.driver : client ? "supabase" : "local";

/**
 * Absolute base for locally-served files. The player app runs on a different
 * origin from the API, so a relative "/uploads/…" would resolve against the
 * wrong host — these have to be absolute.
 */
const publicBaseUrl = (): string => {
  const configured = process.env.PUBLIC_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  return `http://localhost:${process.env.PORT ?? 5000}`;
};

/** Guard against a key escaping the upload directory. */
const safeKey = (key: string): string => {
  const base = path.basename(key);
  if (!base || base === "." || base === "..") throw new Error("Invalid object key.");
  return base;
};

/**
 * Store `buffer` under `key` and return the URL it can be fetched from.
 *
 * `contentType` matters: an SVG served as "image/*" is refused inline by
 * browsers, which is what generated avatars are.
 */
export async function putObject(
  buffer: Buffer,
  key: string,
  contentType = "application/octet-stream"
): Promise<string> {
  const name = safeKey(key);
  const { driver } = await resolveStorage();

  if (driver === "supabase" && client) {
    const { error } = await client.storage
      .from(SUPABASE_BUCKET)
      .upload(name, buffer, { contentType, upsert: false });
    if (error) throw new Error(`Upload failed: ${error.message}`);

    const { data } = client.storage.from(SUPABASE_BUCKET).getPublicUrl(name);
    return data.publicUrl;
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, name), buffer);
  return `${publicBaseUrl()}/uploads/${encodeURIComponent(name)}`;
}

/** Remove a stored object. A missing file is not an error — the caller is
 *  deleting the record either way, and a half-deleted pair helps nobody. */
export async function deleteObject(key: string): Promise<void> {
  const name = safeKey(key);
  const { driver } = await resolveStorage();

  if (driver === "supabase" && client) {
    const { error } = await client.storage.from(SUPABASE_BUCKET).remove([name]);
    if (error) throw new Error(`Delete failed: ${error.message}`);
    return;
  }

  await unlink(path.join(UPLOAD_DIR, name)).catch((err) => {
    if (err?.code !== "ENOENT") throw err;
  });
}

/** Back-compat aliases for the original constants/supabase.ts API. */
export const uploadImage = putObject;
export const deleteImage = deleteObject;
