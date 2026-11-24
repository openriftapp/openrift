import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pressable } from "@/components/ui/pressable";
import { TextLink } from "@/components/ui/text-link";
import { PrintingImageBox } from "@/features/admin/components/printing-image-box";
import { useLoadedImageSize } from "@/features/admin/hooks/use-loaded-image-size";
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
  const { size, onLoad } = useLoadedImageSize(image.url);
  return (
    <figure className="flex min-w-0 flex-col items-center gap-2">
      <PrintingImageBox
        url={image.url}
        alt={image.caption}
        landscape={landscape}
        className="max-h-[65vh]"
        iconClassName="size-6"
        onLoad={onLoad}
      />
      <figcaption className="text-muted-foreground text-center text-sm">
        {typeof image.href === "string" && isWebUrl(image.href) ? (
          <TextLink className="font-medium" href={image.href} target="_blank" rel="noreferrer">
            {image.caption}
          </TextLink>
        ) : (
          <span className="text-foreground font-medium">{image.caption}</span>
        )}
        {size !== null && (
          <>
            {" "}
            · {size.width} × {size.height}
          </>
        )}
      </figcaption>
      {tools !== undefined && (
        <div className="flex flex-wrap items-center justify-center gap-2 max-sm:w-full max-sm:flex-col max-sm:items-stretch">
          {tools}
        </div>
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
          <div className="mx-auto flex w-full flex-col gap-2 sm:w-1/2">
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
                  "grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-center",
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
          <span className="flex flex-1 flex-wrap justify-end gap-2 max-sm:basis-full max-sm:*:flex-1">
            {actions}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
