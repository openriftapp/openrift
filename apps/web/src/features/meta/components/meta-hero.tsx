import { imageUrl } from "@openrift/shared/image-url";

import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The crop is pulled toward the top third, where the character sits on every Riftbound legend. */
export function MetaHeroArt({ imageId, alt }: { imageId: string | null; alt: string }) {
  if (imageId === null) {
    return null;
  }
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 overflow-hidden sm:w-2/5">
      <ImgWithFallback
        src={imageUrl(imageId, "400w")}
        alt={alt}
        draggable={false}
        className="h-full w-full object-cover"
        style={{ objectPosition: "50% 18%" }}
        fallback={null}
      />
      <div className="from-card via-card/85 absolute inset-0 bg-linear-to-r to-transparent to-70%" />
      <div className="from-card absolute inset-0 bg-linear-to-t from-0% to-transparent to-35% sm:hidden" />
    </div>
  );
}

export function MetaHeroCounter({
  value,
  label,
  className,
}: {
  value: number | string;
  label: string;
  className?: string;
}) {
  return (
    <p className="flex flex-col gap-0.5">
      <span className={cn("font-heading text-2xl leading-none font-bold tabular-nums", className)}>
        {typeof value === "number" ? formatCount(value) : value}
      </span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </p>
  );
}
