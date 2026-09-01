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

/**
 * THERE IS NO DEFAULT BUCKET, deliberately.
 *
 * Storage is partitioned by simulation type — `JournalSim` for player-facing
 * art, `imageAssets` for private key assets, more as further simulations are
 * built. There is no bucket that is right to guess, so a caller that names none
 * gets an error rather than having a file filed somewhere arbitrary. A wrong
 * default is worse than a refusal: it succeeds, and the misfiling is only
 * discovered later by whoever cannot find the asset.
 */
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

/**
 * A dead project fails fast — undici reports "fetch failed" as soon as DNS
 * gives up — but a PAUSED or merely unresponsive one leaves the request open,
 * and the storage client sets no deadline of its own. Without this bound the
 * probe never settles, so `resolveStorage()` never resolves and every caller
 * awaiting it hangs: the upload route, and `GET /image-assets/storage`, which
 * holds the socket open and answers nothing.
 *
 * An unreachable project is exactly the case this module exists to degrade
 * gracefully, so a timeout is treated as unhealthy, not as an error.
 */
const PROBE_TIMEOUT_MS = 5_000;

/** Reject if `p` has not settled within `ms`. The timer is always cleared, so a
 *  slow-but-successful probe cannot leave a handle keeping the process alive. */
async function withTimeout<T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const LOCAL_DETAIL =
  "Uploads are written to the server's local disk. On a container host they are lost on redeploy — set SUPABASE_URL and SUPABASE_KEY for durable storage.";

let cached: StorageHealth | null = null;
let cachedAt = 0;

async function probeSupabase(): Promise<StorageHealth> {
  if (!client) {
    return { driver: "local", durable: false, detail: LOCAL_DETAIL };
  }

  try {
    // `listBuckets()`, NOT `from(bucket).list()`.
    //
    // The latter was chosen as "the cheapest call that touches both DNS and the
    // bucket", on the belief that a missing bucket returns an error. It does
    // not — it answers `{ error: null, data: [] }` for any name at all,
    // including one that has never existed. So the probe reported a healthy,
    // durable driver for a bucket that was not there, and the "bucket could not
    // be read" branch below was unreachable.
    //
    // Health is now what it can actually establish: the project resolves, the
    // credentials work, and the storage API answers. WHICH bucket an upload
    // targets is validated per-upload against `listBuckets()`, which is the
    // authoritative check — and the right place for it, since buckets are
    // partitioned by simulation type and there is no single "the" bucket.
    const { error } = await withTimeout(
      client.storage.listBuckets(),
      PROBE_TIMEOUT_MS,
      "Supabase storage probe",
    );
    if (error) throw new Error(error.message);
    return { driver: "supabase", durable: true, detail: "Uploads go to Supabase storage." };
  } catch (err: any) {
    const reason = String(err?.message ?? err);
    // "fetch failed" is undici's message for a host that doesn't resolve — the
    // signature of a project that was deleted rather than merely paused. A
    // TIMEOUT is its own case: the host answered nothing at all, which says
    // nothing about whether the bucket exists, so it must not be reported as a
    // bucket problem.
    const timedOut = /timed out/i.test(reason);
    const gone = /fetch failed|ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(reason);
    const detail = timedOut
      ? `Supabase is configured but the project at ${SUPABASE_URL} did not respond within ${PROBE_TIMEOUT_MS}ms (${reason}). Uploads are falling back to the server's local disk, which is lost on redeploy.`
      : gone
      ? `Supabase is configured but the project at ${SUPABASE_URL} is unreachable (${reason}). Uploads are falling back to the server's local disk, which is lost on redeploy.`
      : `Supabase is configured but its storage API could not be read (${reason}). Uploads are falling back to the server's local disk, which is lost on redeploy.`;
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

export interface StorageBucket {
  name: string;
  /** A private bucket's public URL resolves to nothing the player can load. */
  public: boolean;
}

/**
 * The buckets an upload may target.
 *
 * Empty on the local driver — local disk has no buckets, and returning a
 * fabricated one would let the console offer a choice that means nothing. The
 * caller should read that emptiness as "no choice to make", not as a failure.
 */
export async function listBuckets(): Promise<StorageBucket[]> {
  const { driver } = await resolveStorage();
  if (driver !== "supabase" || !client) return [];

  const { data, error } = await withTimeout(
    client.storage.listBuckets(),
    PROBE_TIMEOUT_MS,
    "Supabase bucket list",
  );
  if (error) throw new Error(error.message);

  return (data ?? []).map((b: any) => ({ name: b.name, public: Boolean(b.public) }));
}

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
  contentType: string,
  /** Required. No fallback exists — see the note at the top of this file. */
  bucket: string
): Promise<string> {
  const name = safeKey(key);
  const target = bucket?.trim();
  if (!target) throw new Error("A storage bucket is required; there is no default.");
  const { driver } = await resolveStorage();

  if (driver === "supabase" && client) {
    const { error } = await client.storage
      .from(target)
      .upload(name, buffer, { contentType, upsert: false });
    if (error) throw new Error(`Upload failed: ${error.message}`);

    const { data } = client.storage.from(target).getPublicUrl(name);
    return data.publicUrl;
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, name), buffer);
  return `${publicBaseUrl()}/uploads/${encodeURIComponent(name)}`;
}

/** Remove a stored object. A missing file is not an error — the caller is
 *  deleting the record either way, and a half-deleted pair helps nobody. */
/**
 * Is `key` actually in `bucket`?
 *
 * Worth asking before a delete, because Supabase's `remove()` does NOT error on
 * a missing object — it reports success having removed nothing. Without this
 * check the console would happily drop the database row for a file that is
 * still sitting in some other bucket, and the only pointer to it goes with it.
 *
 * Always true on the local driver, where the delete path tolerates a missing
 * file already.
 */
export async function objectExists(key: string, bucket: string): Promise<boolean> {
  const name = safeKey(key);
  const target = bucket?.trim();
  if (!target) return false;
  const { driver } = await resolveStorage();
  if (driver !== "supabase" || !client) return true;

  const { data, error } = await withTimeout(
    client.storage.from(target).list("", { search: name, limit: 1 }),
    PROBE_TIMEOUT_MS,
    "Supabase object lookup",
  );
  if (error) throw new Error(error.message);
  return (data ?? []).some((o: any) => o.name === name);
}

export async function deleteObject(key: string, bucket: string): Promise<void> {
  const name = safeKey(key);
  // MUST match the bucket the object was written to. Guessing would delete from
  // the wrong bucket — silently leaving the real object behind while reporting
  // success — so an unknown bucket is refused instead.
  const target = bucket?.trim();
  if (!target) throw new Error("A storage bucket is required; there is no default.");
  const { driver } = await resolveStorage();

  if (driver === "supabase" && client) {
    const { error } = await client.storage.from(target).remove([name]);
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
