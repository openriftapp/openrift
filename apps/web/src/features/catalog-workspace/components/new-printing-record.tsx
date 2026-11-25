import { formatPrintingCode } from "@openrift/shared/printing-code";
import { isListingOwnerId, parseListingCardOwnerId } from "@openrift/shared/workspace-listing-key";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { ChevronDownIcon } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";

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
import { TextLink } from "@/components/ui/text-link";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import { useAdminCardDetail } from "@/features/admin/hooks/use-admin-card-queries";
import { useProviderSettings } from "@/features/admin/hooks/use-provider-settings";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { unlinkedGroupCandidates } from "@/features/admin/lib/candidate-groups";
import { favoriteProviderSet } from "@/features/admin/lib/candidate-rows";
import { buildSetReleaseYears } from "@/features/admin/lib/set-release-years";
import { providerOf } from "@/features/admin/lib/source-compare";
import { useSets } from "@/features/cards/hooks/use-sets";
import { CreationPanel } from "@/features/catalog-workspace/components/creation/creation-panel";
import { ExistingPrintingsSection } from "@/features/catalog-workspace/components/record/existing-printings-section";
import { Kbd } from "@/features/catalog-workspace/components/record/kbd";
import { RecordError } from "@/features/catalog-workspace/components/record/record-error";
import {
  RecordHeader,
  RecordNotice,
  RecordPane,
} from "@/features/catalog-workspace/components/record/record-pane";
import { useIgnorePrintingGroup } from "@/features/catalog-workspace/hooks/use-ignore-printing-group";
import { useLinkToExisting } from "@/features/catalog-workspace/hooks/use-link-to-existing";
import { useAcceptPrintingDrafts } from "@/features/catalog-workspace/hooks/use-printing-creation";
import { useRegisterRecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import { uniquePrintingsByRank } from "@/features/catalog-workspace/lib/card-pass";
import type { CreationDraft } from "@/features/catalog-workspace/lib/creation-draft";
import {
  draftFromCandidatePrinting,
  duplicateProbeFromAdminPrinting,
  findDuplicateCandidates,
  validateDraft,
} from "@/features/catalog-workspace/lib/creation-draft";
import { cardRecordScope } from "@/features/catalog-workspace/lib/record-scopes";
import { candidatePrintingCardQueryOptions } from "@/features/catalog-workspace/lib/workspace-queries";
import { useWorkspaceActionsStore } from "@/features/catalog-workspace/stores/workspace-actions-store";
import { focusRecordPane } from "@/features/catalog-workspace/stores/workspace-record-pane-store";

export function NewPrintingRecord({ candidatePrintingId }: { candidatePrintingId: string }) {
  if (
    isListingOwnerId(candidatePrintingId) ||
    parseListingCardOwnerId(candidatePrintingId) !== null
  ) {
    return (
      <RecordNotice>
        Marketplace listings are mapped on the card page. They are listed under{" "}
        <TextLink render={<Link to="/admin/workspace/cards" search={{ queue: "listings" }} />}>
          Listings to map
        </TextLink>
        .
      </RecordNotice>
    );
  }
  return <NewCandidatePrintingRecord candidatePrintingId={candidatePrintingId} />;
}

function NewCandidatePrintingRecord({ candidatePrintingId }: { candidatePrintingId: string }) {
  const { data: open, isPending } = useQuery(
    candidatePrintingCardQueryOptions(candidatePrintingId),
  );
  const [acceptedOn, setAcceptedOn] = useState<string | null>(null);
  // An accept drops the candidate from the queue before its follow-up writes finish.
  const cardSlug = acceptedOn ?? open?.cardSlug ?? null;

  if (isPending) {
    return <Skeleton className="m-4 h-96" />;
  }
  if (cardSlug === null) {
    return (
      <RecordNotice>
        This candidate is no longer open. It was accepted, merged or ignored.
      </RecordNotice>
    );
  }
  return (
    <Suspense fallback={<Skeleton className="m-4 h-96" />}>
      <NewPrintingBody
        key={candidatePrintingId}
        cardSlug={cardSlug}
        candidatePrintingId={candidatePrintingId}
        onAcceptingChange={(accepting) => setAcceptedOn(accepting ? cardSlug : null)}
      />
    </Suspense>
  );
}

function NewPrintingBody({
  cardSlug,
  candidatePrintingId,
  onAcceptingChange,
}: {
  cardSlug: string;
  candidatePrintingId: string;
  onAcceptingChange: (accepting: boolean) => void;
}) {
  const queueWrite = useQueueWorkspaceWrite();
  const detailQuery = useAdminCardDetail(cardSlug);
  const detail = detailQuery.data;
  const { data: access } = useAdminAccess();
  const isAdmin = access?.isAdmin === true;
  const { data: setsData } = useSets();
  const { data: providerData } = useProviderSettings();
  const navigate = useNavigate();
  const router = useRouter();
  const resolvedPathname = useRouterState({ select: (state) => state.resolvedLocation?.pathname });
  const queryClient = useQueryClient();
  const scope = cardRecordScope(cardSlug);
  const creator = useAcceptPrintingDrafts(scope);
  const linkCandidates = useLinkToExisting(scope, detail?.displayName ?? cardSlug);
  const ignoreGroup = useIgnorePrintingGroup(scope);
  const [draftEdit, setDraftEdit] = useState<CreationDraft | null>(null);
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const accepting = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function openCardPass() {
    // A write that lands after the admin left this record must not pull them back.
    if (!mounted.current || router.latestLocation.pathname !== resolvedPathname) {
      return;
    }
    useWorkspaceActionsStore.getState().leave(false);
    focusRecordPane();
    const trail = router.latestLocation.state.workspaceReview;
    void navigate({
      to: "/admin/workspace/cards/$cardSlug",
      params: { cardSlug },
      search: { queue: trail?.queue, q: trail?.q },
    });
  }

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
            buildSetReleaseYears(setsData.sets),
            favoriteProviderSet(providerData.providerSettings).has(provider),
          ),
          candidatePrintingIds: unlinkedGroupCandidates(detail, candidatePrintingId).map(
            (entry) => entry.id,
          ),
        };
  const draft = draftEdit ?? seeded;
  const existing = uniquePrintingsByRank(detail?.printings ?? []);
  const duplicates =
    draft === null
      ? []
      : findDuplicateCandidates(
          draft,
          existing.map((printing) => duplicateProbeFromAdminPrinting(printing)),
        );
  const issues = draft === null ? [] : validateDraft(draft);
  const canAccept =
    draft !== null &&
    candidate !== undefined &&
    issues.length === 0 &&
    !working &&
    createdId === null &&
    !creator.pending;

  const acceptDraft = async (signal: AbortSignal, toCreate: CreationDraft) => {
    setWorking(true);
    setFailure(null);
    onAcceptingChange(true);
    const created = await creator.accept(signal, toCreate);
    if (created.printingId === null) {
      setFailure(created.failure);
      setWorking(false);
      onAcceptingChange(false);
      return;
    }
    setCreatedId(created.printingId);
    await queryClient.invalidateQueries({ queryKey: adminKeys.workspace });
    setWorking(false);
    if (created.failure !== null) {
      setFailure(created.failure);
      return;
    }
    openCardPass();
  };

  const accept = async (signal: AbortSignal) => {
    if (draft === null || !canAccept || accepting.current) {
      return;
    }
    accepting.current = true;
    await acceptDraft(signal, draft).finally(() => {
      accepting.current = false;
    });
  };

  const ignore = async (signal: AbortSignal) => {
    if (candidate === undefined) {
      return;
    }
    if (detail === undefined) {
      return;
    }
    const group = unlinkedGroupCandidates(detail, candidate.id);
    if (await ignoreGroup.run(signal, detail, group.length === 0 ? [candidate] : group)) {
      openCardPass();
    }
  };

  const merge = async (signal: AbortSignal, printingId: string) => {
    if (draft === null) {
      return;
    }
    const label =
      existing.find((printing) => printing.id === printingId)?.expectedPrintingId ?? printingId;
    if (await linkCandidates.run(signal, draft.candidatePrintingIds, { id: printingId, label })) {
      openCardPass();
    }
  };

  const ignoring = ignoreGroup.pending;
  useRegisterRecordActions({
    loading: (detail === undefined && !detailQuery.isError) || ignoring,
    accept: canAccept && !ignoring ? accept : undefined,
    acceptLimit: "upload",
    ignore: isAdmin && candidate !== undefined && createdId === null ? ignore : undefined,
  });

  if (detail === undefined) {
    return detailQuery.isError ? (
      <RecordError
        error={detailQuery.error}
        missing={<>No card with ID &ldquo;{cardSlug}&rdquo; exists.</>}
        onRetry={() => void detailQuery.refetch()}
      />
    ) : (
      <Skeleton className="m-4 h-96" />
    );
  }
  if (ignoring) {
    return <Skeleton className="m-4 h-96" />;
  }
  if (createdId !== null || candidate === undefined || draft === null) {
    if (working) {
      return <Skeleton className="m-4 h-96" />;
    }
    if (failure !== null) {
      return (
        <RecordPane header={<RecordHeader title={detail.displayName} />}>
          <Alert variant="destructive">
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        </RecordPane>
      );
    }
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
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  pending={ignoreGroup.pending}
                  onClick={() => void queueWrite(ignore)}
                >
                  Ignore <Kbd>X</Kbd>
                </Button>
              )}
              {isAdmin && existing.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="outline" size="sm" disabled={linkCandidates.pending} />
                    }
                  >
                    Link to existing…
                    <ChevronDownIcon />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {existing.map((printing) => (
                      <DropdownMenuItem
                        key={printing.id}
                        onClick={() => void queueWrite((signal) => merge(signal, printing.id))}
                      >
                        {printing.expectedPrintingId}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button
                size="sm"
                disabled={!canAccept}
                pending={working}
                onClick={() => void queueWrite(accept, { limit: "upload" })}
              >
                Create <Kbd>A</Kbd>
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
        onMergeDuplicate={
          isAdmin
            ? (duplicate) => void queueWrite((signal) => merge(signal, duplicate.printingId))
            : undefined
        }
        disabled={working}
      />
      {issues.length > 0 && (
        <p className="text-muted-foreground text-sm">
          Still needed: {issues.map((issue) => issue.message).join(" ")}
        </p>
      )}
      {!isAdmin && (
        <p className="text-muted-foreground text-sm">
          Release dates, the note and extra images are added by an admin once the printing is
          created.
        </p>
      )}

      <ExistingPrintingsSection
        title={`${detail.displayName} already has`}
        printings={existing.map((printing) => ({
          ...printing,
          key: printing.id,
          printingId: printing.id,
          code: printing.expectedPrintingId,
        }))}
      />
    </RecordPane>
  );
}
