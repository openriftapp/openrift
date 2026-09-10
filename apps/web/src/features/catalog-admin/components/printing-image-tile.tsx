import { hostnameFromUrl, hostSlugFromUrl } from "@openrift/shared/host-slug";
import type { AdminPrintingImageResponse } from "@openrift/shared/types/api/admin";

import { Badge } from "@/components/ui/badge";
import { Pressable } from "@/components/ui/pressable";
import { imageQuadOf } from "@/features/admin/lib/straighten-quad";
import { PrintingImageControls } from "@/features/catalog-admin/components/printing-image-controls";
import { PrintingThumbnail } from "@/features/catalog-admin/components/printing-thumbnail";
import { printingImageFullSrc } from "@/features/catalog-admin/lib/printing-images";
import { cn } from "@/lib/utils";

export function PrintingImageTile({
  image,
  isAdmin,
  isPreviewing,
  onPreview,
}: {
  image: AdminPrintingImageResponse;
  isAdmin: boolean;
  isPreviewing: boolean;
  onPreview: () => void;
}) {
  const credit =
    image.originalUrl === null ? "upload" : (hostSlugFromUrl(image.originalUrl) ?? "upload");
  const rehostedUrl = image.rehostedUrl === null ? null : printingImageFullSrc(image);

  return (
    <div
      className={cn(
        "flex w-44 flex-col gap-2 rounded-lg p-2 ring-1",
        image.isActive ? "ring-primary" : "ring-border",
      )}
    >
      <Pressable
        aria-label={isPreviewing ? "Hide the large preview" : "Show a large preview"}
        aria-pressed={isPreviewing}
        className="block"
        onClick={onPreview}
      >
        <PrintingThumbnail
          image={image}
          alt={`${image.face} image`}
          variant="240w"
          className="w-full"
        />
      </Pressable>

      <div className="flex flex-wrap items-center gap-1">
        <Badge variant={image.isActive ? "success" : "muted"}>{image.face}</Badge>
        <Badge
          variant="outline"
          className={image.rehostedUrl === null ? "text-warning" : "text-success"}
        >
          {image.rehostedUrl === null ? "External" : "Rehosted"}
        </Badge>
        {imageQuadOf(image) !== null && <Badge variant="outline">Straightened</Badge>}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {image.originalUrl !== null && (
          <a
            href={image.originalUrl}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground truncate underline underline-offset-2"
          >
            {hostnameFromUrl(image.originalUrl) ?? credit}
          </a>
        )}
        {rehostedUrl !== null && (
          <a
            href={rehostedUrl}
            target="_blank"
            rel="noreferrer"
            className="text-success hover:text-success/80 truncate underline underline-offset-2"
          >
            our copy
          </a>
        )}
      </div>

      <PrintingImageControls image={image} isAdmin={isAdmin} />
    </div>
  );
}
