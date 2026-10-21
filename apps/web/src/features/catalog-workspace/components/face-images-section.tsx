import type { DeskImage, DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";
import type {
  AdminCardDetailResponse,
  AdminPrintingImageResponse,
  AdminPrintingResponse,
  ProviderSettingResponse,
} from "@openrift/shared/types/api/admin";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRightIcon,
  CropIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  ImagePlusIcon,
  RotateCcwIcon,
  RotateCwIcon,
  ScissorsIcon,
  Trash2Icon,
  UploadIcon,
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
import type { SiblingImage } from "@/features/admin/components/printing-image-switcher";
import { PrintingImageSwitcher } from "@/features/admin/components/printing-image-switcher";
import { StraightenImageDialog } from "@/features/admin/components/straighten-image-dialog";
import {
  useActivatePrintingImage,
  useAddImageFromUrl,
  useDeletePrintingImage,
  useRehostPrintingImage,
  useRotatePrintingImage,
  useSetCandidatePrintingImage,
  useSetPrintingImageNeedsTrim,
  useUploadPrintingImage,
} from "@/features/admin/hooks/use-admin-image-mutations";
import { useSetDeskImageFace, useUpdateDeskImage } from "@/features/admin/hooks/use-printing-desk";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { deskImageBust, deskImageSrc } from "@/features/admin/lib/printing-desk-image";
import { printingImageDisplayUrl } from "@/features/admin/lib/printing-image-display-url";
import { imageQuadOf } from "@/features/admin/lib/straighten-quad";
import { cardsKeys, catalogKeys, promosKeys } from "@/features/cards/lib/cards-query-keys";
import { RecordSection } from "@/features/catalog-workspace/components/record/record-pane";
import { SuggestionChip } from "@/features/catalog-workspace/components/record/suggestion-chip";
import type { FaceChip } from "@/features/catalog-workspace/hooks/use-face-record-actions";
import type { FaceSuggestionModel } from "@/features/catalog-workspace/lib/face-suggestion-rows";
import { useSession } from "@/hooks/use-session";
import { errorText } from "@/lib/error-text";

type Rotation = 0 | 90 | 180 | 270;
type Scope = readonly (readonly unknown[])[];

const DESK_IMAGE_SCOPE: Scope = [
  adminKeys.printingDesk.all,
  adminKeys.cards.all,
  adminKeys.workspace,
  catalogKeys.all,
  cardsKeys.all,
  promosKeys.all,
];

function sideOf(printing: AdminPrintingResponse): "front" | "back" {
  return printing.side === 2 ? "back" : "front";
}

function siblingImagesOf(
  detail: AdminCardDetailResponse,
  facePrintingIds: ReadonlySet<string>,
): SiblingImage[] {
  const seen = new Set<string>();
  const siblings: SiblingImage[] = [];
  for (const image of detail.printingImages) {
    if (facePrintingIds.has(image.printingId) || seen.has(image.imageFileId)) {
      continue;
    }
    seen.add(image.imageFileId);
    const owner = detail.printings.find((printing) => printing.id === image.printingId);
    siblings.push({
      imageFileId: image.imageFileId,
      printingLabel: owner?.expectedPrintingId ?? image.printingId,
    });
  }
  return siblings;
}

export function FaceImagesSection({
  cardSlug,
  face,
  detail,
  model,
  providerSettings,
  isAdmin,
  chips,
  hotkeyOf,
  discardLabelOf,
  pending,
  onUse,
  onDiscard,
  onReject,
  landscape,
}: {
  cardSlug: string;
  face: AdminPrintingResponse;
  detail: AdminCardDetailResponse;
  model: FaceSuggestionModel;
  providerSettings: ProviderSettingResponse[];
  isAdmin: boolean;
  chips: FaceChip[];
  hotkeyOf: (key: string) => number | undefined;
  discardLabelOf: (candidatePrintingId: string, provider: string) => string;
  pending: boolean;
  onUse: (chip: FaceChip) => void;
  onDiscard: (candidatePrintingId: string) => void;
  onReject: (candidateCardId: string) => void;
  landscape: boolean;
}) {
  const scope: Scope = [
    adminKeys.cards.detail(cardSlug),
    adminKeys.cards.list,
    adminKeys.printingDesk.all,
    adminKeys.workspace,
  ];
  const upload = useUploadPrintingImage(scope);
  const addFromUrl = useAddImageFromUrl(scope);
  const setCandidateImage = useSetCandidatePrintingImage(scope);
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [urlOpen, setUrlOpen] = useState(false);
  const [url, setUrl] = useState("");

  const side = sideOf(face);
  const printingIds = new Set(model.printings.map((printing) => printing.id));
  const inactive = model.images.filter((image) => !image.isActive);
  const hasActive = model.images.some((image) => image.isActive);
  const imageChips = chips.filter(
    (chip): chip is Extract<FaceChip, { kind: "image" }> => chip.kind === "image",
  );
  const derived = findDerivedArtPrinting(face, detail.printings, detail.printingImages);

  async function handleFiles(files: File[]) {
    setUploadError(null);
    for (const [index, file] of files.entries()) {
      setUploading((count) => count + 1);
      await upload
        .mutateAsync({
          printingId: face.id,
          file,
          face: side,
          mode: !hasActive && index === 0 ? "main" : "additional",
        })
        .catch((error: unknown) =>
          setUploadError(errorText(error, `Could not upload ${file.name}.`)),
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
          images={model.images.filter((image) => image.isActive)}
          siblingImages={siblingImagesOf(detail, printingIds)}
          derivedArtLabel={derived?.expectedPrintingId ?? null}
          fallbackArtMode={face.fallbackArtMode}
          fallbackImageFileId={face.fallbackImageFileId}
          providerSettings={providerSettings}
          invalidates={scope}
          isAdmin={isAdmin}
        />

        <div className="min-w-0 flex-1 space-y-2">
          {imageChips.map((chip) => {
            const { candidate, provider, url: imageUrl, isContributor } = chip.image;
            return (
              <SuggestionChip
                key={chip.key}
                tone={isContributor ? "contributor" : "source"}
                sourceLabel={isContributor ? "Contributor photo" : `${provider} scan`}
                value={
                  <PrintingImageBox
                    url={imageUrl}
                    alt={`${provider} image`}
                    href={imageUrl}
                    className="w-20"
                    landscape={landscape}
                  />
                }
                hotkey={hotkeyOf(chip.key)}
                pending={pending}
                onUse={() => onUse(chip)}
                onDiscard={isContributor || !isAdmin ? undefined : () => onDiscard(candidate.id)}
                discardLabel={discardLabelOf(candidate.id, provider)}
                onReject={isContributor ? () => onReject(candidate.candidateCardId) : undefined}
                menu={
                  isContributor ? undefined : (
                    <DropdownMenuItem
                      onClick={() =>
                        setCandidateImage.mutate({
                          candidatePrintingId: candidate.id,
                          mode: "additional",
                        })
                      }
                    >
                      <ImagePlusIcon />
                      Use as additional image
                    </DropdownMenuItem>
                  )
                }
              />
            );
          })}

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

          {imageChips.length === 0 && inactive.length === 0 && (
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
                    disabled={url.trim().length === 0 || addFromUrl.isPending}
                    onClick={() =>
                      addFromUrl.mutate(
                        {
                          printingId: face.id,
                          url: url.trim(),
                          face: side,
                          mode: hasActive ? "additional" : "main",
                        },
                        {
                          onSuccess: () => {
                            setUrl("");
                            setUrlOpen(false);
                          },
                        },
                      )
                    }
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
  const queryClient = useQueryClient();
  const activate = useActivatePrintingImage(scope);
  const remove = useDeletePrintingImage(scope);
  const rotate = useRotatePrintingImage(scope);
  const setNeedsTrim = useSetPrintingImageNeedsTrim(scope);
  const rehost = useRehostPrintingImage(scope);
  const moveFace = useSetDeskImageFace();
  const [straightening, setStraightening] = useState(false);

  const pending = activate.isPending || remove.isPending;
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
        <Badge variant="secondary">Not active</Badge>
        {image.rehostedUrl === null && <Badge variant="destructive">Not rehosted</Badge>}
      </span>
      {isAdmin && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => remove.mutate(image.id)}
        >
          Discard
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => activate.mutate({ imageId: image.id, active: true })}
      >
        Use
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="icon-sm" aria-label="Image tools" />}
        >
          <EllipsisVerticalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {image.rehostedUrl === null && image.originalUrl !== null && (
            <DropdownMenuItem onClick={() => rehost.mutate(image.id)}>
              <DownloadIcon />
              Rehost
            </DropdownMenuItem>
          )}
          {image.rehostedUrl !== null && (
            <>
              <DropdownMenuItem
                onClick={() =>
                  rotate.mutate({
                    imageId: image.id,
                    rotation: ((image.rotation + 270) % 360) as Rotation,
                  })
                }
              >
                <RotateCcwIcon />
                Rotate left
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  rotate.mutate({
                    imageId: image.id,
                    rotation: ((image.rotation + 90) % 360) as Rotation,
                  })
                }
              >
                <RotateCwIcon />
                Rotate right
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStraightening(true)}>
                <CropIcon />
                Straighten…
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  setNeedsTrim.mutate({ imageId: image.id, needsTrim: !image.needsTrim })
                }
              >
                <ScissorsIcon />
                {image.needsTrim ? "Turn auto-trim off" : "Turn auto-trim on"}
              </DropdownMenuItem>
            </>
          )}
          {isAdmin && face.otherFace !== null && (
            <DropdownMenuItem
              onClick={() =>
                moveFace.mutate(
                  { printingImageId: image.id, printingId: face.id, face: otherSide },
                  {
                    onSettled: () =>
                      void queryClient.invalidateQueries({ queryKey: adminKeys.workspace }),
                  },
                )
              }
            >
              <ArrowLeftRightIcon />
              Move to {face.otherFace.cardName}
            </DropdownMenuItem>
          )}
          {isAdmin && (
            <DropdownMenuItem variant="destructive" onClick={() => remove.mutate(image.id)}>
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
          invalidates={scope}
          open={straightening}
          onOpenChange={setStraightening}
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
  const { data: session } = useSession();
  const upload = useUploadPrintingImage(DESK_IMAGE_SCOPE);
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
      await upload
        .mutateAsync({
          printingId: printing.printingId,
          file,
          mode: "additional",
          face: imageFace,
          credit,
        })
        .catch((error: unknown) =>
          setUploadError(errorText(error, `Could not upload ${file.name}.`)),
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
            url={active === null ? null : deskImageSrc(active.url, "400w", deskImageBust(active))}
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
  const queryClient = useQueryClient();
  const rotate = useRotatePrintingImage(DESK_IMAGE_SCOPE);
  const remove = useDeletePrintingImage(DESK_IMAGE_SCOPE);
  const updateImage = useUpdateDeskImage();
  const moveFace = useSetDeskImageFace();
  const [straightening, setStraightening] = useState(false);
  const [credit, setCredit] = useState(image.credit ?? "");
  const [lastCredit, setLastCredit] = useState(image.credit ?? "");
  if ((image.credit ?? "") !== lastCredit) {
    setLastCredit(image.credit ?? "");
    setCredit(image.credit ?? "");
  }

  const settle = {
    onSettled: () => void queryClient.invalidateQueries({ queryKey: adminKeys.workspace }),
  };
  const ownTools = image.canDelete;
  const otherFace = image.face === "front" ? "back" : "front";

  function saveCredit() {
    const next = credit.trim();
    if (next !== (image.credit ?? "")) {
      updateImage.mutate(
        { imageFileId: image.imageFileId, credit: next.length > 0 ? next : null },
        settle,
      );
    }
  }

  return (
    <div className="w-40 space-y-1">
      <PrintingImageBox
        url={deskImageSrc(image.url, "400w", deskImageBust(image))}
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
              disabled={rotate.isPending}
              onClick={() =>
                rotate.mutate({
                  imageId: image.printingImageId,
                  rotation: ((image.rotation + 90) % 360) as Rotation,
                })
              }
            >
              <RotateCwIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Straighten"
              onClick={() => setStraightening(true)}
            >
              <CropIcon />
            </Button>
            {printing.secondSide !== null && (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Move to the other face"
                disabled={moveFace.isPending}
                onClick={() =>
                  moveFace.mutate(
                    {
                      printingImageId: image.printingImageId,
                      printingId: printing.printingId,
                      face: otherFace,
                    },
                    settle,
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
              disabled={remove.isPending}
              onClick={() => remove.mutate(image.printingImageId)}
            >
              <Trash2Icon />
            </Button>
          </span>
          <StraightenImageDialog
            imageId={image.printingImageId}
            quad={image.quad}
            invalidates={DESK_IMAGE_SCOPE}
            open={straightening}
            onOpenChange={setStraightening}
          />
        </>
      )}
    </div>
  );
}
