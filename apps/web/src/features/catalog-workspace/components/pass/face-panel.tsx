import { formatDay } from "@openrift/shared/format-date";
import { formatPrintingCode } from "@openrift/shared/printing-code";
import type {
  AdminCardDetailResponse,
  AdminPrintingImageResponse,
  ProviderSettingResponse,
} from "@openrift/shared/types/api/admin";
import { Link } from "@tanstack/react-router";
import { ContrastIcon, CropIcon, RotateCwIcon, ScissorsIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { TextLink } from "@/components/ui/text-link";
import { FormattedText } from "@/features/admin/components/attention-change-list";
import { PrintingImageBox } from "@/features/admin/components/printing-image-box";
import { StraightenImageDialog } from "@/features/admin/components/straighten-image-dialog";
import {
  useActivatePrintingImage,
  useDeletePrintingImage,
  useImageEditPending,
  useKeepPrintingImage,
  useRehostPrintingImage,
  useRotatePrintingImage,
  useSetPrintingImageNeedsLevels,
  useSetPrintingImageNeedsTrim,
} from "@/features/admin/hooks/use-admin-image-mutations";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import type { AttentionSubmission } from "@/features/admin/lib/attention-items";
import { PRINTING_FIELD_LABELS } from "@/features/admin/lib/catalog-field-labels";
import type { PrintingValueLabels } from "@/features/admin/lib/field-value-text";
import { formatCatalogFieldValue } from "@/features/admin/lib/field-value-text";
import { printingImageDisplayUrl } from "@/features/admin/lib/printing-image-display-url";
import { imageQuadOf } from "@/features/admin/lib/straighten-quad";
import { ErrataPane } from "@/features/cards/components/errata-diff-pane";
import { diffCardText } from "@/features/cards/lib/errata-diff";
import { FaceCompareGrid } from "@/features/catalog-workspace/components/compare-sources-dialog";
import type { ComparedImage } from "@/features/catalog-workspace/components/pass/image-compare-dialog";
import { ImageCompareDialog } from "@/features/catalog-workspace/components/pass/image-compare-dialog";
import {
  ContributionBlock,
  SourceUse,
} from "@/features/catalog-workspace/components/pass/pass-parts";
import { RecordFieldRow } from "@/features/catalog-workspace/components/record/field-row";
import type { FaceChip } from "@/features/catalog-workspace/hooks/use-face-record-actions";
import { useFaceSuggestionWrites } from "@/features/catalog-workspace/hooks/use-face-record-actions";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import type { PassDismiss, PassFace } from "@/features/catalog-workspace/lib/card-pass";
import { imageOrigin, passContributor } from "@/features/catalog-workspace/lib/card-pass";
import {
  FACE_FIELDS,
  faceCompareCandidates,
} from "@/features/catalog-workspace/lib/face-suggestion-rows";
import type { WorkspaceWriteTask } from "@/features/catalog-workspace/lib/workspace-write-queue";

export function faceHeading(face: PassFace["face"], labels: PrintingValueLabels): string {
  return [
    formatPrintingCode(face.publicCode),
    face.language,
    formatCatalogFieldValue("finish", face.finish, labels),
  ].join(" · ");
}

const CARD_TEXT_FIELDS: ReadonlySet<string> = new Set([
  "printedRulesText",
  "printedEffectText",
  "flavorText",
]);

function isCardTextField(field: string): boolean {
  return CARD_TEXT_FIELDS.has(field);
}

function textChange(field: string, current: unknown, proposed: unknown): ReactNode {
  if (!isCardTextField(field) || typeof proposed !== "string") {
    return null;
  }
  const segments = diffCardText(typeof current === "string" ? current : "", proposed);
  return (
    <ErrataPane
      title="Suggested text"
      tone="updated"
      side="corrected"
      className="basis-full"
      changes={[{ key: field, label: null, segments }]}
    />
  );
}

export function FacePanel({
  cardSlug,
  detail,
  entry,
  submissions,
  providerSettings,
  hiddenProviders,
  costKeywords,
  isAdmin,
  landscape,
  labels,
  onReject,
  onMove,
  onMarkApplied,
  onDismissSource,
  comparingImageId,
  onCompareImage,
  onImageResolved,
}: {
  cardSlug: string;
  detail: AdminCardDetailResponse;
  entry: PassFace;
  submissions: readonly AttentionSubmission[];
  providerSettings: ProviderSettingResponse[];
  hiddenProviders: ReadonlySet<string>;
  costKeywords: readonly string[];
  isAdmin: boolean;
  landscape: boolean;
  labels: PrintingValueLabels;
  onReject: (candidateCardId: string, kindLabel: string) => void;
  onMove?: (candidateCardId: string) => void;
  onMarkApplied: (candidateCardId: string) => void;
  onDismissSource?: (target: PassDismiss) => void;
  comparingImageId: string | null;
  onCompareImage: (imageId: string | null) => void;
  onImageResolved: (imageId: string) => void;
}) {
  const { face, model, uploads, failedRehosts } = entry;
  const writes = useFaceSuggestionWrites({ cardSlug, record: detail.displayName, face });
  const queueWrite = useQueueWorkspaceWrite();
  const [comparing, setComparing] = useState(false);
  const hasSources = faceCompareCandidates(detail, face.faceId, hiddenProviders).length > 0;

  const fields = FACE_FIELDS.filter((field) =>
    model.suggestions.some((suggestion) => suggestion.field === field),
  );
  const main = model.images.find((image) => image.isActive);
  const hasImageWork =
    model.sourceImages.length > 0 || uploads.length > 0 || failedRehosts.length > 0;
  const pending = writes.pending;
  const currentUrl = main === undefined ? null : printingImageDisplayUrl(main);
  const heading = faceHeading(face, labels);
  const current: ComparedImage = {
    url: currentUrl,
    caption: main === undefined ? "Current" : `Current · ${imageOrigin(detail, main)}`,
    href: main?.originalUrl ?? null,
  };
  const sourceImages = model.sourceImages.filter((image) => !image.isContributor);
  const contributorImages = model.sourceImages.filter((image) => image.isContributor);
  const apply = (chip: FaceChip) => void queueWrite((signal) => writes.applyChip(signal, chip));

  return (
    <div className="flex flex-col gap-1 rounded-lg border px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex-1">
          <TextLink
            variant="inherit"
            className="font-medium"
            render={
              <Link
                to="/admin/workspace/faces/$cardSlug/$faceId"
                params={{ cardSlug, faceId: face.faceId }}
              />
            }
          >
            {faceHeading(face, labels)}
          </TextLink>
        </span>
        {hasSources && (
          <Button variant="link" size="xs" onClick={() => setComparing((value) => !value)}>
            {comparing ? "Close compare" : "Compare fields"}
          </Button>
        )}
      </div>

      {comparing ? (
        <FaceCompareGrid
          cardSlug={cardSlug}
          faceId={face.faceId}
          detail={detail}
          providerSettings={providerSettings}
          hiddenProviders={hiddenProviders}
          costKeywords={costKeywords}
          isAdmin={isAdmin}
        />
      ) : (
        <div>
          {fields.map((field) => (
            <RecordFieldRow
              key={field}
              label={PRINTING_FIELD_LABELS[field]}
              value={
                isCardTextField(field) ? (
                  <FormattedText field={field} value={face[field]} />
                ) : (
                  formatCatalogFieldValue(field, face[field], labels)
                )
              }
              suggestions={model.suggestions
                .filter((suggestion) => suggestion.field === field)
                .map((suggestion) => {
                  const value = formatCatalogFieldValue(field, suggestion.proposed, labels);
                  const diff = textChange(field, face[field], suggestion.proposed);
                  const chip = { kind: "field" as const, key: suggestion.key, suggestion };
                  if (!suggestion.isContributor) {
                    return (
                      <SourceUse
                        key={suggestion.key}
                        value={diff === null ? value : undefined}
                        preview={diff}
                        source={suggestion.provider}
                        pending={pending}
                        onUse={() => apply(chip)}
                        onDismiss={
                          onDismissSource &&
                          (() =>
                            onDismissSource({
                              candidateCardIds: [],
                              candidatePrintingIds: [suggestion.candidate.id],
                              suggestions: 1,
                            }))
                        }
                      />
                    );
                  }
                  const contributor = passContributor(
                    detail,
                    submissions,
                    suggestion.candidate.candidateCardId,
                  );
                  return (
                    <ContributionBlock
                      key={suggestion.key}
                      {...contributor}
                      value={diff ?? value}
                      pending={pending}
                      onUse={() => apply(chip)}
                      onReject={() => onReject(suggestion.candidate.candidateCardId, "Correction")}
                      onMove={onMove && (() => onMove(suggestion.candidate.candidateCardId))}
                      onMarkApplied={() => onMarkApplied(suggestion.candidate.candidateCardId)}
                    />
                  );
                })}
            />
          ))}
          {hasImageWork && (
            <RecordFieldRow
              label="Images"
              value={
                <div className="flex flex-wrap items-start gap-4 max-sm:grid max-sm:grid-cols-2 max-sm:gap-3">
                  <ImageTile
                    caption="Current"
                    image={
                      <PrintingImageBox
                        url={currentUrl}
                        alt="Current image"
                        className="w-full"
                        landscape={landscape}
                      />
                    }
                  />
                  {sourceImages.map((image) => (
                    <SourceImageTile
                      key={image.candidate.id}
                      title={heading}
                      current={current}
                      url={image.url}
                      provider={image.provider}
                      pending={pending}
                      landscape={landscape}
                      onUse={() => apply({ kind: "image", key: image.candidate.id, image })}
                    />
                  ))}
                  {uploads.map((image) => (
                    <WaitingUpload
                      key={image.id}
                      title={heading}
                      current={current}
                      origin={imageOrigin(detail, image)}
                      cardSlug={cardSlug}
                      image={image}
                      isAdmin={isAdmin}
                      landscape={landscape}
                      comparing={comparingImageId === image.id}
                      onCompare={(open) => onCompareImage(open ? image.id : null)}
                      onResolved={() => onImageResolved(image.id)}
                    />
                  ))}
                  {failedRehosts.map((image) => (
                    <FailedRehost
                      key={image.id}
                      cardSlug={cardSlug}
                      image={image}
                      landscape={landscape}
                    />
                  ))}
                </div>
              }
              suggestions={
                contributorImages.length === 0
                  ? undefined
                  : contributorImages.map((image) => (
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
                        pending={pending}
                        onUse={() => apply({ kind: "image", key: image.candidate.id, image })}
                        onReject={() => onReject(image.candidate.candidateCardId, "Image")}
                        onMove={onMove && (() => onMove(image.candidate.candidateCardId))}
                        onMarkApplied={() => onMarkApplied(image.candidate.candidateCardId)}
                      />
                    ))
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

function ImageTile({
  caption,
  image,
  children,
}: {
  caption: string;
  image: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2 max-sm:flex-col">
      <div className="flex w-24 flex-col gap-1 max-sm:w-full">
        {image}
        <span className="text-muted-foreground text-sm break-words">{caption}</span>
      </div>
      {children !== undefined && (
        <div className="flex gap-1.5 max-sm:w-full max-sm:flex-wrap max-sm:*:flex-1 max-sm:*:px-2 sm:flex-col">
          {children}
        </div>
      )}
    </div>
  );
}

function FailedRehost({
  cardSlug,
  image,
  landscape,
}: {
  cardSlug: string;
  image: AdminPrintingImageResponse;
  landscape: boolean;
}) {
  const queueWrite = useQueueWorkspaceWrite();
  const activate = useActivatePrintingImage(passImageScope(cardSlug));
  const rehost = useRehostPrintingImage();
  const busy = activate.isPending || rehost.isPending;

  return (
    <ImageTile
      caption={`Failed to rehost: ${image.rehostFailure?.error ?? ""}`}
      image={
        <PrintingImageBox
          url={printingImageDisplayUrl(image)}
          alt="Image that failed to rehost"
          href={image.originalUrl ?? undefined}
          className="w-full"
          landscape={landscape}
        />
      }
    >
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        pending={rehost.isPending}
        onClick={() => void queueWrite((signal) => rehost.mutateAsync(image.id, { signal }))}
      >
        Retry
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        pending={activate.isPending}
        onClick={() =>
          void queueWrite((signal) =>
            activate.mutateAsync({ imageId: image.id, active: false }, { signal }),
          )
        }
      >
        Cancel going live
      </Button>
    </ImageTile>
  );
}

function passImageScope(cardSlug: string) {
  return [
    adminKeys.cards.detail(cardSlug),
    adminKeys.cards.list,
    adminKeys.printingDesk.all,
    adminKeys.workspace,
  ];
}

function SourceImageTile({
  title,
  current,
  url,
  provider,
  pending,
  landscape,
  onUse,
}: {
  title: string;
  current: ComparedImage;
  url: string;
  provider: string;
  pending: boolean;
  landscape: boolean;
  onUse: () => void;
}) {
  const [comparing, setComparing] = useState(false);
  const caption = `From ${provider}`;
  const use = (
    <Button variant="outline" size="sm" disabled={pending} onClick={onUse}>
      Make main
    </Button>
  );
  return (
    <>
      <ImageTile
        caption={caption}
        image={
          <Pressable
            aria-label={`Compare the ${provider} image`}
            onClick={() => setComparing(true)}
          >
            <PrintingImageBox
              url={url}
              alt={`${provider} image`}
              className="w-full"
              landscape={landscape}
            />
          </Pressable>
        }
      >
        <Button variant="outline" size="sm" onClick={() => setComparing(true)}>
          Compare<span className="max-sm:hidden"> images</span>
        </Button>
        {use}
      </ImageTile>
      {comparing && (
        <ImageCompareDialog
          title={title}
          current={current}
          candidate={{ url, caption, href: url }}
          landscape={landscape}
          actions={use}
          onOpenChange={setComparing}
        />
      )}
    </>
  );
}

function UploadTools({ image }: { image: AdminPrintingImageResponse }) {
  const queueWrite = useQueueWorkspaceWrite();
  const rotate = useRotatePrintingImage();
  const setNeedsTrim = useSetPrintingImageNeedsTrim();
  const setNeedsLevels = useSetPrintingImageNeedsLevels();
  const editing = useImageEditPending(image.id);
  const [straightening, setStraightening] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" disabled={editing} onClick={() => setStraightening(true)}>
        <CropIcon />
        Straighten…
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={editing}
        pending={rotate.isPending}
        onClick={() =>
          void queueWrite((signal) =>
            rotate.mutateAsync(
              { imageId: image.id, rotation: ((image.rotation + 90) % 360) as 0 | 90 | 180 | 270 },
              { signal },
            ),
          )
        }
      >
        <RotateCwIcon />
        Rotate
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={editing}
        pending={setNeedsTrim.isPending}
        aria-pressed={image.needsTrim}
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
        Auto-trim
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={editing}
        pending={setNeedsLevels.isPending}
        aria-pressed={image.needsLevels}
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
        Contrast
      </Button>
      <StraightenImageDialog
        imageId={image.id}
        quad={imageQuadOf(image)}
        open={straightening}
        onOpenChange={setStraightening}
        runWrite={queueWrite}
      />
    </>
  );
}

function UploadActions({
  cardSlug,
  image,
  isAdmin,
  deleteOnly = false,
  onResolved,
}: {
  cardSlug: string;
  image: AdminPrintingImageResponse;
  isAdmin: boolean;
  deleteOnly?: boolean;
  onResolved?: () => void;
}) {
  const queueWrite = useQueueWorkspaceWrite();
  const resolve = async (task: WorkspaceWriteTask) => {
    if (await queueWrite(task)) {
      onResolved?.();
    }
  };
  const scope = passImageScope(cardSlug);
  const activate = useActivatePrintingImage(scope);
  const keep = useKeepPrintingImage(scope);
  const remove = useDeletePrintingImage(scope);
  const pending = activate.isPending || keep.isPending || remove.isPending;

  return (
    <>
      {!deleteOnly && (
        <>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            pending={activate.isPending}
            onClick={() =>
              void resolve((signal) =>
                activate.mutateAsync({ imageId: image.id, active: true }, { signal }),
              )
            }
          >
            Make main
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            pending={keep.isPending}
            onClick={() => void resolve((signal) => keep.mutateAsync(image.id, { signal }))}
          >
            Keep as extra
          </Button>
        </>
      )}
      {isAdmin && (
        <Button
          variant="outline-destructive"
          size="sm"
          disabled={pending}
          pending={remove.isPending}
          onClick={() => void resolve((signal) => remove.mutateAsync(image.id, { signal }))}
        >
          Delete
        </Button>
      )}
    </>
  );
}

function WaitingUpload({
  title,
  current,
  origin,
  cardSlug,
  image,
  isAdmin,
  landscape,
  comparing,
  onCompare,
  onResolved,
}: {
  title: string;
  current: ComparedImage;
  origin: string;
  cardSlug: string;
  image: AdminPrintingImageResponse;
  isAdmin: boolean;
  landscape: boolean;
  comparing: boolean;
  onCompare: (open: boolean) => void;
  onResolved: () => void;
}) {
  const caption = `${origin}, added ${formatDay(image.addedAt)}`;
  const url = printingImageDisplayUrl(image);
  return (
    <>
      <ImageTile
        caption={caption}
        image={
          <Pressable aria-label="Compare the new image" onClick={() => onCompare(true)}>
            <PrintingImageBox url={url} alt="New image" className="w-full" landscape={landscape} />
          </Pressable>
        }
      >
        <Button variant="outline" size="sm" onClick={() => onCompare(true)}>
          Compare<span className="max-sm:hidden"> images</span>
        </Button>
        <UploadActions cardSlug={cardSlug} image={image} isAdmin={isAdmin} deleteOnly />
      </ImageTile>
      {comparing && (
        <ImageCompareDialog
          title={title}
          current={current}
          candidate={{ url, caption, href: image.originalUrl }}
          landscape={landscape}
          tools={image.rehostedUrl === null ? undefined : <UploadTools image={image} />}
          actions={
            <UploadActions
              cardSlug={cardSlug}
              image={image}
              isAdmin={isAdmin}
              onResolved={onResolved}
            />
          }
          onOpenChange={onCompare}
        />
      )}
    </>
  );
}
