import { useEffect, useState, useRef } from "react";
import { getImageAssets, uploadImageAsset, deleteImageAsset } from "../api";
import type { ImageAsset } from "../types";

export default function ImageAssetsPage() {
  const [rows, setRows] = useState<ImageAsset[]>([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const res = await getImageAssets();
      setRows(res.data?.data ?? res.data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Select a file first"); return; }
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("image", file);
      await uploadImageAsset(fd);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (image_id: string) => {
    if (!confirm("Delete this image asset?")) return;
    try {
      await deleteImageAsset(image_id);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  return (
    <div>
      <h2>Image Assets</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <h3>Upload</h3>
      <input type="file" ref={fileRef} accept="image/png,image/jpeg,image/webp" />
      {" "}
      <button onClick={handleUpload} disabled={uploading}>
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
