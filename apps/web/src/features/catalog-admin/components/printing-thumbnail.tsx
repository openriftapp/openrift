import type { AdminPrintingImageResponse } from "@openrift/shared/types/api/admin";

import { CatalogImageBox } from "@/features/catalog-admin/components/catalog-image-box";
import type { PrintingImageVariant } from "@/features/catalog-admin/lib/printing-images";
import { printingImageSrc } from "@/features/catalog-admin/lib/printing-images";
import { cn } from "@/lib/utils";

export function PrintingThumbnail({
  image,
  alt,
  variant = "120w",
  className,
}: {
  image: AdminPrintingImageResponse | undefined;
  alt: string;
  variant?: PrintingImageVariant;
  className?: string;
}) {
  return (
    <CatalogImageBox
      url={image ? printingImageSrc(image, variant) : null}
      alt={alt}
      className={cn("aspect-card h-auto w-10 border", className)}
    />
  );
}
