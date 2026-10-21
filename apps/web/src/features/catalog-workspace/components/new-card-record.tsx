import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import { pluralize } from "@openrift/shared/strings";
import type {
  AdminCardDetailResponse,
  CandidatePrintingResponse,
  UnmatchedCardDetailResponse,
} from "@openrift/shared/types/api/admin";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LinkIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { CandidateSpreadsheet } from "@/features/admin/components/candidate-spreadsheet";
import {
  buildPreseededActiveCard,
  sortByProviderOrder,
  useCardDetailData,
} from "@/features/admin/components/card-detail-shared";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import type { AcceptNewCardBody } from "@/features/admin/hooks/use-admin-card-mutations";
import {
  useAcceptNewCard,
  useAcceptPrintingGroup,
  useLinkCard,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { useAllCards, useUnmatchedCardDetail } from "@/features/admin/hooks/use-admin-card-queries";
import { useIgnoreCandidateCard } from "@/features/admin/hooks/use-ignored-candidates";
import {
  describeAcceptCardFieldIssues,
  hasRequiredActiveFields,
} from "@/features/admin/lib/accept-card-validation";
import { adminCardDetailQueryOptions } from "@/features/admin/lib/admin-card-queries";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { buildPrintingGroups } from "@/features/admin/lib/candidate-printing-groups";
import { buildSourceSubmitters } from "@/features/admin/lib/candidate-submitter";
import { CardSearchDropdown } from "@/features/cards/components/card-search-dropdown";
import { useAdminCardSearch } from "@/features/cards/hooks/use-card-search";
import { CreationPanel } from "@/features/catalog-workspace/components/creation/creation-panel";
import { Kbd } from "@/features/catalog-workspace/components/record/kbd";
import {
  RecordBanner,
  RecordHeader,
  RecordPane,
  RecordSection,
} from "@/features/catalog-workspace/components/record/record-pane";
import { useRegisterRecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
import type { CreationDraft } from "@/features/catalog-workspace/lib/creation-draft";
import {
  draftFromNewCard,
  toAcceptInput,
  validateDraft,
} from "@/features/catalog-workspace/lib/creation-draft";
import { useCostKeywords } from "@/hooks/use-keyword-styles";
import { PERSISTENT_ERROR_TOAST } from "@/lib/toast";

function firstCandidate(
  detail: UnmatchedCardDetailResponse,
  compareProviders: (a: string, b: string) => number,
): { candidate: CandidatePrintingResponse; provider: string; groupIds: string[] } | undefined {
  const providerOf = new Map(detail.sources.map((source) => [source.id, source.provider]));
  const [group] = buildPrintingGroups(detail.candidatePrintingGroups, detail.candidatePrintings);
  const candidates = group?.candidates ?? detail.candidatePrintings.slice(0, 1);
  const [candidate] = candidates.toSorted((a, b) =>
    compareProviders(
      providerOf.get(a.candidateCardId) ?? "",
      providerOf.get(b.candidateCardId) ?? "",
    ),
  );
  return candidate === undefined
    ? undefined
    : {
        candidate,
        provider: providerOf.get(candidate.candidateCardId) ?? "",
        groupIds: candidates.map((entry) => entry.id),
      };
}

function nameHead(name: string): string {
  return name.split(",")[0]?.trim() ?? name;
}

export function NewCardRecord({ name }: { name: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: access } = useAdminAccess();
  const isAdmin = access?.isAdmin === true;
  const scope = [
    adminKeys.cards.unmatched(name),
    adminKeys.cards.list,
    adminKeys.cards.allCards,
    adminKeys.workspace,
  ];
  const { data, isLoading } = useUnmatchedCardDetail(name);
  const detail = data as UnmatchedCardDetailResponse | undefined;
  const { providerSettings, newCardFields, checkCandidateCard, uncheckCandidateCard } =
    useCardDetailData(scope);
  const acceptNewCard = useAcceptNewCard();
  const acceptPrintingGroup = useAcceptPrintingGroup(scope);
  const linkCard = useLinkCard();
  const ignoreSource = useIgnoreCandidateCard(scope);
  const { data: allCards } = useAllCards();
  const costKeywords = useCostKeywords();

  const [edits, setEdits] = useState<Record<string, unknown> | null>(null);
  const [cardIdEdit, setCardIdEdit] = useState<string | null>(null);
  const [draftEdit, setDraftEdit] = useState<CreationDraft | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");
  const accepting = useRef(false);
  const displayName = detail?.displayName ?? name;
  const similar = useAdminCardSearch(allCards, nameHead(displayName)).slice(0, 3);
  const mergeResults = useAdminCardSearch(allCards, mergeSearch);

  const sources = detail?.sources ?? [];
  const preseeded = detail
    ? buildPreseededActiveCard(sources, newCardFields, providerSettings)
    : {};
  const activeCard = edits ?? preseeded;
  const cardId = (cardIdEdit ?? detail?.defaultCardId ?? "").trim();
  const seed = detail ? firstCandidate(detail, sortByProviderOrder(providerSettings)) : undefined;
  const seededDraft = draftFromNewCard(
    {
      slug: cardId,
      name: typeof activeCard.name === "string" ? activeCard.name : displayName,
      summary: `${sources.length} ${pluralize(sources.length, "source")}`,
    },
    seed?.candidate,
    seed?.provider ?? "",
  );
  const draft =
    draftEdit ??
    (seed === undefined ? seededDraft : { ...seededDraft, candidatePrintingIds: seed.groupIds });
  const printingReady =
    draft.faces.length > 0 &&
    draft.candidatePrintingIds.length > 0 &&
    validateDraft(draft).length === 0;
  const canAccept = hasRequiredActiveFields(activeCard) && cardId.length > 0;
  const providerRows = sources.filter((source) => source.provider !== USER_SUBMISSION_PROVIDER);
  const groupCount = detail
    ? buildPrintingGroups(detail.candidatePrintingGroups, detail.candidatePrintings).length
    : 0;
  const remainingGroups = Math.max(0, groupCount - (printingReady ? 1 : 0));

  function openCard(cardSlug: string) {
    accepting.current = false;
    void navigate({ to: "/admin/workspace/cards/$cardSlug", params: { cardSlug }, search: true });
  }

  async function acceptPrinting(cardSlug: string) {
    let fresh: AdminCardDetailResponse | null = null;
    try {
      fresh = (await queryClient.query(
        adminCardDetailQueryOptions(cardSlug),
      )) as AdminCardDetailResponse;
    } catch {
      fresh = null;
    }
    const cardUuid = fresh?.card?.id;
    if (cardUuid === undefined) {
      openCard(cardSlug);
      return;
    }
    acceptPrintingGroup.mutate(toAcceptInput(draft, cardUuid), {
      onSettled: () => openCard(cardSlug),
    });
  }

  function acceptAsNew() {
    if (!canAccept || acceptNewCard.isPending || accepting.current) {
      return;
    }
    const cardFields = { id: cardId, ...activeCard } as AcceptNewCardBody["cardFields"];
    const issues = describeAcceptCardFieldIssues(cardFields);
    if (issues.length > 0) {
      toast.error(`Can't accept this card:\n${issues.join("\n")}`, PERSISTENT_ERROR_TOAST);
      return;
    }
    accepting.current = true;
    acceptNewCard.mutate(
      { name, cardFields },
      {
        onError: () => {
          accepting.current = false;
        },
        onSuccess: () => {
          if (printingReady) {
            void acceptPrinting(cardId);
            return;
          }
          openCard(cardId);
        },
      },
    );
  }

  function ignoreDraft() {
    for (const source of providerRows) {
      ignoreSource.mutate({ provider: source.provider, externalId: source.externalId });
    }
  }

  function mergeInto(targetId: string) {
    const targetSlug = allCards.find((card) => card.id === targetId)?.slug ?? targetId;
    linkCard.mutate({ name, cardId: targetId }, { onSuccess: () => openCard(targetSlug) });
  }

  useRegisterRecordActions({
    primary: { label: "Next", run: () => Promise.resolve() },
    accept: acceptAsNew,
    ignore: isAdmin && providerRows.length > 0 ? ignoreDraft : undefined,
  });

  if (isLoading || detail === undefined) {
    return (
      <RecordPane header={<Skeleton className="h-10 w-64" />}>
        <Skeleton className="h-64" />
      </RecordPane>
    );
  }

  const header = (
    <RecordHeader
      title={displayName}
      badges={<Badge variant="violet">New</Badge>}
      actions={
        <>
          {isAdmin && providerRows.length > 0 && (
            <Button variant="outline" disabled={ignoreSource.isPending} onClick={ignoreDraft}>
              Ignore
              <Kbd>X</Kbd>
            </Button>
          )}
          {isAdmin && (
            <Button variant="outline" onClick={() => setMergeOpen(true)}>
              Merge into existing…
            </Button>
          )}
          <Button
            disabled={!canAccept}
            pending={acceptNewCard.isPending || acceptPrintingGroup.isPending}
            onClick={acceptAsNew}
          >
            Accept as new card
            <Kbd>A</Kbd>
          </Button>
        </>
      }
    />
  );

  return (
    <RecordPane
      header={header}
      banner={
        <RecordBanner>
          {printingReady
            ? "Accepting creates the card and what is listed under “What gets created”."
            : "Accepting creates the card. Fill in the face under “What gets created” to add its printing in the same step."}
          {remainingGroups > 0 &&
            ` ${remainingGroups} other ${pluralize(remainingGroups, "printing")} from sources ${remainingGroups === 1 ? "stays" : "stay"} under Printings, New.`}
          {!canAccept && " Pick name, types and domains first."}
        </RecordBanner>
      }
    >
      {isAdmin && similar.length > 0 && (
        <RecordSection title="Already in the catalog?">
          <ul className="flex flex-col gap-2">
            {similar.map((card) => (
              <li key={card.id} className="flex flex-wrap items-center gap-3">
                <span className="flex-1">
                  <strong>{card.label}</strong>{" "}
                  <span className="text-muted-foreground">
                    has a similar name. Same card under a new title?
                  </span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={linkCard.isPending}
                  onClick={() => mergeInto(card.id)}
                >
                  Merge here
                </Button>
              </li>
            ))}
          </ul>
        </RecordSection>
      )}

      <RecordSection
        title="Card fields"
        actions={<span className="text-muted-foreground text-sm">Click a value to pick it</span>}
      >
        <CandidateSpreadsheet
          fields={newCardFields}
          requiredKeys={["name", "types", "domains"]}
          activeRow={Object.keys(activeCard).length > 0 ? activeCard : null}
          candidateRows={sources}
          submitters={buildSourceSubmitters(sources)}
          providerSettings={providerSettings}
          costKeywords={costKeywords}
          onCellClick={(field, value) => setEdits({ ...activeCard, [field]: value })}
          onActiveChange={(field, value) =>
            setEdits(
              value === null || value === undefined
                ? Object.fromEntries(Object.entries(activeCard).filter(([key]) => key !== field))
                : { ...activeCard, [field]: value },
            )
          }
          onCheck={isAdmin ? (candidateId) => checkCandidateCard.mutate(candidateId) : undefined}
          onUncheck={
            isAdmin ? (candidateId) => uncheckCandidateCard.mutate(candidateId) : undefined
          }
        />
      </RecordSection>

      <RecordSection title="What gets created">
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="new-card-id">Card ID</Label>
            <Input
              id="new-card-id"
              value={cardIdEdit ?? detail.defaultCardId}
              onChange={(event) => setCardIdEdit(event.target.value)}
              className="w-48 font-mono"
            />
          </div>
        </div>
        <CreationPanel
          draft={draft}
          onChange={setDraftEdit}
          disabled={acceptNewCard.isPending || acceptPrintingGroup.isPending}
        />
      </RecordSection>

      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge into an existing card</DialogTitle>
          </DialogHeader>
          <CardSearchDropdown
            results={mergeResults}
            onSearch={(query) => {
              setMergeSearch(query);
              setMergeTarget("");
            }}
            onSelect={(id) => setMergeTarget(id)}
            placeholder="Search by name…"
          />
          <Button
            disabled={mergeTarget.length === 0}
            pending={linkCard.isPending}
            onClick={() => mergeInto(mergeTarget)}
          >
            <LinkIcon />
            Merge
          </Button>
        </DialogContent>
      </Dialog>
    </RecordPane>
  );
}
