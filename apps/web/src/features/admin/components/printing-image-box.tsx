import { ImageOffIcon } from "lucide-react";

import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { cn } from "@/lib/utils";

/** An `<img>` with no `src` draws the browser's own broken glyph and never fires
 *  the error a fallback waits for, so an absent url renders the placeholder here. */
export function PrintingImageBox({
  url,
  alt,
  href,
  className,
  iconClassName,
}: {
  url: string | null;
  alt: string;
  href?: string;
  className?: string;
  iconClassName?: string;
}) {
  const boxClass = cn(
    "bg-muted/30 aspect-card inline-flex w-full items-center justify-center overflow-hidden rounded-md border",
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
