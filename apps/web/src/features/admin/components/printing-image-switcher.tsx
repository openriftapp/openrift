import { imageUrl } from "@openrift/shared/image-url";
import type {
  AdminPrintingImageResponse,
  ProviderSettingResponse,
} from "@openrift/shared/types/api/admin";
import {
  DownloadIcon,
  EllipsisVerticalIcon,
  ImagePlusIcon,
  TriangleAlertIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { SimpleSelect } from "@/components/ui/simple-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { sortByProviderOrder } from "@/features/admin/components/card-detail-shared";
import { ImagePreview } from "@/features/admin/components/image-preview";
import { RehostStatusBadge } from "@/features/admin/components/rehost-status-badge";
import { StraightenImageDialog } from "@/features/admin/components/straighten-image-dialog";
import {
  useActivatePrintingImage,
  useAddFallbackArtUrl,
  useAddImageFromUrl,
  useDeletePrintingImage,
  useImageEditPending,
  useRehostPrintingImage,
  useRotatePrintingImage,
  useSetFallbackArt,
  useSetPrintingImageNeedsLevels,
  useSetPrintingImageNeedsTrim,
  useUnrehostPrintingImage,
  useUploadFallbackArt,
  useUploadPrintingImage,
} from "@/features/admin/hooks/use-admin-image-mutations";
import { hostnameFromUrl, hostSlugFromUrl } from "@/features/admin/lib/host-slug";
import { printingImageDisplayUrl as getDisplayUrl } from "@/features/admin/lib/printing-image-display-url";
import { rehostStatusTitle } from "@/features/admin/lib/rehost-status";
import type { RunWrite } from "@/features/admin/lib/run-write";
import { runWriteDirectly } from "@/features/admin/lib/run-write";
import type { SiblingImage } from "@/features/admin/lib/sibling-images";
import { imageQuadOf } from "@/features/admin/lib/straighten-quad";
import { cn } from "@/lib/utils";

import { ImageEditMenuItems } from "./image-edit-menu-items";

type Rotation = 0 | 90 | 180 | 270;

function imageLabel(img: AdminPrintingImageResponse): string {
  return (img.originalUrl && hostSlugFromUrl(img.originalUrl)) ?? "upload";
}

const UPLOAD = { limit: "upload" } as const;

export function PrintingImageSwitcher({
  printingId,
  face,
  printingLabel,
  images,
  siblingImages,
  derivedArtLabel,
  fallbackArtMode,
  fallbackImageFileId,
  providerSettings,
  invalidates,
  isAdmin,
  runWrite = runWriteDirectly,
  caption,
}: {
  printingId: string;
  face: "front" | "back";
  printingLabel: string;
  images: AdminPrintingImageResponse[];
  siblingImages: SiblingImage[];
  /** Null when the card has no standard printing with art to derive from. */
  derivedArtLabel: string | null;
  fallbackArtMode: "auto" | "pinned" | "none";
  fallbackImageFileId: string | null;
  providerSettings: ProviderSettingResponse[];
  invalidates?: readonly (readonly unknown[])[];
  /** Card-review grant holders keep image finishing; un-rehost, delete, and URL/file add stay full-admin. */
  isAdmin: boolean;
  runWrite?: RunWrite;
  caption?: string;
}) {
  const deletePrintingImage = useDeletePrintingImage(invalidates);
  const activatePrintingImage = useActivatePrintingImage(invalidates);
  const rehostPrintingImage = useRehostPrintingImage();
  const unrehostPrintingImage = useUnrehostPrintingImage(invalidates);
  const rotatePrintingImage = useRotatePrintingImage();
  const setNeedsTrim = useSetPrintingImageNeedsTrim();
  const setNeedsLevels = useSetPrintingImageNeedsLevels();
  const addImageFromUrl = useAddImageFromUrl(invalidates);
  const uploadPrintingImage = useUploadPrintingImage(invalidates);
  const setFallbackArt = useSetFallbackArt(invalidates);
  const addFallbackArtUrl = useAddFallbackArtUrl(invalidates);
  const uploadFallbackArt = useUploadFallbackArt(invalidates);

  const orderSort = sortByProviderOrder(providerSettings);
  // The active image leads the strip: provider order alone could front a rehosted-but-inactive image.
  const sortedImages = images.toSorted((a, b) => {
    if (a.isActive !== b.isActive) {
      return a.isActive ? -1 : 1;
    }
    return orderSort(imageLabel(a), imageLabel(b));
  });

  const [selectedId, setSelectedId] = useState<string | null>(() => sortedImages[0]?.id ?? null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [straightening, setStraightening] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [showFallbackUrlInput, setShowFallbackUrlInput] = useState(false);
  const [fallbackUrlValue, setFallbackUrlValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fallbackFileInputRef = useRef<HTMLInputElement>(null);

  const selectedImage = images.find((img) => img.id === selectedId);

  async function addFromUrl() {
    const input = { printingId, url: urlValue.trim(), mode: "main" as const, face };
    if (await runWrite((signal) => addImageFromUrl.mutateAsync(input, { signal }), UPLOAD)) {
      setUrlValue("");
      setShowUrlInput(false);
    }
  }

  async function pinFallbackUrl() {
    const input = { printingId, url: fallbackUrlValue.trim(), face };
    if (await runWrite((signal) => addFallbackArtUrl.mutateAsync(input, { signal }), UPLOAD)) {
      setFallbackUrlValue("");
      setShowFallbackUrlInput(false);
    }
  }

  const activeImage = images.find((img) => img.isActive);
  const activeSideImage = images.find((img) => img.isActive && img.face === face);
  const pinnedSibling = siblingImages.find((s) => s.imageFileId === fallbackImageFileId);
  const effectiveImage = selectedImage ?? (selectedId ? null : activeImage);
  const editing = useImageEditPending(effectiveImage?.id ?? "");
  const effectiveUrl = effectiveImage ? getDisplayUrl(effectiveImage) : null;

  const tile = caption !== undefined;
  const toolsMenu = (
    <DropdownMenu>
      {tile ? (
        <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
          <EllipsisVerticalIcon />
          Image tools
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-xs" className="ml-auto" />}
          aria-label="Image tools"
        >
          <EllipsisVerticalIcon className="size-3" />
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent align="end">
        {effectiveImage && (
          <>
            {tile && effectiveImage.isActive && (
              <DropdownMenuItem
                disabled={activatePrintingImage.isPending}
                onClick={() => {
                  const input = { imageId: effectiveImage.id, active: false };
                  void runWrite((signal) => activatePrintingImage.mutateAsync(input, { signal }));
                }}
              >
                <XIcon className="size-3.5" />
                Take off the site
              </DropdownMenuItem>
            )}
            {!effectiveImage.rehostedUrl && effectiveImage.originalUrl && (
              <DropdownMenuItem
                disabled={rehostPrintingImage.isPending}
                onClick={() => {
                  const imageId = effectiveImage.id;
                  void runWrite((signal) => rehostPrintingImage.mutateAsync(imageId, { signal }));
                }}
              >
                <DownloadIcon className="size-3.5" />
                Rehost
              </DropdownMenuItem>
            )}
            {effectiveImage.activateWhenRehosted && (
              <DropdownMenuItem
                disabled={activatePrintingImage.isPending}
                onClick={() => {
                  const input = { imageId: effectiveImage.id, active: false };
                  void runWrite((signal) => activatePrintingImage.mutateAsync(input, { signal }));
                }}
              >
                <XIcon className="size-3.5" />
                Cancel going live
              </DropdownMenuItem>
            )}
            {effectiveImage.rehostedUrl && (
              <ImageEditMenuItems
                image={effectiveImage}
                disabled={editing}
                onStraighten={() => setStraightening(true)}
                onRotate={(degrees) => {
                  const input = {
                    imageId: effectiveImage.id,
                    rotation: ((effectiveImage.rotation + degrees) % 360) as Rotation,
                  };
                  void runWrite((signal) => rotatePrintingImage.mutateAsync(input, { signal }));
                }}
                onToggleTrim={() => {
                  const input = {
                    imageId: effectiveImage.id,
                    needsTrim: !effectiveImage.needsTrim,
                  };
                  void runWrite((signal) => setNeedsTrim.mutateAsync(input, { signal }));
                }}
                onToggleLevels={() => {
                  const input = {
                    imageId: effectiveImage.id,
                    needsLevels: !effectiveImage.needsLevels,
                  };
                  void runWrite((signal) => setNeedsLevels.mutateAsync(input, { signal }));
                }}
              />
            )}
            {isAdmin &&
              !effectiveImage.isActive &&
              !effectiveImage.fileInUseElsewhere &&
              effectiveImage.imageFileId !== fallbackImageFileId &&
              !siblingImages.some(
                (sibling) => sibling.imageFileId === effectiveImage.imageFileId && sibling.inUse,
              ) &&
              effectiveImage.rehostedUrl &&
              effectiveImage.originalUrl && (
                <DropdownMenuItem
                  disabled={unrehostPrintingImage.isPending}
                  onClick={() => {
                    const imageId = effectiveImage.id;
                    void runWrite((signal) =>
                      unrehostPrintingImage.mutateAsync(imageId, { signal }),
                    );
                  }}
                >
                  <XIcon className="size-3.5" />
                  Un-rehost (delete files)
                </DropdownMenuItem>
              )}
            {isAdmin && (
              <DropdownMenuItem
                variant="destructive"
                disabled={deletePrintingImage.isPending}
                onClick={() => {
                  const imageId = effectiveImage.id;
                  void runWrite((signal) => deletePrintingImage.mutateAsync(imageId, { signal }));
                }}
              >
                <Trash2Icon className="size-3.5" />
                Remove
              </DropdownMenuItem>
            )}
          </>
        )}
        {isAdmin && !tile && (
          <>
            {effectiveImage && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={() => setShowUrlInput(true)}>
              <ImagePlusIcon className="size-3.5" />
              Add from URL…
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={uploadPrintingImage.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadIcon className="size-3.5" />
              Upload an image…
            </DropdownMenuItem>
          </>
        )}
        {isAdmin && !activeSideImage && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowFallbackUrlInput(true)}>
              <ImagePlusIcon className="size-3.5" />
              Pin substitute from URL…
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={uploadFallbackArt.isPending}
              onClick={() => fallbackFileInputRef.current?.click()}
            >
              <UploadIcon className="size-3.5" />
              Upload a pinned substitute…
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className={cn("w-full max-w-96 space-y-2", tile ? "min-w-0" : "shrink-0")}>
      <ImagePreview url={effectiveUrl} alt={printingLabel} />
      {tile && effectiveImage && (
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground min-w-0 flex-1 break-words">{caption}</span>
            {toolsMenu}
          </div>
          <span className="flex flex-wrap gap-1">
            <Badge>Current</Badge>
            <RehostStatusBadge image={effectiveImage} />
            {imageQuadOf(effectiveImage) !== null && <Badge variant="outline">Straightened</Badge>}
          </span>
        </div>
      )}
      {tile && !effectiveImage && isAdmin && toolsMenu}
      {!tile && (effectiveImage || isAdmin) && (
        <div className="flex min-h-6 flex-wrap items-center gap-1">
          {effectiveImage && (
            <Badge
              variant={effectiveImage.isActive ? "default" : "secondary"}
              title={effectiveImage.isActive ? "Click to deactivate" : "Click to set as active"}
              render={
                <Pressable
                  disabled={activatePrintingImage.isPending}
                  onClick={() => {
                    const input = { imageId: effectiveImage.id, active: !effectiveImage.isActive };
                    void runWrite((signal) => activatePrintingImage.mutateAsync(input, { signal }));
                  }}
                />
              }
            >
              {effectiveImage.isActive ? "Active" : "Inactive"}
            </Badge>
          )}
          {effectiveImage && <RehostStatusBadge image={effectiveImage} />}
          {effectiveImage && imageQuadOf(effectiveImage) !== null && (
            <Badge variant="outline">Straightened</Badge>
          )}
          {effectiveImage?.originalUrl && (
            <a
              href={effectiveImage.originalUrl}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground truncate text-xs"
              title={effectiveImage.originalUrl}
            >
              {hostnameFromUrl(effectiveImage.originalUrl) ?? "upload"}
            </a>
          )}
          {toolsMenu}
        </div>
      )}
      {sortedImages.length > 0 && !tile && (
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Which image"
          className="max-w-full flex-wrap"
          value={effectiveImage ? [effectiveImage.id] : []}
          onValueChange={([next]) => {
            setSelectedId(next ?? null);
          }}
        >
          {sortedImages.map((img) => (
            <ToggleGroupItem key={img.id} value={img.id}>
              {imageLabel(img)} ({img.face})
              {!img.rehostedUrl && (
                <span title={rehostStatusTitle(img)} className="inline-flex">
                  <TriangleAlertIcon className="text-destructive" />
                </span>
              )}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}

      {effectiveImage?.rehostedUrl && (
        <StraightenImageDialog
          imageId={effectiveImage.id}
          quad={imageQuadOf(effectiveImage)}
          open={straightening}
          onOpenChange={setStraightening}
          runWrite={runWrite}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        aria-label="Upload printing image"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const input = { printingId, file, mode: "main" as const, face };
            void runWrite((signal) => uploadPrintingImage.mutateAsync(input, { signal }), UPLOAD);
            e.target.value = "";
          }
        }}
      />

      {showUrlInput && (
        <div className="flex gap-1">
          <Input
            placeholder="Image URL…"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            className="flex-1"
          />
          <Button
            variant="outline"
            disabled={!urlValue.trim()}
            pending={addImageFromUrl.isPending}
            onClick={() => void addFromUrl()}
          >
            Add
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setShowUrlInput(false);
              setUrlValue("");
            }}
          >
            <XIcon className="size-3" />
          </Button>
        </div>
      )}

      {/* Shown only while this side has no active image; a pin persists and reactivates if that image is later removed. */}
      {!activeSideImage && (
        <div className="space-y-1 pt-4">
          <div className="flex min-h-6 items-center gap-1">
            <span className="text-muted-foreground shrink-0 text-xs">Substitute</span>
            {fallbackArtMode === "pinned" && fallbackImageFileId !== null && (
              <ImgWithFallback
                src={imageUrl(fallbackImageFileId, "120w")}
                alt="Pinned substitute art"
                className="h-8 w-auto rounded-sm"
                fallback={<Badge variant="warning">Not rehosted</Badge>}
              />
            )}
            {fallbackArtMode === "pinned" && pinnedSibling === undefined && (
              <span className="text-muted-foreground">external</span>
            )}
            {fallbackArtMode === "pinned" && pinnedSibling !== undefined && (
              <span className="text-muted-foreground truncate">{pinnedSibling.printingLabel}</span>
            )}
          </div>
          {(() => {
            const items = [
              { value: "auto", label: `Derived (${derivedArtLabel ?? "no source"})` },
              { value: "none", label: "None" },
              ...siblingImages.map((sibling) => ({
                value: `pin:${sibling.imageFileId}`,
                label: sibling.printingLabel,
              })),
            ];
            return (
              <SimpleSelect
                items={items}
                value={
                  fallbackArtMode === "pinned"
                    ? `pin:${fallbackImageFileId ?? ""}`
                    : fallbackArtMode
                }
                disabled={setFallbackArt.isPending}
                onChange={(next) => {
                  if (next === "auto" || next === "none") {
                    const mode: "auto" | "none" = next;
                    const input = { printingId, mode, face };
                    void runWrite((signal) => setFallbackArt.mutateAsync(input, { signal }));
                    return;
                  }
                  if (next.startsWith("pin:")) {
                    const input = {
                      printingId,
                      mode: "pinned" as const,
                      imageFileId: next.slice("pin:".length),
                      face,
                    };
                    void runWrite((signal) => setFallbackArt.mutateAsync(input, { signal }));
                  }
                }}
                label="Which substitute art"
                size="sm"
                className="w-full"
              />
            );
          })()}
          {showFallbackUrlInput && (
            <div className="flex gap-1">
              <Input
                placeholder="Substitute art URL…"
                value={fallbackUrlValue}
                onChange={(e) => setFallbackUrlValue(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                disabled={!fallbackUrlValue.trim()}
                pending={addFallbackArtUrl.isPending}
                onClick={() => void pinFallbackUrl()}
              >
                Pin
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowFallbackUrlInput(false);
                  setFallbackUrlValue("");
                }}
              >
                <XIcon className="size-3" />
              </Button>
            </div>
          )}
        </div>
      )}

      <input
        ref={fallbackFileInputRef}
        type="file"
        aria-label="Upload substitute art"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const input = { printingId, file, face };
            void runWrite((signal) => uploadFallbackArt.mutateAsync(input, { signal }), UPLOAD);
            e.target.value = "";
          }
        }}
      />
    </div>
  );
}
