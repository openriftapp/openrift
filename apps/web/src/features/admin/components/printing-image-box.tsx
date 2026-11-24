import { ImageOffIcon } from "lucide-react";
import type { SyntheticEvent } from "react";

import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { useLoadedImageSize } from "@/features/admin/hooks/use-loaded-image-size";
import { cn } from "@/lib/utils";

/** `landscape: null` means the card type is unknown; the frame then follows the image.
 *  An `<img>` with no `src` draws the browser's own broken glyph and never fires
 *  the error a fallback waits for, so an absent url renders the placeholder here. */
export function PrintingImageBox({
  url,
  alt,
  href,
  className,
  iconClassName,
  landscape,
  onLoad,
}: {
  url: string | null;
  alt: string;
  href?: string;
  className?: string;
  iconClassName?: string;
  landscape: boolean | null;
  onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void;
}) {
  const { size, onLoad: trackSize } = useLoadedImageSize(url);
  const lying = landscape ?? (size !== null && size.width > size.height);
  const boxClass = cn(
    "bg-muted/30 inline-flex w-full items-center justify-center overflow-hidden rounded-md border",
    lying ? "aspect-card-landscape" : "aspect-card",
    className,
  );
  const placeholder = (
    <ImageOffIcon className={cn("text-muted-foreground size-4", iconClassName)} />
  );
  const content =
    url === null ? (
      placeholder
    ) : (
      <ImgWithFallback
        src={url}
        alt={alt}
        className="size-full object-contain"
        fallback={placeholder}
        onLoad={(event) => {
          trackSize(event);
          onLoad?.(event);
        }}
      />
    );

  if (href === undefined) {
    return <span className={boxClass}>{content}</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={boxClass}
      onClick={(e) => e.stopPropagation()}
    >
      {content}
    </a>
  );
}
