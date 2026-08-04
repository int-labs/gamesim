import { Copy, Image as ImageIcon, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import * as React from "react";
import { toast } from "sonner";
import { Card } from "@/components/app/card";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState } from "@/components/app/feedback";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/overlays";
import { Skeleton } from "@/components/ui/primitives";
import { ImageUploader } from "@/features/image-assets/uploader";
import { useDeleteImageAsset, useImageAssets } from "@/lib/api-hooks";
import { absoluteTime } from "@/lib/format";
import { listItem } from "@/lib/motion";

function assetUrl(a: any): string | undefined {
  return a?.url ?? a?.secure_url ?? a?.path ?? a?.imageUrl;
}
function assetName(a: any): string {
  return a?.filename ?? a?.name ?? a?.public_id ?? String(a?._id ?? "").slice(-8);
}

export default function ImageAssetsPage() {
  const { data = [], isLoading, isError, refetch } = useImageAssets();
  const del = useDeleteImageAsset();
  const [lightbox, setLightbox] = React.useState<any>(null);
  const [pendingDelete, setPendingDelete] = React.useState<any>(null);

  return (
    <>
      <PageHeader
        title="Image assets"
        count={data.length}
        subtitle="Artwork referenced by decision fields, game content and the player app."
      />

      <ImageUploader />

      {isLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && (isError || data.length === 0) && (
        <Card padded={false}>
          <EmptyState
            icon={<ImageIcon />}
            title={isError ? "Couldn't load image assets" : "No images yet"}
            hint={
              isError
                ? "The image endpoint is unreachable."
                : "Images uploaded here can be attached to decision fields."
            }
            kind={isError ? "error" : "no-data"}
            action={
              isError ? (
                <Button variant="outline" onClick={() => refetch()}>
                  Try again
                </Button>
              ) : undefined
            }
          />
        </Card>
      )}

      {!isLoading && data.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {data.map((a: any, i: number) => {
            const url = assetUrl(a);
            return (
              <motion.div key={a._id} variants={listItem(i)} initial="hidden" animate="show">
                <Card padded={false} className="group/asset overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setLightbox(a)}
                    className="relative block aspect-square w-full overflow-hidden bg-muted"
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={assetName(a)}
                        loading="lazy"
                        decoding="async"
                        className="size-full object-cover transition-transform duration-200 group-hover/asset:scale-[1.03]"
                      />
                    ) : (
                      <span className="flex size-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="size-6" />
                      </span>
                    )}
                    <span className="absolute inset-0 bg-navy-900/0 transition-colors group-hover/asset:bg-navy-900/20" />
                  </button>
                  <div className="flex items-center gap-1 p-2.5">
                    <span className="flex-1 truncate text-[12px] font-medium text-foreground">
                      {assetName(a)}
                    </span>
                    {url && (
                      <IconButton
                        label="Copy URL"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(url);
                          toast.success("Image URL copied");
                        }}
                      >
                        <Copy />
                      </IconButton>
                    )}
                    <IconButton
                      label="Delete image"
                      size="sm"
                      className="hover:text-destructive"
                      onClick={() => setPendingDelete(a)}
                    >
                      <Trash2 />
                    </IconButton>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <Dialog open={!!lightbox} onOpenChange={(v) => !v && setLightbox(null)}>
        <DialogContent width="max-w-[720px]">
          <DialogTitle>{assetName(lightbox)}</DialogTitle>
          {assetUrl(lightbox) && (
            <img
              src={assetUrl(lightbox)}
              alt={assetName(lightbox)}
              className="mt-4 max-h-[60vh] w-full rounded-lg object-contain"
            />
          )}
          <dl className="mt-4 space-y-2">
            <div className="flex justify-between gap-4 text-[13px]">
              <dt className="text-muted-foreground">Created</dt>
              <dd className="text-foreground">{absoluteTime(lightbox?.createdAt)}</dd>
            </div>
            <div className="flex justify-between gap-4 text-[13px]">
              <dt className="text-muted-foreground">URL</dt>
              <dd className="max-w-[70%] truncate font-mono text-[11px] text-foreground">
                {assetUrl(lightbox) ?? "—"}
              </dd>
            </div>
          </dl>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
        title="Delete this image?"
        description="Any decision field referencing it will lose its artwork."
        confirmLabel="Delete image"
        loading={del.isPending}
        onConfirm={() => del.mutate(pendingDelete._id, { onSuccess: () => setPendingDelete(null) })}
      />
    </>
  );
}
