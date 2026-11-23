import type { DeskImage, DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";
import type {
  AdminCardDetailResponse,
  AdminPrintingImageResponse,
  AdminPrintingResponse,
  ProviderSettingResponse,
} from "@openrift/shared/types/api/admin";
import {
  ArrowLeftRightIcon,
  ContrastIcon,
  CropIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  ImagePlusIcon,
  RotateCcwIcon,
  RotateCwIcon,
  ScissorsIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dropzone } from "@/components/ui/dropzone";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { findDerivedArtPrinting } from "@/features/admin/components/card-detail-shared";
import { PrintingImageBox } from "@/features/admin/components/printing-image-box";
import { PrintingImageSwitcher } from "@/features/admin/components/printing-image-switcher";
import { RehostStatusBadge } from "@/features/admin/components/rehost-status-badge";
import { StraightenImageDialog } from "@/features/admin/components/straighten-image-dialog";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import {
  useActivatePrintingImage,
  useAddImageFromUrl,
  useDeletePrintingImage,
  useKeepPrintingImage,
  useImageEditPending,
  useRehostPrintingImage,
  useRotatePrintingImage,
  useSetPrintingImageNeedsLevels,
  useSetPrintingImageNeedsTrim,
  useUploadPrintingImage,
} from "@/features/admin/hooks/use-admin-image-mutations";
import { useSetDeskImageFace, useUpdateDeskImage } from "@/features/admin/hooks/use-printing-desk";
import { adminKeys, IMAGE_FILE_SCOPE } from "@/features/admin/lib/admin-query-keys";
import { hasAdminSection } from "@/features/admin/lib/admin-sections";
import { deskImageSrc } from "@/features/admin/lib/printing-desk-image";
import { printingImageDisplayUrl } from "@/features/admin/lib/printing-image-display-url";
import { siblingImagesOf } from "@/features/admin/lib/sibling-images";
import { imageQuadOf } from "@/features/admin/lib/straighten-quad";
import { RecordSection } from "@/features/catalog-workspace/components/record/record-pane";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import { useSession } from "@/hooks/use-session";
import { errorText } from "@/lib/error-text";
import { runReportedMutation } from "@/lib/run-reported-mutation";

type Rotation = 0 | 90 | 180 | 270;
type Scope = readonly (readonly unknown[])[];

function sideOf(printing: AdminPrintingResponse): "front" | "back" {
  return printing.side === 2 ? "back" : "front";
}

export function FaceImagesSection({
  cardSlug,
  face,
  detail,
  images,
  printings,
  providerSettings,
  isAdmin,
  landscape,
}: {
  cardSlug: string;
  face: AdminPrintingResponse;
  detail: AdminCardDetailResponse;
  images: readonly AdminPrintingImageResponse[];
  printings: readonly AdminPrintingResponse[];
  providerSettings: ProviderSettingResponse[];
  isAdmin: boolean;
  landscape: boolean;
}) {
  const queueWrite = useQueueWorkspaceWrite();
  const scope: Scope = [
    adminKeys.cards.detail(cardSlug),
    adminKeys.cards.list,
    adminKeys.printingDesk.all,
    adminKeys.workspace,
  ];
  const upload = useUploadPrintingImage(scope, { inlineError: true });
  const addFromUrl = useAddImageFromUrl(scope);
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [urlOpen, setUrlOpen] = useState(false);
  const [url, setUrl] = useState("");

  const side = sideOf(face);
  const printingIds = new Set(printings.map((printing) => printing.id));
  const inactive = images.filter((image) => !image.isActive);
  const hasActive = images.some((image) => image.isActive);
  const derived = findDerivedArtPrinting(face, detail.printings, detail.printingImages);

  async function addUrl() {
    const input = {
      printingId: face.id,
      url: url.trim(),
      face: side,
      mode: hasActive ? ("additional" as const) : ("main" as const),
    };
    if (await queueWrite((signal) => addFromUrl.mutateAsync(input, { signal }))) {
      setUrl("");
      setUrlOpen(false);
    }
  }

  async function handleFiles(files: File[]) {
    setUploadError(null);
    for (const [index, file] of files.entries()) {
      setUploading((count) => count + 1);
      await queueWrite(
        (signal) =>
          runReportedMutation(
            () =>
              upload.mutateAsync(
                {
                  printingId: face.id,
                  file,
                  face: side,
                  mode: !hasActive && index === 0 ? "main" : "additional",
                },
                { signal },
              ),
            (error) => setUploadError(errorText(error, `Could not upload ${file.name}.`)),
          ),
        { limit: "upload" },
      );
      setUploading((count) => count - 1);
    }
  }

  return (
    <RecordSection title="Images">
      <div className="flex flex-col gap-4 lg:flex-row">
        <PrintingImageSwitcher
          key={face.id}
          printingId={face.id}
          face={side}
          printingLabel={face.expectedPrintingId}
          images={images.filter((image) => image.isActive)}
          siblingImages={siblingImagesOf(detail.printingImages, detail.printings, printingIds)}
          derivedArtLabel={derived?.expectedPrintingId ?? null}
          fallbackArtMode={face.fallbackArtMode}
          fallbackImageFileId={face.fallbackImageFileId}
          providerSettings={providerSettings}
          invalidates={scope}
          isAdmin={isAdmin}
          runWrite={queueWrite}
        />

        <div className="min-w-0 flex-1 space-y-2">
          {inactive.map((image) => (
            <InactiveImageRow
              key={image.id}
              image={image}
              face={face}
              scope={scope}
              isAdmin={isAdmin}
              landscape={landscape}
            />
          ))}

          {inactive.length === 0 && (
            <p className="text-muted-foreground text-sm">No new images for this face.</p>
          )}

          {isAdmin && (
            <>
              <Dropzone
                multiple
                accept="image/*"
                disabled={uploading > 0}
                icon={<UploadIcon className="text-muted-foreground size-5" />}
                label="Drop images or click to upload"
                hint="JPG, PNG or WebP, up to 50 MB each."
                onFiles={(files) => void handleFiles(files)}
              />
              {uploading > 0 && (
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Spinner />
                  Uploading…
                </p>
              )}
              {uploadError !== null && <p className="text-destructive text-sm">{uploadError}</p>}
              {urlOpen ? (
                <div className="flex gap-1">
                  <Input
                    aria-label="Image address"
                    placeholder="https://…"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    disabled={url.trim().length === 0}
                    pending={addFromUrl.isPending}
                    onClick={() => void addUrl()}
                  >
                    Add
                  </Button>
                  <Button variant="ghost" onClick={() => setUrlOpen(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setUrlOpen(true)}>
                  <ImagePlusIcon />
                  Add from URL…
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </RecordSection>
  );
}

function InactiveImageRow({
  image,
  face,
  scope,
  isAdmin,
  landscape,
}: {
  image: AdminPrintingImageResponse;
  face: AdminPrintingResponse;
  scope: Scope;
  isAdmin: boolean;
  landscape: boolean;
}) {
  const queueWrite = useQueueWorkspaceWrite();
  const activate = useActivatePrintingImage(scope);
  const remove = useDeletePrintingImage(scope);
  const keep = useKeepPrintingImage(scope);
  const { data: access } = useAdminAccess();
  const canKeep = hasAdminSection(access, "card-review");
  const rotate = useRotatePrintingImage();
  const setNeedsTrim = useSetPrintingImageNeedsTrim();
  const setNeedsLevels = useSetPrintingImageNeedsLevels();
  const editing = useImageEditPending(image.id);
  const rehost = useRehostPrintingImage();
  const moveFace = useSetDeskImageFace();
  const [straightening, setStraightening] = useState(false);

  const pending = activate.isPending || remove.isPending || keep.isPending;
  const otherSide = face.side === 2 ? "front" : "back";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
      <PrintingImageBox
        url={printingImageDisplayUrl(image)}
        alt="Inactive image"
        href={image.originalUrl ?? undefined}
        className="w-20"
        landscape={landscape}
      />
      <span className="min-w-0 flex-1 space-y-1">
        <Badge variant="secondary">{image.isReviewed ? "Extra" : "Waiting for review"}</Badge>
        <RehostStatusBadge image={image} />
      </span>
      {isAdmin && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          pending={remove.isPending}
          onClick={() => void queueWrite((signal) => remove.mutateAsync(image.id, { signal }))}
        >
          Delete
        </Button>
      )}
      {canKeep && !image.isReviewed && !image.activateWhenRehosted && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          pending={keep.isPending}
          onClick={() => void queueWrite((signal) => keep.mutateAsync(image.id, { signal }))}
        >
          Keep as extra
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        pending={activate.isPending}
        onClick={() =>
          void queueWrite((signal) =>
            activate.mutateAsync({ imageId: image.id, active: true }, { signal }),
          )
        }
      >
        Make main
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="icon-sm" aria-label="Image tools" />}
        >
          <EllipsisVerticalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {image.rehostedUrl === null && image.originalUrl !== null && (
            <DropdownMenuItem
              onClick={() => void queueWrite((signal) => rehost.mutateAsync(image.id, { signal }))}
            >
              <DownloadIcon />
              Rehost
            </DropdownMenuItem>
          )}
          {image.activateWhenRehosted && (
            <DropdownMenuItem
              onClick={() =>
                void queueWrite((signal) =>
                  activate.mutateAsync({ imageId: image.id, active: false }, { signal }),
                )
              }
            >
              <XIcon />
              Cancel going live
            </DropdownMenuItem>
          )}
          {image.rehostedUrl !== null && (
            <>
              <DropdownMenuItem
                disabled={editing}
                onClick={() =>
                  void queueWrite((signal) =>
                    rotate.mutateAsync(
                      {
                        imageId: image.id,
                        rotation: ((image.rotation + 270) % 360) as Rotation,
                      },
                      { signal },
                    ),
                  )
                }
              >
                <RotateCcwIcon />
                Rotate left
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={editing}
                onClick={() =>
                  void queueWrite((signal) =>
                    rotate.mutateAsync(
                      {
                        imageId: image.id,
                        rotation: ((image.rotation + 90) % 360) as Rotation,
                      },
                      { signal },
                    ),
                  )
                }
              >
                <RotateCwIcon />
                Rotate right
              </DropdownMenuItem>
              <DropdownMenuItem disabled={editing} onClick={() => setStraightening(true)}>
                <CropIcon />
                Straighten…
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={editing}
                onClick={() =>
                  void queueWrite((signal) =>
                    setNeedsTrim.mutateAsync(
                      { imageId: image.id, needsTrim: !image.needsTrim },
                      { signal },
                    ),
                  )
                }
              >
                <ScissorsIcon />
                {image.needsTrim ? "Turn auto-trim off" : "Turn auto-trim on"}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={editing}
                onClick={() =>
                  void queueWrite((signal) =>
                    setNeedsLevels.mutateAsync(
                      { imageId: image.id, needsLevels: !image.needsLevels },
                      { signal },
                    ),
                  )
                }
              >
                <ContrastIcon />
                {image.needsLevels ? "Turn contrast off" : "Turn contrast on"}
              </DropdownMenuItem>
            </>
          )}
          {isAdmin && face.otherFace !== null && (
            <DropdownMenuItem
              onClick={() =>
                void queueWrite((signal) =>
                  moveFace.mutateAsync(
                    {
                      printingImageId: image.id,
                      printingId: face.id,
                      face: otherSide,
                    },
                    { signal },
                  ),
                )
              }
            >
              <ArrowLeftRightIcon />
              Move to {face.otherFace.cardName}
            </DropdownMenuItem>
          )}
          {isAdmin && (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => void queueWrite((signal) => remove.mutateAsync(image.id, { signal }))}
            >
              <Trash2Icon />
              Remove
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {image.rehostedUrl !== null && (
        <StraightenImageDialog
          imageId={image.id}
          quad={imageQuadOf(image)}
          open={straightening}
          onOpenChange={setStraightening}
          runWrite={queueWrite}
        />
      )}
    </div>
  );
}

export function DeskFaceImagesSection({
  printing,
  imageFace,
  images,
  canEdit,
  landscape,
}: {
  printing: DeskPrintingRow;
  imageFace: DeskImage["face"];
  images: DeskImage[];
  canEdit: boolean;
  landscape: boolean;
}) {
  const queueWrite = useQueueWorkspaceWrite();
  const { data: session } = useSession();
  const upload = useUploadPrintingImage(IMAGE_FILE_SCOPE, { inlineError: true });
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const faceImages = images.filter((image) => image.face === imageFace);
  const active = faceImages.find((image) => image.isActive) ?? null;
  const waiting = faceImages.filter((image) => !image.isActive);
  const uploaderName = session?.user.name ?? "";

  async function handleFiles(files: File[]) {
    setUploadError(null);
    const credit = uploaderName.length > 0 ? uploaderName : undefined;
    for (const file of files) {
      setUploading((count) => count + 1);
      await queueWrite(
        (signal) =>
          runReportedMutation(
            () =>
              upload.mutateAsync(
                {
                  printingId: printing.printingId,
                  file,
                  mode: "additional",
                  face: imageFace,
                  credit,
                },
                { signal },
              ),
            (error) => setUploadError(errorText(error, `Could not upload ${file.name}.`)),
          ),
        { limit: "upload" },
      );
      setUploading((count) => count - 1);
    }
  }

  return (
    <RecordSection title="Images">
      <p className="text-muted-foreground text-sm">Images are public with your credit.</p>
      <div className="flex flex-wrap gap-3">
        <div className="space-y-1">
          <PrintingImageBox
            url={active === null ? null : deskImageSrc(active.url, "400w")}
            alt={`Active image for ${printing.cardName}`}
            className="w-40"
            landscape={landscape}
          />
          <Badge variant="default">Active</Badge>
        </div>
        {waiting.map((image) => (
          <DeskWaitingImage
            key={image.printingImageId}
            printing={printing}
            image={image}
            landscape={landscape}
          />
        ))}
      </div>
      {canEdit && (
        <>
          <Dropzone
            multiple
            accept="image/*"
            disabled={uploading > 0}
            icon={<UploadIcon className="text-muted-foreground size-5" />}
            label="Drop images or click to upload"
            hint="An admin activates uploads."
            onFiles={(files) => void handleFiles(files)}
          />
          {uploading > 0 && (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Spinner />
              Uploading…
            </p>
          )}
          {uploadError !== null && <p className="text-destructive text-sm">{uploadError}</p>}
        </>
      )}
    </RecordSection>
  );
}

function DeskWaitingImage({
  printing,
  image,
  landscape,
}: {
  printing: DeskPrintingRow;
  image: DeskImage;
  landscape: boolean;
}) {
  const queueWrite = useQueueWorkspaceWrite();
  const rotate = useRotatePrintingImage();
  const remove = useDeletePrintingImage(IMAGE_FILE_SCOPE);
  const editing = useImageEditPending(image.printingImageId);
  const updateImage = useUpdateDeskImage();
  const moveFace = useSetDeskImageFace();
  const [straightening, setStraightening] = useState(false);
  const [credit, setCredit] = useState(image.credit ?? "");
  const [lastCredit, setLastCredit] = useState(image.credit ?? "");
  if ((image.credit ?? "") !== lastCredit) {
    setLastCredit(image.credit ?? "");
    setCredit(image.credit ?? "");
  }

  const ownTools = image.canDelete;
  const otherFace = image.face === "front" ? "back" : "front";

  function saveCredit() {
    const next = credit.trim();
    if (next !== (image.credit ?? "")) {
      void queueWrite((signal) =>
        updateImage.mutateAsync(
          {
            imageFileId: image.imageFileId,
            credit: next.length > 0 ? next : null,
          },
          { signal },
        ),
      );
    }
  }

  return (
    <div className="w-40 space-y-1">
      <PrintingImageBox
        url={deskImageSrc(image.url, "400w")}
        alt={`Upload for ${printing.cardName}`}
        className="w-40"
        landscape={landscape}
      />
      <Badge variant="warning">Waiting for an admin</Badge>
      {ownTools && (
        <>
          <Input
            aria-label="Image credit"
            value={credit}
            placeholder="Who made this image"
            onChange={(event) => setCredit(event.target.value)}
            onBlur={saveCredit}
          />
          <span className="flex flex-wrap items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Turn right"
              disabled={editing}
              pending={rotate.isPending}
              onClick={() =>
                void queueWrite((signal) =>
                  rotate.mutateAsync(
                    {
                      imageId: image.printingImageId,
                      rotation: ((image.rotation + 90) % 360) as Rotation,
                    },
                    { signal },
                  ),
                )
              }
            >
              <RotateCwIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Straighten"
              disabled={editing}
              onClick={() => setStraightening(true)}
            >
              <CropIcon />
            </Button>
            {printing.secondSide !== null && (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Move to the other face"
                pending={moveFace.isPending}
                onClick={() =>
                  void queueWrite((signal) =>
                    moveFace.mutateAsync(
                      {
                        printingImageId: image.printingImageId,
                        printingId: printing.printingId,
                        face: otherFace,
                      },
                      { signal },
                    ),
                  )
                }
              >
                <ArrowLeftRightIcon />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Delete image"
              pending={remove.isPending}
              onClick={() =>
                void queueWrite((signal) => remove.mutateAsync(image.printingImageId, { signal }))
              }
            >
              <Trash2Icon />
            </Button>
          </span>
          <StraightenImageDialog
            imageId={image.printingImageId}
            quad={image.quad}
            open={straightening}
            onOpenChange={setStraightening}
            runWrite={queueWrite}
          />
        </>
      )}
    </div>
  );
}
