import { ImageOffIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { Pressable } from "@/components/ui/pressable";
import { TextLink } from "@/components/ui/text-link";
import { isWebUrl } from "@/features/catalog-workspace/lib/card-pass";
import { cn } from "@/lib/utils";

export interface ComparedImage {
  url: string | null;
  caption: string;
  href?: string | null;
}

function LargeImage({
  image,
  landscape,
  tools,
}: {
  image: ComparedImage;
  landscape: boolean;
  tools?: ReactNode;
}) {
  const [loaded, setLoaded] = useState<{ url: string; size: string } | null>(null);
  const size = loaded !== null && loaded.url === image.url ? loaded.size : null;
  const placeholder = <ImageOffIcon className="text-muted-foreground size-6" />;
  return (
    <figure className="flex min-w-0 flex-col items-center gap-2">
      <span
        className={cn(
          "flex max-h-[65vh] w-full items-center justify-center overflow-hidden rounded-md border",
          landscape ? "aspect-card-landscape" : "aspect-card",
        )}
      >
        {image.url === null ? (
          placeholder
        ) : (
          <ImgWithFallback
            src={image.url}
            alt={image.caption}
            className="size-full object-contain"
            fallback={placeholder}
            onLoad={(event) => {
              const img = event.currentTarget;
              if (image.url !== null) {
                setLoaded({ url: image.url, size: `${img.naturalWidth} × ${img.naturalHeight}` });
              }
            }}
          />
        )}
      </span>
      <figcaption className="text-muted-foreground text-center text-sm">
        {typeof image.href === "string" && isWebUrl(image.href) ? (
          <TextLink className="font-medium" href={image.href} target="_blank" rel="noreferrer">
            {image.caption}
          </TextLink>
        ) : (
          <span className="text-foreground font-medium">{image.caption}</span>
        )}
        {size !== null && <> · {size}</>}
      </figcaption>
      {tools !== undefined && (
        <div className="flex flex-wrap items-center justify-center gap-2">{tools}</div>
      )}
    </figure>
  );
}

export function ImageCompareDialog({
  title,
  current,
  candidate,
  landscape,
  tools,
  actions,
  onOpenChange,
}: {
  title: string;
  current: ComparedImage;
  candidate: ComparedImage;
  landscape: boolean;
  tools?: ReactNode;
  actions: ReactNode;
  onOpenChange: (open: boolean) => void;
}) {
  const [flip, setFlip] = useState<"current" | "candidate" | null>(null);
  const next = flip === "candidate" ? "current" : "candidate";

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {flip === null ? (
          <div className="grid grid-cols-2 gap-4">
            <LargeImage image={current} landscape={landscape} />
            <LargeImage image={candidate} landscape={landscape} tools={tools} />
          </div>
        ) : (
          <div className="mx-auto flex w-1/2 flex-col gap-2">
            <Pressable
              className="block"
              aria-label="Show the other image"
              onClick={() => setFlip(next)}
            >
              <LargeImage image={flip === "current" ? current : candidate} landscape={landscape} />
            </Pressable>
            {tools !== undefined && (
              <div
                className={cn(
                  "flex flex-wrap items-center justify-center gap-2",
                  flip === "current" && "invisible",
                )}
              >
                {tools}
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            // oxlint-disable-next-line jsx-a11y/no-autofocus -- Space flips as soon as the dialog opens
            autoFocus
            onClick={() => setFlip(next)}
          >
            Flip
          </Button>
          {flip !== null && (
            <Button variant="outline" size="sm" onClick={() => setFlip(null)}>
              Side by side
            </Button>
          )}
          <span className="flex flex-1 flex-wrap justify-end gap-2">{actions}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
