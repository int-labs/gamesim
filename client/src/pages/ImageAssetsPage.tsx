import { useEffect, useState, useRef } from "react";
import { Alert, Button, Card, DataTable, Heading, LinkButton, PageHeader, Select, Text, type DataTableColumn } from "@stratagem/design-system";
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
    <>
      <PageHeader title="Image Assets" />
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="warning">{notice}</Alert>}

      {/* Storage banner, shown in both states so a healthy check is distinguishable from no check */}
      {storage ? (
        <Alert tone={storage.durable ? "success" : "warning"}>
          <strong>Storage: {storage.driver}</strong>
          {storage.durable ? " · durable" : " · NOT durable"} — {storage.message}
        </Alert>
      ) : (
        <Alert tone="warning">Storage status unavailable — uploads may not be durable.</Alert>
      )}

      <Card>
        <Heading level={3}>Upload</Heading>

        {/* Bucket sits above the file input and is hidden on the local driver, which has no buckets */}
        {buckets.length > 0 && (
          <Select
            label="Bucket"
            placeholder="Select a bucket…"
            options={buckets.map(b => ({ value: b.name, label: `${b.name}${b.public ? "" : " (private)"}` }))}
            value={bucket || null}
            onValueChange={v => setBucket(v ?? "")}
            description={
              // A private bucket's public URL does not load in the player app
              buckets.find((b) => b.name === bucket && !b.public)
                ? <Text as="span" tone="warning">This bucket is private — its URLs will not load in the player app.</Text>
                : undefined
            }
          />
        )}

        <div className="flex flex-wrap items-center gap-4">
          {/* The design system has no file picker, so the native input stays */}
          <input type="file" ref={fileRef} accept="image/png,image/jpeg,image/webp" className="type-body" />
          <Button onClick={handleUpload} disabled={uploading || (buckets.length > 0 && !bucket)}>
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
        <Text variant="caption" tone="muted">PNG / JPEG / WebP only. Max 5 MB.</Text>
      </Card>

      <Card>
        <Heading level={3}>All Image Assets</Heading>
        <DataTable
          label="All Image Assets"
          columns={COLUMNS}
          rows={rows}
          rowKey={r => r.image_id}
          rowActions={r => <Button variant="text" tone="danger" onClick={() => handleDelete(r.image_id)}>Delete</Button>}
        />
      </Card>
    </>
  );
}

const COLUMNS: DataTableColumn<ImageAsset>[] = [
  { id: "image_id", header: "image_id", cell: r => r.image_id },
  { id: "filename", header: "filename", cell: r => r.filename, primary: true },
  { id: "preview", header: "Preview", cell: r => <img src={r.url} alt={r.filename} className="max-h-12 max-w-20" /> },
  { id: "url", header: "URL", cell: r => <LinkButton variant="text" href={r.url} target="_blank" rel="noreferrer">open</LinkButton> },
];
