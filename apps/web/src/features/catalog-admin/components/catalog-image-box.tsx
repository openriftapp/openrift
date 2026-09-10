import { ImageOffIcon } from "lucide-react";

import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { cn } from "@/lib/utils";

function Missing() {
  return <ImageOffIcon className="text-muted-foreground size-4" />;
}

export function CatalogImageBox({
  url,
  alt,
  ringed,
  className,
}: {
  url: string | null;
  alt: string;
  ringed?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "bg-muted inline-flex h-20 w-14 shrink-0 items-center justify-center rounded-md",
        className,
      )}
    >
      {url === null ? (
        <Missing />
      ) : (
        <ImgWithFallback
          src={url}
          alt={alt}
          loading="lazy"
          className={cn("size-full rounded-md object-contain", ringed && "ring-primary ring-2")}
          fallback={<Missing />}
        />
      )}
    </span>
  );
}
