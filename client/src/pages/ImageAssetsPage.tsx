import { useEffect, useState, useRef } from "react";
import {
  getImageAssets,
  uploadImageAsset,
  deleteImageAsset,
  getStorageStatus,
  getStorageBuckets,
} from "../api";
import type { ImageAsset } from "../types";

interface StorageStatus {
  driver: "supabase" | "local";
  durable: boolean;
  message: string;
}

export default function ImageAssetsPage() {
  const [rows, setRows] = useState<ImageAsset[]>([]);
  const [error, setError] = useState("");
  // Not an error: something succeeded but not in the way the label implies —
  // e.g. a record cleaned up when its file was already gone.
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  // Null while unknown — an unknown driver must not read as a healthy one.
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [buckets, setBuckets] = useState<{ name: string; public: boolean }[]>([]);
  const [bucket, setBucket] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const res = await getImageAssets();
      setRows(res.data?.data ?? res.data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  /**
   * Where uploads will actually go. The server verifies this against Supabase
   * rather than inferring it from env vars, so a configured-but-unreachable
   * project reports `local` — and every URL saved from such an upload dies on
   * the next redeploy. Checked before the operator uploads, not after.
   */
  const loadStorage = async () => {
    try {
      const res = await getStorageStatus();
      setStorage(res.data);
    } catch {
      // Deliberately silent: a failed check must not block uploading, and the
      // banner already treats "unknown" as not-durable.
      setStorage(null);
    }
  };

  const loadBuckets = async () => {
    try {
      const res = await getStorageBuckets();
      setBuckets(res.data.buckets ?? []);
      // Deliberately NOT pre-selected. There is no default bucket, and quietly
      // picking the first one would put a file somewhere the operator never
      // chose — the exact misfiling the server now refuses.
    } catch {
      setBuckets([]);
    }
  };

  useEffect(() => { load(); loadStorage(); loadBuckets(); }, []);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Select a file first"); return; }
    // Mirrors the server's refusal, so the operator is told before the file is
    // read rather than after a round trip.
    if (buckets.length > 0 && !bucket) { setError("Choose a bucket first"); return; }
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("image", file);
      // Omitted when there is no choice (local driver), so the server applies
      // its own default rather than receiving an empty string.
      if (bucket) fd.append("bucket", bucket);
      await uploadImageAsset(fd);
      if (fileRef.current) fileRef.current.value = "";
      // Re-check: the server re-probes on a cooldown, so the driver can differ
      // from what the banner showed when the page loaded.
      await Promise.all([load(), loadStorage()]);
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (image_id: string) => {
    if (!confirm("Delete this image asset?")) return;
    try {
      const res = await deleteImageAsset(image_id);
      await load();
      // A record whose file was already gone is cleaned up rather than refused,
      // so this is a success — but say so, because "deleted" would imply a file
      // was removed when none was found.
      const data: any = res.data;
      setError("");
      setNotice(data?.fileDeleted === false ? data.message ?? "" : "");
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  return (
    <div>
      <h2>Image Assets</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {notice && <p style={{ color: "#8a4a00" }}>{notice}</p>}

      {/* Storage banner. Shown for BOTH states on purpose: silence when healthy
          would make the durable case indistinguishable from the check never
          having run — which is how uploads previously went to local disk with
          nobody the wiser. */}
      {storage ? (
        <p
          style={{
            padding: "6px 10px",
            border: `1px solid ${storage.durable ? "#3a7" : "#c60"}`,
            background: storage.durable ? "#eefaf3" : "#fff6e8",
            color: storage.durable ? "#264" : "#8a4a00",
            fontSize: 13,
          }}
        >
          <strong>Storage: {storage.driver}</strong>
          {storage.durable ? " · durable" : " · NOT durable"} — {storage.message}
        </p>
      ) : (
        <p style={{ fontSize: 13, color: "#8a4a00" }}>
          Storage status unavailable — uploads may not be durable.
        </p>
      )}

      <h3>Upload</h3>

      {/* Bucket choice sits ABOVE the file input: it decides where the file
          lands, so it has to be settled before one is picked. Hidden entirely
          on the local driver, where buckets do not exist and an empty dropdown
          would just raise a question with no answer. */}
      {buckets.length > 0 && (
        <p style={{ margin: "0 0 8px" }}>
          <label>
            Bucket{" "}
            <select value={bucket} onChange={(e) => setBucket(e.target.value)}>
              <option value="">Select a bucket…</option>
              {buckets.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                  {b.public ? "" : " (private)"}
                </option>
              ))}
            </select>
          </label>
          {/* A private bucket's public URL resolves to nothing the player app
              can load, so the consequence is stated where the choice is made. */}
          {buckets.find((b) => b.name === bucket && !b.public) && (
            <span style={{ marginLeft: 8, fontSize: 12, color: "#8a4a00" }}>
              This bucket is private — its URLs will not load in the player app.
            </span>
          )}
        </p>
      )}

      <input type="file" ref={fileRef} accept="image/png,image/jpeg,image/webp" />
      {" "}
      <button onClick={handleUpload} disabled={uploading || (buckets.length > 0 && !bucket)}>
        {uploading ? "Uploading…" : "Upload"}
      </button>
      <p style={{ fontSize: 12, color: "#666" }}>PNG / JPEG / WebP only. Max 5 MB.</p>

      <h3>All Image Assets</h3>
      <table border={1} cellPadding={4}>
        <thead>
          <tr><th>image_id</th><th>filename</th><th>Preview</th><th>URL</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.image_id}>
              <td>{r.image_id}</td>
              <td>{r.filename}</td>
              <td>
                <img src={r.url} alt={r.filename} style={{ maxHeight: 48, maxWidth: 80 }} />
              </td>
              <td><a href={r.url} target="_blank" rel="noreferrer">open</a></td>
              <td><button onClick={() => handleDelete(r.image_id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
