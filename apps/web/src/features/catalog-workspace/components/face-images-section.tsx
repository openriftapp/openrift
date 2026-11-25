import type { DeskImage, DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";
import { formatDay } from "@openrift/shared/format-date";
import type {
  AdminCardDetailResponse,
  AdminPrintingImageResponse,
  AdminPrintingResponse,
  ProviderSettingResponse,
} from "@openrift/shared/types/api/admin";
import {
  ArrowLeftRightIcon,
  CropIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  ImagePlusIcon,
  RotateCwIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import type { ReactNode } from "react";
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
import { Pressable } from "@/components/ui/pressable";
import { SectionHeading } from "@/components/ui/section-heading";
import { Spinner } from "@/components/ui/spinner";
import { TextLink } from "@/components/ui/text-link";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { findDerivedArtPrinting } from "@/features/admin/components/card-detail-shared";
import { ImageEditMenuItems } from "@/features/admin/components/image-edit-menu-items";
import { PrintingImageBox } from "@/features/admin/components/printing-image-box";
import { PrintingImageSwitcher } from "@/features/admin/components/printing-image-switcher";
import { RehostStatusBadge } from "@/features/admin/components/rehost-status-badge";
import { StraightenImageDialog } from "@/features/admin/components/straighten-image-dialog";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import {
  useSetCandidatePrintingImage,
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
import { buildAttentionSubmissions } from "@/features/admin/lib/attention-items";
import { deskImageSrc } from "@/features/admin/lib/printing-desk-image";
import { printingImageDisplayUrl } from "@/features/admin/lib/printing-image-display-url";
import { siblingImagesOf } from "@/features/admin/lib/sibling-images";
import { imageQuadOf } from "@/features/admin/lib/straighten-quad";
import { ContributionBlock } from "@/features/catalog-workspace/components/pass/pass-parts";
import { useSubmissionDecisions } from "@/features/catalog-workspace/components/pass/submission-decisions";
import { RecordSection } from "@/features/catalog-workspace/components/record/record-pane";
import { useDismissSuggestion } from "@/features/catalog-workspace/hooks/use-dismiss-suggestion";
import { useFaceSuggestionWrites } from "@/features/catalog-workspace/hooks/use-face-record-actions";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import { imageOrigin, passContributor } from "@/features/catalog-workspace/lib/card-pass";
import type { SourceImageCandidate } from "@/features/catalog-workspace/lib/face-suggestion-rows";
import { useCostKeywords } from "@/hooks/use-keyword-styles";
import { useSession } from "@/hooks/use-session";
import { errorText } from "@/lib/error-text";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { cn } from "@/lib/utils";

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
  sourceImages,
}: {
  cardSlug: string;
  face: AdminPrintingResponse;
  detail: AdminCardDetailResponse;
  images: readonly AdminPrintingImageResponse[];
  sourceImages: readonly SourceImageCandidate[];
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
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mode, setMode] = useState<CompareMode>("side");
  const costKeywords = useCostKeywords();
  const submissions = buildAttentionSubmissions(detail, costKeywords);
  const decisions = useSubmissionDecisions({ cardSlug, detail, submissions, isAdmin });
  const writes = useFaceSuggestionWrites({
    cardSlug,
    record: face.expectedPrintingId,
    face,
  });

  const side = sideOf(face);
  const printingIds = new Set(printings.map((printing) => printing.id));
  const inactive = images.filter((image) => !image.isActive);
  const actives = images.filter((image) => image.isActive);
  const active = actives.at(0);
  const hasActive = active !== undefined;
  const currentUrl = active === undefined ? null : printingImageDisplayUrl(active);
  const listed = sourceImages.filter((image) => !image.isContributor);
  const contributed = sourceImages.filter((image) => image.isContributor);
  const selectedStored = inactive.find((image) => selectedKey === `stored:${image.id}`);
  const selectedSource = listed.find((image) => selectedKey === `source:${image.candidate.id}`);
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
      setAdding(false);
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
    <RecordSection
      title="Images"
      actions={
        isAdmin &&
        !adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <ImagePlusIcon />
            Add image
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4 lg:flex-row">
        {(actives.length === 0 ? [undefined] : actives).map((current) => (
          <PrintingImageSwitcher
            key={current?.id ?? face.id}
            printingId={face.id}
            face={side}
            printingLabel={face.expectedPrintingId}
            images={current === undefined ? [] : [current]}
            caption={
              current === undefined
                ? "No image"
                : `${imageOrigin(detail, current)}, added ${formatDay(current.addedAt)}`
            }
            siblingImages={siblingImagesOf(detail.printingImages, detail.printings, printingIds)}
            derivedArtLabel={derived?.expectedPrintingId ?? null}
            fallbackArtMode={face.fallbackArtMode}
            fallbackImageFileId={face.fallbackImageFileId}
            providerSettings={providerSettings}
            invalidates={scope}
            isAdmin={isAdmin}
            runWrite={queueWrite}
          />
        ))}

        {selectedStored !== undefined && (
          <StoredCandidate
            key={selectedStored.id}
            image={selectedStored}
            caption={`${imageOrigin(detail, selectedStored)}, added ${formatDay(selectedStored.addedAt)}`}
            currentUrl={currentUrl}
            mode={mode}
            face={face}
            scope={scope}
            isAdmin={isAdmin}
            landscape={landscape}
          />
        )}
        {selectedSource !== undefined && (
          <SourceCandidate
            key={selectedSource.candidate.id}
            image={selectedSource}
            currentUrl={currentUrl}
            mode={mode}
            scope={scope}
            record={face.expectedPrintingId}
            hasActive={hasActive}
            isAdmin={isAdmin}
            landscape={landscape}
            pending={writes.pending}
            onUse={() =>
              void queueWrite((signal) =>
                writes.applyChip(signal, {
                  kind: "image",
                  key: selectedSource.candidate.id,
                  image: selectedSource,
                }),
              )
            }
          />
        )}

        <div className="min-w-0 space-y-3 lg:w-64 lg:shrink-0">
          {(selectedStored !== undefined || selectedSource !== undefined) && (
            <ToggleGroup
              variant="outline"
              size="sm"
              spacing={0}
              aria-label="Compare"
              value={[mode]}
              onValueChange={([next]) => {
                if (next === "side" || next === "flip") {
                  setMode(next);
                }
              }}
            >
              <ToggleGroupItem value="side">Side by side</ToggleGroupItem>
              <ToggleGroupItem value="flip">Flip</ToggleGroupItem>
            </ToggleGroup>
          )}
          {inactive.length > 0 && (
            <CandidateGroup title="Stored">
              {inactive.map((image) => (
                <CandidateRow
                  key={image.id}
                  url={printingImageDisplayUrl(image)}
                  title={imageOrigin(detail, image)}
                  detail={`Added ${formatDay(image.addedAt)}`}
                  status={image.isReviewed ? "Extra" : "Waiting for review"}
                  tone={image.isReviewed ? "secondary" : "warning"}
                  selected={selectedKey === `stored:${image.id}`}
                  landscape={landscape}
                  onSelect={() => setSelectedKey(`stored:${image.id}`)}
                />
              ))}
            </CandidateGroup>
          )}
          {listed.length > 0 && (
            <CandidateGroup title="Listed by sources">
              {listed.map((image) => (
                <CandidateRow
                  key={image.candidate.id}
                  url={image.url}
                  title={`From ${image.provider}`}
                  detail={hostOf(image.url)}
                  status="Not stored"
                  tone="neutral"
                  dashed
                  selected={selectedKey === `source:${image.candidate.id}`}
                  landscape={landscape}
                  onSelect={() => setSelectedKey(`source:${image.candidate.id}`)}
                />
              ))}
            </CandidateGroup>
          )}
          {contributed.map((image) => (
            <ContributionBlock
              key={image.candidate.id}
              {...passContributor(detail, submissions, image.candidate.candidateCardId)}
              value={
                <PrintingImageBox
                  url={image.url}
                  alt="Contributed image"
                  href={image.url}
                  className="w-28"
                  landscape={landscape}
                />
              }
              pending={writes.pending}
              onUse={() =>
                void queueWrite((signal) =>
                  writes.applyChip(signal, { kind: "image", key: image.candidate.id, image }),
                )
              }
              onReject={() => decisions.onReject(image.candidate.candidateCardId, "Image")}
              onMove={
                decisions.onMove && (() => decisions.onMove?.(image.candidate.candidateCardId))
              }
              onMarkApplied={() => decisions.onMarkApplied(image.candidate.candidateCardId)}
            />
          ))}
          {decisions.dialogs}

          {isAdmin && adding && (
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
              <div className="flex gap-1">
                <Input
                  aria-label="Image address"
                  placeholder="Or paste an image address, https://…"
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
                <Button variant="ghost" onClick={() => setAdding(false)}>
                  Done
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </RecordSection>
  );
}

function StoredCandidate({
  image,
  caption,
  currentUrl,
  mode,
  face,
  scope,
  isAdmin,
  landscape,
}: {
  image: AdminPrintingImageResponse;
  caption: string;
  currentUrl: string | null;
  mode: CompareMode;
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

  const url = printingImageDisplayUrl(image);
  const decide = (
    <>
      <Button
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
      {isAdmin && (
        <Button
          variant="outline-destructive"
          size="sm"
          disabled={pending}
          pending={remove.isPending}
          onClick={() => void queueWrite((signal) => remove.mutateAsync(image.id, { signal }))}
        >
          Delete
        </Button>
      )}
    </>
  );

  return (
    <div className="w-full max-w-96 min-w-0 space-y-2 text-sm">
      <CandidateImage url={url} currentUrl={currentUrl} mode={mode} landscape={landscape} />
      <span className="text-muted-foreground block break-words">{caption}</span>
      <span className="flex flex-wrap gap-1">
        <Badge variant={image.isReviewed ? "secondary" : "warning"}>
          {image.isReviewed ? "Extra" : "Waiting for review"}
        </Badge>
        <RehostStatusBadge image={image} />
      </span>
      <div className="flex flex-wrap gap-1.5">{decide}</div>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
          <EllipsisVerticalIcon />
          Image tools
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
            <ImageEditMenuItems
              image={image}
              disabled={editing}
              onStraighten={() => setStraightening(true)}
              onRotate={(degrees) =>
                void queueWrite((signal) =>
                  rotate.mutateAsync(
                    { imageId: image.id, rotation: ((image.rotation + degrees) % 360) as Rotation },
                    { signal },
                  ),
                )
              }
              onToggleTrim={() =>
                void queueWrite((signal) =>
                  setNeedsTrim.mutateAsync(
                    { imageId: image.id, needsTrim: !image.needsTrim },
                    { signal },
                  ),
                )
              }
              onToggleLevels={() =>
                void queueWrite((signal) =>
                  setNeedsLevels.mutateAsync(
                    { imageId: image.id, needsLevels: !image.needsLevels },
                    { signal },
                  ),
                )
              }
            />
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

type CompareMode = "side" | "flip";

function hostOf(url: string): string {
  return URL.canParse(url) ? new URL(url).hostname : url;
}

function CandidateImage({
  url,
  currentUrl,
  mode,
  landscape,
}: {
  url: string | null;
  currentUrl: string | null;
  mode: CompareMode;
  landscape: boolean;
}) {
  const [showsCurrent, setShowsCurrent] = useState(false);
  if (mode === "side") {
    return (
      <PrintingImageBox url={url} alt="Candidate image" className="w-full" landscape={landscape} />
    );
  }
  return (
    <Pressable
      aria-label="Flip between the candidate and the current image"
      className="relative block w-full"
      onClick={() => setShowsCurrent(!showsCurrent)}
    >
      <PrintingImageBox
        url={showsCurrent ? currentUrl : url}
        alt={showsCurrent ? "Current image" : "Candidate image"}
        className="w-full"
        landscape={landscape}
      />
      <span className="bg-background/85 absolute top-2 left-2 rounded-md px-2 py-0.5 text-sm">
        {showsCurrent ? "Current" : "Candidate"} · click to flip
      </span>
    </Pressable>
  );
}

function CandidateGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <SectionHeading as="h4" size="sm">
        {title}
      </SectionHeading>
      {children}
    </div>
  );
}

function CandidateRow({
  url,
  title,
  detail,
  status,
  tone,
  selected,
  dashed = false,
  landscape,
  onSelect,
}: {
  url: string | null;
  title: string;
  detail: string;
  status: string;
  tone: "warning" | "secondary" | "neutral";
  selected: boolean;
  dashed?: boolean;
  landscape: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border p-2 text-left",
        selected ? "border-primary bg-muted" : "hover:bg-muted/50",
      )}
      onClick={onSelect}
    >
      <PrintingImageBox
        url={url}
        alt=""
        className={cn("w-14 shrink-0", dashed && "border-dashed")}
        landscape={landscape}
      />
      <span className="min-w-0 space-y-1">
        <span className="block font-medium break-words">{title}</span>
        <span className="text-muted-foreground block text-sm break-words">{detail}</span>
        <Badge variant={tone}>{status}</Badge>
      </span>
    </Pressable>
  );
}

function SourceCandidate({
  image,
  currentUrl,
  mode,
  scope,
  record,
  hasActive,
  isAdmin,
  landscape,
  pending,
  onUse,
}: {
  image: SourceImageCandidate;
  currentUrl: string | null;
  mode: CompareMode;
  scope: Scope;
  record: string;
  hasActive: boolean;
  isAdmin: boolean;
  landscape: boolean;
  pending: boolean;
  onUse: () => void;
}) {
  const queueWrite = useQueueWorkspaceWrite();
  const store = useSetCandidatePrintingImage(scope);
  const dismissValue = useDismissSuggestion(scope, record);

  return (
    <div className="w-full max-w-96 min-w-0 space-y-2 text-sm">
      <CandidateImage url={image.url} currentUrl={currentUrl} mode={mode} landscape={landscape} />
      <span className="text-muted-foreground block break-words">
        From {image.provider},{" "}
        <TextLink variant="muted" href={image.url} target="_blank" rel="noreferrer">
          {hostOf(image.url)}
        </TextLink>
      </span>
      <span className="flex flex-wrap gap-1">
        <Badge variant="neutral">Not stored</Badge>
      </span>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" disabled={pending} onClick={onUse}>
          Make main
        </Button>
        {hasActive && (
          <Button
            variant="outline"
            size="sm"
            disabled={pending || store.isPending}
            pending={store.isPending}
            onClick={() =>
              void queueWrite((signal) =>
                store.mutateAsync(
                  { candidatePrintingId: image.candidate.id, mode: "additional" },
                  { signal },
                ),
              )
            }
          >
            Store beside
          </Button>
        )}
        {isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            disabled={dismissValue.pending}
            onClick={() =>
              void dismissValue.run({
                kind: "printing",
                candidateId: image.candidate.id,
                field: "imageUrl",
                value: image.candidate.imageUrl,
                label: "the image",
                source: image.provider,
              })
            }
          >
            Dismiss
          </Button>
        )}
      </div>
    </div>
  );
}
