import { hostnameFromUrl, hostSlugFromUrl } from "@openrift/shared/host-slug";
import { imageUrl } from "@openrift/shared/image-url";
import type {
  AdminPrintingImageResponse,
  ProviderSettingResponse,
} from "@openrift/shared/types/api/admin";
import {
  DownloadIcon,
  CropIcon,
  EllipsisVerticalIcon,
  ImagePlusIcon,
  RotateCcwIcon,
  RotateCwIcon,
  ScissorsIcon,
  ScissorsLineDashedIcon,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { sortByProviderOrder } from "@/features/admin/components/card-detail-shared";
import { ImagePreview } from "@/features/admin/components/image-preview";
import { StraightenImageDialog } from "@/features/admin/components/straighten-image-dialog";
import {
  useActivatePrintingImage,
  useAddFallbackArtUrl,
  useAddImageFromUrl,
  useDeletePrintingImage,
  useRehostPrintingImage,
  useRotatePrintingImage,
  useSetFallbackArt,
  useSetPrintingImageNeedsTrim,
  useUnrehostPrintingImage,
  useUploadFallbackArt,
  useUploadPrintingImage,
} from "@/features/admin/hooks/use-admin-image-mutations";
import { printingImageDisplayUrl as getDisplayUrl } from "@/features/admin/lib/printing-image-display-url";
import { imageQuadOf } from "@/features/admin/lib/straighten-quad";
import { cn } from "@/lib/utils";

type Rotation = 0 | 90 | 180 | 270;

function imageLabel(img: AdminPrintingImageResponse): string {
  return (img.originalUrl && hostSlugFromUrl(img.originalUrl)) ?? "upload";
}

export interface SiblingImage {
  imageFileId: string;
  printingLabel: string;
}

export function PrintingImageSwitcher({
  printingId,
  printingLabel,
  images,
  siblingImages,
  derivedArtLabel,
  fallbackArtMode,
  fallbackImageFileId,
  providerSettings,
  invalidates,
  isAdmin,
}: {
  printingId: string;
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
}) {
  const deletePrintingImage = useDeletePrintingImage(invalidates);
  const activatePrintingImage = useActivatePrintingImage(invalidates);
  const rehostPrintingImage = useRehostPrintingImage(invalidates);
  const unrehostPrintingImage = useUnrehostPrintingImage(invalidates);
  const rotatePrintingImage = useRotatePrintingImage(invalidates);
  const setNeedsTrim = useSetPrintingImageNeedsTrim(invalidates);
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
  const [resolution, setResolution] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [straightening, setStraightening] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [showFallbackUrlInput, setShowFallbackUrlInput] = useState(false);
  const [fallbackUrlValue, setFallbackUrlValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fallbackFileInputRef = useRef<HTMLInputElement>(null);

  const selectedImage = images.find((img) => img.id === selectedId);

  const activeImage = images.find((img) => img.isActive);
  // Substitute art fills the front slot only, so an active back-only scan still needs it.
  const activeFrontImage = images.find((img) => img.isActive && img.face === "front");
  const pinnedSibling = siblingImages.find((s) => s.imageFileId === fallbackImageFileId);
  const effectiveImage = selectedImage ?? (selectedId ? null : activeImage);
  const effectiveUrl = effectiveImage ? getDisplayUrl(effectiveImage) : null;

  return (
    <div className="w-full max-w-96 shrink-0 space-y-2">
      <ImagePreview
        url={effectiveUrl}
        alt={printingLabel}
        resolution={resolution}
        setResolution={setResolution}
        imgError={imgError}
        setImgError={setImgError}
      />
      {(effectiveImage || isAdmin) && (
        <div className="flex min-h-6 flex-wrap items-center gap-1">
          {effectiveImage && (
            <Badge
              variant={effectiveImage.isActive ? "default" : "secondary"}
              title={effectiveImage.isActive ? "Click to deactivate" : "Click to set as active"}
              render={
                <Pressable
                  disabled={activatePrintingImage.isPending}
                  onClick={() =>
                    activatePrintingImage.mutate({
                      imageId: effectiveImage.id,
                      active: !effectiveImage.isActive,
                    })
                  }
                />
              }
            >
              {effectiveImage.isActive ? "Active" : "Inactive"}
            </Badge>
          )}
          {effectiveImage && !effectiveImage.rehostedUrl && (
            <Badge variant="destructive" title="Still served from the source's own host">
              <TriangleAlertIcon />
              Not rehosted
            </Badge>
          )}
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
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-xs" className="ml-auto" />}
              aria-label="Image tools"
            >
              <EllipsisVerticalIcon className="size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {effectiveImage && (
                <>
                  {!effectiveImage.rehostedUrl && effectiveImage.originalUrl && (
                    <DropdownMenuItem
                      disabled={rehostPrintingImage.isPending}
                      onClick={() => rehostPrintingImage.mutate(effectiveImage.id)}
                    >
                      <DownloadIcon className="size-3.5" />
                      Rehost
                    </DropdownMenuItem>
                  )}
                  {effectiveImage.rehostedUrl && (
                    <>
                      <DropdownMenuItem onClick={() => setStraightening(true)}>
                        <CropIcon
                          className={cn(
                            "size-3.5",
                            imageQuadOf(effectiveImage) !== null && "text-success",
                          )}
                        />
                        {imageQuadOf(effectiveImage) === null
                          ? "Straighten…"
                          : "Straighten (corners set)…"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={rotatePrintingImage.isPending}
                        onClick={() =>
                          rotatePrintingImage.mutate({
                            imageId: effectiveImage.id,
                            rotation: ((effectiveImage.rotation + 270) % 360) as Rotation,
                          })
                        }
                      >
                        <RotateCcwIcon className="size-3.5" />
                        Rotate left ({effectiveImage.rotation}&deg;)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={rotatePrintingImage.isPending}
                        onClick={() =>
                          rotatePrintingImage.mutate({
                            imageId: effectiveImage.id,
                            rotation: ((effectiveImage.rotation + 90) % 360) as Rotation,
                          })
                        }
                      >
                        <RotateCwIcon className="size-3.5" />
                        Rotate right ({effectiveImage.rotation}&deg;)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={setNeedsTrim.isPending}
                        onClick={() =>
                          setNeedsTrim.mutate({
                            imageId: effectiveImage.id,
                            needsTrim: !effectiveImage.needsTrim,
                          })
                        }
                      >
                        {effectiveImage.needsTrim ? (
                          <ScissorsIcon className="text-success size-3.5" />
                        ) : (
                          <ScissorsLineDashedIcon className="size-3.5" />
                        )}
                        {effectiveImage.needsTrim ? "Auto-trim is on" : "Auto-trim is off"}
                      </DropdownMenuItem>
                    </>
                  )}
                  {isAdmin && effectiveImage.rehostedUrl && effectiveImage.originalUrl && (
                    <DropdownMenuItem
                      disabled={unrehostPrintingImage.isPending}
                      onClick={() => unrehostPrintingImage.mutate(effectiveImage.id)}
                    >
                      <XIcon className="size-3.5" />
                      Un-rehost (delete files)
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem
                      disabled={deletePrintingImage.isPending}
                      onClick={() => deletePrintingImage.mutate(effectiveImage.id)}
                    >
                      <Trash2Icon className="text-destructive size-3.5" />
                      <span className="text-destructive">Remove</span>
                    </DropdownMenuItem>
                  )}
                </>
              )}
              {isAdmin && (
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
              {isAdmin && !activeFrontImage && (
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
        </div>
      )}
      {sortedImages.length > 0 && (
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Which image"
          className="max-w-full flex-wrap"
          value={effectiveImage ? [effectiveImage.id] : []}
          onValueChange={([next]) => {
            setSelectedId(next ?? null);
            setResolution(null);
            setImgError(false);
          }}
        >
          {sortedImages.map((img) => (
            <ToggleGroupItem key={img.id} value={img.id}>
              {imageLabel(img)} ({img.face})
              {!img.rehostedUrl && (
                <span title="Not rehosted" className="inline-flex">
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
          invalidates={invalidates}
          open={straightening}
          onOpenChange={setStraightening}
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
            uploadPrintingImage.mutate({ printingId, file, mode: "main" });
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
            disabled={!urlValue.trim() || addImageFromUrl.isPending}
            onClick={() => {
              addImageFromUrl.mutate(
                {
                  printingId,
                  url: urlValue.trim(),
                  mode: "main",
                },
                {
                  onSuccess: () => {
                    setUrlValue("");
                    setShowUrlInput(false);
                  },
                },
              );
            }}
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

      {/* Shown only while the printing has no active front image; a pin persists and reactivates if that image is later removed. */}
      {!activeFrontImage && (
        <div className="space-y-1 pt-4">
          <div className="flex min-h-6 items-center gap-1">
            <span className="text-muted-foreground shrink-0 text-xs">Substitute</span>
            {fallbackArtMode === "pinned" && fallbackImageFileId !== null && (
              <ImgWithFallback
                src={imageUrl(fallbackImageFileId, "120w")}
                alt="Pinned substitute art"
                className="h-8 w-auto rounded-sm"
                fallback={
                  <Badge variant="outline" className="text-warning">
                    Not rehosted
                  </Badge>
                }
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
              <Select
                items={items}
                value={
                  fallbackArtMode === "pinned"
                    ? `pin:${fallbackImageFileId ?? ""}`
                    : fallbackArtMode
                }
                disabled={setFallbackArt.isPending}
                onValueChange={(next) => {
                  if (next === "auto" || next === "none") {
                    setFallbackArt.mutate({ printingId, mode: next });
                    return;
                  }
                  if (typeof next === "string" && next.startsWith("pin:")) {
                    setFallbackArt.mutate({
                      printingId,
                      mode: "pinned",
                      imageFileId: next.slice("pin:".length),
                    });
                  }
                }}
              >
                <SelectTrigger className="h-7 w-full" aria-label="Which substitute art">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                disabled={!fallbackUrlValue.trim() || addFallbackArtUrl.isPending}
                onClick={() => {
                  addFallbackArtUrl.mutate(
                    { printingId, url: fallbackUrlValue.trim() },
                    {
                      onSuccess: () => {
                        setFallbackUrlValue("");
                        setShowFallbackUrlInput(false);
                      },
                    },
                  );
                }}
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
            uploadFallbackArt.mutate({ printingId, file });
            e.target.value = "";
          }
        }}
      />
    </div>
  );
}
