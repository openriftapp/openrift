import type { DeskImage } from "@openrift/shared/contracts/admin/printing-desk";
import {
  ArrowLeftRightIcon,
  CropIcon,
  RotateCcwIcon,
  RotateCwIcon,
  Trash2Icon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { ConfirmActionButton } from "@/components/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StraightenImageDialog } from "@/features/admin/components/straighten-image-dialog";
import {
  useDeletePrintingImage,
  useImageEditPending,
  useRotatePrintingImage,
} from "@/features/admin/hooks/use-admin-image-mutations";
import { useSetDeskImageFace, useUpdateDeskImage } from "@/features/admin/hooks/use-printing-desk";
import { IMAGE_FILE_SCOPE } from "@/features/admin/lib/admin-query-keys";
import type { RunWrite } from "@/features/admin/lib/run-write";
import { cn } from "@/lib/utils";

type Rotation = 0 | 90 | 180 | 270;

export function DeskImageControls({
  printingId,
  image,
  canMoveFace,
  runWrite,
  children,
  creditClassName,
  onStraighteningChange,
}: {
  printingId: string;
  image: DeskImage;
  canMoveFace: boolean;
  runWrite: RunWrite;
  children?: ReactNode;
  creditClassName?: string;
  onStraighteningChange?: (open: boolean) => void;
}) {
  const rotate = useRotatePrintingImage();
  const remove = useDeletePrintingImage(IMAGE_FILE_SCOPE);
  const editing = useImageEditPending(image.printingImageId);
  const updateImage = useUpdateDeskImage();
  const moveFace = useSetDeskImageFace();
  const [straightening, setStraightening] = useState(false);

  const storedCredit = image.credit ?? "";
  const [credit, setCredit] = useState(storedCredit);
  const [lastCredit, setLastCredit] = useState(storedCredit);
  if (storedCredit !== lastCredit) {
    setLastCredit(storedCredit);
    setCredit(storedCredit);
  }

  function turn(by: 90 | 270) {
    const rotation = ((image.rotation + by) % 360) as Rotation;
    void runWrite((signal) =>
      rotate.mutateAsync({ imageId: image.printingImageId, rotation }, { signal }),
    );
  }

  async function deleteImage() {
    const deleted = await runWrite((signal) =>
      remove.mutateAsync(image.printingImageId, { signal }),
    );
    if (!deleted) {
      throw new Error("The image was not deleted.");
    }
  }

  function saveCredit() {
    const next = credit.trim();
    if (next !== storedCredit) {
      void runWrite((signal) =>
        updateImage.mutateAsync(
          { imageFileId: image.imageFileId, credit: next.length > 0 ? next : null },
          { signal },
        ),
      );
    }
  }

  return (
    <>
      <Input
        aria-label="Image credit"
        className={creditClassName}
        value={credit}
        placeholder="Who made this image"
        onChange={(event) => setCredit(event.target.value)}
        onBlur={saveCredit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
      />
      <span className="flex flex-wrap items-center gap-0.5">
        <span className="text-muted-foreground mr-1 text-sm">Turned {image.rotation}°</span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Turn left"
          disabled={editing}
          onClick={() => turn(270)}
        >
          <RotateCcwIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Turn right"
          disabled={editing}
          onClick={() => turn(90)}
        >
          <RotateCwIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={image.quad === null ? "Straighten" : "Straighten (corners set)"}
          disabled={editing}
          onClick={() => {
            setStraightening(true);
            onStraighteningChange?.(true);
          }}
        >
          <CropIcon className={cn(image.quad !== null && "text-success")} />
        </Button>
        {canMoveFace && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Move to the other face"
            pending={moveFace.isPending}
            onClick={() =>
              void runWrite((signal) =>
                moveFace.mutateAsync(
                  {
                    printingImageId: image.printingImageId,
                    printingId,
                    face: image.face === "front" ? "back" : "front",
                  },
                  { signal },
                ),
              )
            }
          >
            <ArrowLeftRightIcon />
          </Button>
        )}
        {children}
        {image.canDelete && (
          <ConfirmActionButton
            trigger={<Button variant="ghost" size="icon-xs" aria-label="Delete image" />}
            title="Delete this image?"
            description="The uploaded file is removed from this printing."
            confirmLabel="Delete"
            onConfirm={deleteImage}
          >
            <Trash2Icon />
          </ConfirmActionButton>
        )}
      </span>
      <StraightenImageDialog
        imageId={image.printingImageId}
        quad={image.quad}
        open={straightening}
        onOpenChange={(open) => {
          setStraightening(open);
          onStraighteningChange?.(open);
        }}
        runWrite={runWrite}
      />
    </>
  );
}
