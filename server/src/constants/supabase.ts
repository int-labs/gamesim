/**
 * Kept as a thin re-export so existing imports keep working.
 *
 * The implementation moved to `services/storage.ts`, which chooses between
 * Supabase and local disk instead of throwing at import time when the Supabase
 * env vars are absent. That throw meant an unconfigured — or, as happened
 * here, a deleted — Supabase project took the whole API down on boot, even
 * though storage is used by exactly one route.
 *
 * New code should import from `services/storage` directly.
 */
export {
  uploadImage,
  deleteImage,
  putObject,
  deleteObject,
  activeDriver,
} from "../services/storage";
export type { StorageDriver } from "../services/storage";
