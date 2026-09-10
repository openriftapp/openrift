import type { AdminPrintingImageResponse } from "@openrift/shared/types/api/admin";

import { ImgWithFallback } from "@/components/ui/img-with-fallback";
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
  const src = image ? printingImageSrc(image, variant) : null;
  return (
    <span
      className={cn(
        "bg-muted/30 aspect-card inline-flex w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border",
        className,
      )}
    >
      {src === null ? (
        <span className="text-muted-foreground text-2xs">None</span>
      ) : (
        <ImgWithFallback
          src={src}
          alt={alt}
          className="size-full object-contain"
          fallback={<span className="text-muted-foreground text-2xs">None</span>}
        />
      )}
    </span>
  );
}
