import { AlertTriangle, HardDrive, Upload } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { useStorageStatus, useUploadImageAssets } from "@/lib/api-hooks";
import { cn } from "@/lib/utils";

const ACCEPT = "image/png,image/jpeg,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Drop zone + file picker for image assets.
 *
 * Type and size are checked here as well as on the server. That is not
 * belt-and-braces for its own sake: a 40 MB file rejected in the browser never
 * leaves the machine, where the same file rejected by multer costs the whole
 * upload first.
 */
export function ImageUploader() {
  const upload = useUploadImageAssets();
  const { data: storage } = useStorageStatus();
  const [dragging, setDragging] = React.useState(false);
  const [rejected, setRejected] = React.useState<string[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);
  // Drag events fire per descendant; count enter/leave so moving over a child
  // doesn't flicker the highlight off.
  const depth = React.useRef(0);

  const take = (list: FileList | null) => {
    if (!list?.length) return;
    const files: File[] = [];
    const bad: string[] = [];

    for (const f of Array.from(list)) {
      if (!ACCEPT.split(",").includes(f.type)) bad.push(`${f.name} — only PNG, JPEG and WebP`);
      else if (f.size > MAX_BYTES) bad.push(`${f.name} — larger than 5 MB`);
      else files.push(f);
    }

    setRejected(bad);
    if (files.length) upload.mutate(files);
  };

  return (
    <div className="mb-5 space-y-3">
      {storage && !storage.durable && (
        <div className="flex items-start gap-3 rounded-lg bg-warning-tint p-3">
          <HardDrive className="mt-px size-4 shrink-0 text-warning" />
          <p className="text-[12.5px] leading-4 text-warning">
            <span className="font-semibold">Uploads are stored on the server's local disk.</span>{" "}
            That is fine locally, but on a container host they are lost on redeploy. Set{" "}
            <code className="font-mono">SUPABASE_URL</code> and{" "}
            <code className="font-mono">SUPABASE_KEY</code> for durable storage.
          </p>
        </div>
      )}

      <div
        onDragEnter={(e) => {
          e.preventDefault();
          depth.current += 1;
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          depth.current -= 1;
          if (depth.current <= 0) setDragging(false);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          depth.current = 0;
          setDragging(false);
          take(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-card border-2 border-dashed p-8 text-center transition-colors",
          dragging ? "border-primary bg-accent" : "border-border bg-card"
        )}
      >
        <Upload
          className={cn(
            "mx-auto size-7 transition-colors",
            dragging ? "text-primary" : "text-muted-foreground"
          )}
        />
        <p className="mt-3 text-[14px] font-semibold text-foreground">
          {dragging ? "Drop to upload" : "Drag images here"}
        </p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          PNG, JPEG or WebP · up to 5 MB each
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          onChange={(e) => {
            take(e.target.files);
            // Reset so picking the same file twice still fires a change.
            e.target.value = "";
          }}
        />
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          loading={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          Choose files
        </Button>
      </div>

      {rejected.length > 0 && (
        <div className="space-y-1.5 rounded-lg bg-destructive-tint p-3">
          {rejected.map((r) => (
            <p key={r} className="flex items-start gap-2 text-[12.5px] leading-4 text-destructive">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              {r}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
