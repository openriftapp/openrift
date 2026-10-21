import { formatPrintingCode } from "@openrift/shared/printing-code";
import type {
  AdminCardDetailResponse,
  AdminPrintingResponse,
} from "@openrift/shared/types/api/admin";
import { isListingOwnerId } from "@openrift/shared/workspace-listing-key";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronDownIcon } from "lucide-react";
import { Suspense, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import {
  useAcceptPrintingGroup,
  useLinkCandidatePrintings,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { useAdminCardDetail } from "@/features/admin/hooks/use-admin-card-queries";
import {
  useAddImageFromUrl,
  useUploadPrintingImage,
} from "@/features/admin/hooks/use-admin-image-mutations";
import { useIgnoreCandidatePrinting } from "@/features/admin/hooks/use-ignored-candidates";
import { useUpdateDeskPrinting } from "@/features/admin/hooks/use-printing-desk";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { unlinkedGroupCandidates } from "@/features/admin/lib/candidate-groups";
import { CreationPanel } from "@/features/catalog-workspace/components/creation/creation-panel";
import { ListingRecord } from "@/features/catalog-workspace/components/listing-record";
import { Kbd } from "@/features/catalog-workspace/components/record/kbd";
import {
  RecordHeader,
  RecordPane,
  RecordSection,
} from "@/features/catalog-workspace/components/record/record-pane";
import { useValueLabels } from "@/features/catalog-workspace/hooks/use-face-record-actions";
import { useQueueNavigation } from "@/features/catalog-workspace/hooks/use-queue-navigation";
import { useRegisterRecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
import type {
  CreationDraft,
  PlannedImageUpload,
} from "@/features/catalog-workspace/lib/creation-draft";
import {
  draftFromCandidatePrinting,
  duplicateProbeFromAdminPrinting,
  findDuplicateCandidates,
  plannedImageUploads,
  printingFollowUpFields,
  toAcceptInput,
  validateDraft,
} from "@/features/catalog-workspace/lib/creation-draft";
import {
  formatSuggestionValue,
  providerOf,
} from "@/features/catalog-workspace/lib/face-suggestion-rows";
import { workspaceQueueQueryOptions } from "@/features/catalog-workspace/lib/workspace-queries";
import { errorText } from "@/lib/error-text";

export function NewPrintingRecord({ candidatePrintingId }: { candidatePrintingId: string }) {
  return isListingOwnerId(candidatePrintingId) ? (
    <ListingRecord ownerId={candidatePrintingId} />
  ) : (
    <NewCandidatePrintingRecord candidatePrintingId={candidatePrintingId} />
  );
}

function NewCandidatePrintingRecord({ candidatePrintingId }: { candidatePrintingId: string }) {
  const { data: queue, isPending } = useQuery(workspaceQueueQueryOptions());
  const item = queue?.items.find(
    (entry) => entry.owner === "printing" && entry.ownerId === candidatePrintingId,
  );

  if (isPending) {
    return <Skeleton className="m-4 h-96" />;
  }
  if (item?.cardSlug === null || item?.cardSlug === undefined) {
    return (
      <p className="text-muted-foreground p-4">
        This candidate is not in the queue any more. It was accepted, merged or ignored.
      </p>
    );
  }
  return (
    <Suspense fallback={<Skeleton className="m-4 h-96" />}>
      <NewPrintingBody
        key={candidatePrintingId}
        cardSlug={item.cardSlug}
        candidatePrintingId={candidatePrintingId}
      />
    </Suspense>
  );
}

function uniquePrintings(printings: readonly AdminPrintingResponse[]): AdminPrintingResponse[] {
  return [...new Map(printings.map((printing) => [printing.id, printing])).values()].toSorted(
    (a, b) => a.canonicalRank - b.canonicalRank,
  );
}

function NewPrintingBody({
  cardSlug,
  candidatePrintingId,
}: {
  cardSlug: string;
  candidatePrintingId: string;
}) {
  const detailQuery = useAdminCardDetail(cardSlug);
  const detail = detailQuery.data as AdminCardDetailResponse | undefined;
  const { data: access } = useAdminAccess();
  const isAdmin = access?.isAdmin === true;
  const labels = useValueLabels();
  const navigation = useQueueNavigation("printing");
  const queryClient = useQueryClient();
  const scope = [adminKeys.cards.detail(cardSlug), adminKeys.cards.list, adminKeys.workspace];
  const acceptGroup = useAcceptPrintingGroup(scope);
  const linkCandidates = useLinkCandidatePrintings(scope);
  const ignoreCandidate = useIgnoreCandidatePrinting(scope);
  const updateDesk = useUpdateDeskPrinting();
  const uploadImage = useUploadPrintingImage(scope);
  const addImageFromUrl = useAddImageFromUrl(scope);
  const [draftEdit, setDraftEdit] = useState<CreationDraft | null>(null);
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const accepting = useRef(false);

  const candidate = detail?.candidatePrintings.find((entry) => entry.id === candidatePrintingId);
  const card = detail?.card ?? null;
  const provider =
    detail === undefined || candidate === undefined
      ? "Source"
      : providerOf(detail, candidate.candidateCardId);
  const seeded =
    detail === undefined || candidate === undefined || card === null
      ? null
      : {
          ...draftFromCandidatePrinting(
            {
              mode: "existing",
              id: card.id,
              slug: card.slug,
              name: detail.displayName,
              note: "matched by name",
            },
            candidate,
            provider,
          ),
          candidatePrintingIds: unlinkedGroupCandidates(detail, candidatePrintingId).map(
            (entry) => entry.id,
          ),
        };
  const draft = draftEdit ?? seeded;
  const existing = uniquePrintings(detail?.printings ?? []);
  const duplicates =
    draft === null
      ? []
      : findDuplicateCandidates(
          draft,
          existing.map((printing) => duplicateProbeFromAdminPrinting(printing)),
        );
  const issues = draft === null ? [] : validateDraft(draft);
  const canAccept = draft !== null && issues.length === 0 && !working && !acceptGroup.isPending;

  const uploadOne = (printingId: string, upload: PlannedImageUpload) =>
    upload.image.kind === "file"
      ? uploadImage.mutateAsync({
          printingId,
          file: upload.image.file,
          mode: upload.mode,
          face: upload.face,
        })
      : addImageFromUrl.mutateAsync({
          printingId,
          url: upload.image.url,
          mode: upload.mode,
          face: upload.face,
        });

  const acceptDraft = async (toCreate: CreationDraft) => {
    setWorking(true);
    setFailure(null);
    const created = await acceptGroup
      .mutateAsync(toAcceptInput(toCreate))
      .catch((error: unknown) => {
        setFailure(errorText(error, "Could not accept the printing."));
        return null;
      });
    if (created === null) {
      setWorking(false);
      return;
    }
    const followUp = isAdmin ? printingFollowUpFields(toCreate) : null;
    const failed: string[] = [];
    if (followUp !== null) {
      await updateDesk
        .mutateAsync({ printingId: created.printingId, ...followUp })
        .catch(() => failed.push("the dates and note"));
    }
    if (isAdmin) {
      for (const upload of plannedImageUploads(toCreate)) {
        await uploadOne(created.printingId, upload).catch(() => failed.push("an image"));
      }
    }
    await queryClient.invalidateQueries({ queryKey: adminKeys.workspace });
    setWorking(false);
    if (failed.length > 0) {
      setFailure(`The printing was created, but ${failed.join(" and ")} did not save.`);
      return;
    }
    navigation.goNext();
  };

  const accept = async () => {
    if (draft === null || !canAccept || accepting.current) {
      return;
    }
    accepting.current = true;
    const release = () => {
      accepting.current = false;
    };
    await acceptDraft(draft).then(release, (error: unknown) => {
      release();
      throw error;
    });
  };

  const ignore = () => {
    if (candidate === undefined) {
      return;
    }
    ignoreCandidate.mutate(
      { provider, externalId: candidate.externalId, finish: candidate.finish },
      { onSuccess: navigation.goNext },
    );
  };

  const merge = (printingId: string) => {
    if (draft === null) {
      return;
    }
    linkCandidates.mutate(
      { candidatePrintingIds: draft.candidatePrintingIds, printingId },
      { onSuccess: navigation.goNext },
    );
  };

  useRegisterRecordActions({
    accept: canAccept ? accept : undefined,
    ignore: isAdmin && candidate !== undefined ? ignore : undefined,
  });

  if (detail === undefined) {
    return detailQuery.isError ? (
      <p className="text-muted-foreground p-4">The card could not be loaded.</p>
    ) : (
      <Skeleton className="m-4 h-96" />
    );
  }
  if (candidate === undefined || draft === null) {
    return (
      <p className="text-muted-foreground p-4">
        This candidate is no longer open on {detail.displayName}.
      </p>
    );
  }

  return (
    <RecordPane
      header={
        <RecordHeader
          title={detail.displayName}
          subtitle={[
            formatPrintingCode(candidate.publicCode ?? candidate.shortCode),
            candidate.language,
          ]
            .filter(Boolean)
            .join(" · ")}
          badges={<Badge variant="info">New from {provider}</Badge>}
          actions={
            <>
              <Button variant="ghost" size="sm" onClick={() => navigation.skipToEnd()}>
                Skip to end <Kbd>S</Kbd>
              </Button>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={ignoreCandidate.isPending}
                  onClick={ignore}
                >
                  Ignore <Kbd>X</Kbd>
                </Button>
              )}
              {isAdmin && existing.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="outline" size="sm" disabled={linkCandidates.isPending} />
                    }
                  >
                    Merge into existing…
                    <ChevronDownIcon />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {existing.map((printing) => (
                      <DropdownMenuItem key={printing.id} onClick={() => merge(printing.id)}>
                        {printing.expectedPrintingId}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button size="sm" disabled={!canAccept} onClick={() => void accept()}>
                Accept & next <Kbd>A</Kbd>
              </Button>
            </>
          }
        />
      }
    >
      {failure !== null && (
        <Alert variant="destructive">
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}
      <CreationPanel
        draft={draft}
        onChange={setDraftEdit}
        duplicateCandidates={duplicates}
        onMergeDuplicate={isAdmin ? (duplicate) => merge(duplicate.printingId) : undefined}
        disabled={working}
      />
      {issues.length > 0 && (
        <p className="text-muted-foreground text-sm">
          Still needed: {issues.map((issue) => issue.message).join(" ")}
        </p>
      )}
      {!isAdmin && (
        <p className="text-muted-foreground text-sm">
          Release dates, the note and extra images are added by an admin after the accept.
        </p>
      )}

      <RecordSection title={`${detail.displayName} already has`}>
        {existing.length === 0 ? (
          <p className="text-muted-foreground text-sm">No printings yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {existing.map((printing) => (
              <li key={printing.id} className="flex flex-wrap items-baseline gap-x-2">
                <Link
                  to="/admin/workspace/printings/$printingId"
                  params={{ printingId: printing.id }}
                  className="font-mono underline"
                >
                  {printing.expectedPrintingId}
                </Link>
                <span className="text-muted-foreground">
                  {[
                    printing.language,
                    formatSuggestionValue("finish", printing.finish, labels),
                    formatSuggestionValue("size", printing.size, labels),
                    printing.markerSlugs.length > 0
                      ? formatSuggestionValue("markerSlugs", printing.markerSlugs, labels)
                      : null,
                    printing.distributionChannelSlugs.length > 0
                      ? formatSuggestionValue(
                          "distributionChannelSlugs",
                          printing.distributionChannelSlugs,
                          labels,
                        )
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </RecordSection>
    </RecordPane>
  );
}
