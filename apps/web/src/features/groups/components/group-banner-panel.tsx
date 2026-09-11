import type { FriendGroupResponse } from "@openrift/shared/types/api/friend-group";
import { ImageUpIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/ui/dropzone";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  useRemoveFriendGroupBanner,
  useUpdateFriendGroup,
} from "@/features/groups/hooks/use-friend-group-mutations";
import { useUploadGroupBanner } from "@/features/groups/hooks/use-upload-group-banner";
import { useServerSeededState } from "@/hooks/use-server-seeded-state";
import { coverOverflowPx, coverPositionFromDrag } from "@/lib/cover-focus";

export function GroupBannerPanel({ group }: { group: FriendGroupResponse }) {
  const upload = useUploadGroupBanner();
  const remove = useRemoveFriendGroupBanner();
  const update = useUpdateFriendGroup();

  const [position, setPosition] = useServerSeededState(group.bannerPosition);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const previewRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startPosition: number;
    overflow: number;
  } | null>(null);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const image = previewRef.current;
    if (!image) {
      return;
    }
    const overflow = coverOverflowPx({
      boxWidth: image.clientWidth,
      boxHeight: image.clientHeight,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    });
    if (overflow <= 0) {
      return;
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startPosition: position,
      overflow,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    setPosition(
      coverPositionFromDrag(drag.startPosition, event.clientY - drag.startY, drag.overflow),
    );
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleFiles(files: File[]) {
    const file = files[0];
    if (!file) {
      return;
    }
    setUploadError(null);
    upload.mutate(
      { slug: group.slug, file },
      {
        onError: (error) => setUploadError(error.message),
      },
    );
  }

  const busy = upload.isPending || remove.isPending || update.isPending;
  const positionChanged = position !== group.bannerPosition;

  return (
    <div className="flex flex-col gap-3">
      <Label>Banner</Label>
      {group.bannerUrl ? (
        <div
          className="bg-muted h-28 touch-none overflow-hidden rounded-lg border"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          <img
            ref={previewRef}
            src={group.bannerUrl}
            alt="Group banner"
            draggable={false}
            className="h-full w-full cursor-grab object-cover active:cursor-grabbing"
            style={{ objectPosition: `50% ${position}%` }}
          />
        </div>
      ) : null}

      {group.bannerUrl ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Vertical focus</Label>
            <span className="text-muted-foreground text-sm">Or drag the preview</span>
          </div>
          <Slider
            aria-label="Vertical focus"
            value={[position]}
            min={0}
            max={100}
            onValueChange={(value) => {
              const next = Array.isArray(value) ? value[0] : value;
              if (typeof next === "number") {
                setPosition(next);
              }
            }}
          />
        </div>
      ) : null}

      <Dropzone
        accept="image/*"
        disabled={busy}
        icon={<ImageUpIcon className="text-muted-foreground size-5" />}
        label={
          upload.isPending
            ? "Uploading…"
            : group.bannerUrl
              ? "Choose a different picture"
              : "Add a banner"
        }
        hint="JPG, PNG or WebP, up to 20 MB. Wide pictures work best, around 1600 × 400."
        onFiles={handleFiles}
      />
      {uploadError ? <p className="text-destructive text-sm">{uploadError}</p> : null}

      {group.bannerUrl ? (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => remove.mutate(group.slug)}
            disabled={busy}
          >
            Remove banner
          </Button>
          <Button
            size="sm"
            onClick={() => update.mutate({ slug: group.slug, bannerPosition: position })}
            disabled={busy || !positionChanged}
          >
            Save focus
          </Button>
        </div>
      ) : null}
    </div>
  );
}
