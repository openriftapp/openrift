import type { AdminPrintingImageResponse } from "@openrift/shared/types/api/admin";
import {
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  RotateCcwIcon,
  RotateCwIcon,
  ScissorsIcon,
  ScissorsLineDashedIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { StraightenImageDialog } from "@/features/admin/components/straighten-image-dialog";
import {
  useActivatePrintingImage,
  useDeletePrintingImage,
  useRehostPrintingImage,
  useRotatePrintingImage,
  useSetPrintingImageNeedsTrim,
  useUnrehostPrintingImage,
} from "@/features/admin/hooks/use-admin-image-mutations";
import { imageQuadOf } from "@/features/admin/lib/straighten-quad";

type Rotation = 0 | 90 | 180 | 270;

function turned(rotation: number, by: number): Rotation {
  return ((rotation + by) % 360) as Rotation;
}

export function PrintingImageControls({
  image,
  isAdmin,
}: {
  image: AdminPrintingImageResponse;
  isAdmin: boolean;
}) {
  const activate = useActivatePrintingImage();
  const rotate = useRotatePrintingImage();
  const setNeedsTrim = useSetPrintingImageNeedsTrim();
  const rehost = useRehostPrintingImage();
  const unrehost = useUnrehostPrintingImage();
  const remove = useDeletePrintingImage();

  return (
    <div className="flex flex-wrap items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label={image.isActive ? "Deactivate image" : "Activate image"}
        disabled={activate.isPending}
        onClick={() => activate.mutate({ imageId: image.id, active: !image.isActive })}
      >
        {image.isActive ? <EyeIcon /> : <EyeOffIcon />}
      </Button>

      {image.rehostedUrl === null ? (
        image.originalUrl !== null && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Rehost image"
            disabled={rehost.isPending}
            onClick={() => rehost.mutate(image.id)}
          >
            <DownloadIcon />
          </Button>
        )
      ) : (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Rotate left"
            disabled={rotate.isPending}
            onClick={() =>
              rotate.mutate({ imageId: image.id, rotation: turned(image.rotation, 270) })
            }
          >
            <RotateCcwIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Rotate right"
            disabled={rotate.isPending}
            onClick={() =>
              rotate.mutate({ imageId: image.id, rotation: turned(image.rotation, 90) })
            }
          >
            <RotateCwIcon />
          </Button>
          <span className="[&>button]:size-7">
            <StraightenImageDialog imageId={image.id} quad={imageQuadOf(image)} />
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={image.needsTrim ? "Turn auto-trim off" : "Turn auto-trim on"}
            disabled={setNeedsTrim.isPending}
            onClick={() => setNeedsTrim.mutate({ imageId: image.id, needsTrim: !image.needsTrim })}
          >
            {image.needsTrim ? (
              <ScissorsIcon className="text-success" />
            ) : (
              <ScissorsLineDashedIcon />
            )}
          </Button>
          {isAdmin && image.originalUrl !== null && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Un-rehost image"
              disabled={unrehost.isPending}
              onClick={() => unrehost.mutate(image.id)}
            >
              <XIcon />
            </Button>
          )}
        </>
      )}

      {isAdmin && (
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive size-7"
          aria-label="Remove image"
          disabled={remove.isPending}
          onClick={() => {
            if (globalThis.confirm("Remove this image? This cannot be undone.")) {
              remove.mutate(image.id);
            }
          }}
        >
          <Trash2Icon />
        </Button>
      )}
    </div>
  );
}
