import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import { pluralize } from "@openrift/shared/strings";
import type {
  AdminCardDetailResponse,
  UnmatchedCardDetailResponse,
} from "@openrift/shared/types/api/admin";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LinkIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { buildSourceSubmitters } from "@/features/admin/lib/candidate-submitter";
import { CardSearchDropdown } from "@/features/cards/components/card-search-dropdown";
import { useAdminCardSearch } from "@/features/cards/hooks/use-card-search";
import { CreationPanel } from "@/features/catalog-workspace/components/creation/creation-panel";
import { FieldRow } from "@/features/catalog-workspace/components/record/field-row";
import { Kbd } from "@/features/catalog-workspace/components/record/kbd";
import {
  RecordBanner,
  RecordHeader,
  RecordPane,
  RecordSection,
} from "@/features/catalog-workspace/components/record/record-pane";
import { useQueueNavigation } from "@/features/catalog-workspace/hooks/use-queue-navigation";
import { useRegisterRecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
import type { CreationDraft, DraftCard } from "@/features/catalog-workspace/lib/creation-draft";
import { toAcceptInput } from "@/features/catalog-workspace/lib/creation-draft";
import type { NewCardGroup } from "@/features/catalog-workspace/lib/new-card-groups";
import {
  checkedGroupKeys,
  isDraftComplete,
  runInSequence,
  seedNewCardGroups,
} from "@/features/catalog-workspace/lib/new-card-groups";
import { useCostKeywords } from "@/hooks/use-keyword-styles";
import { PERSISTENT_ERROR_TOAST } from "@/lib/toast";

function nameHead(name: string): string {
  return name.split(",")[0]?.trim() ?? name;
}

export function NewCardRecord({ name }: { name: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const navigation = useQueueNavigation("card");
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
  const [editingCardId, setEditingCardId] = useState(false);
  const [groupEdits, setGroupEdits] = useState<ReadonlyMap<string, CreationDraft>>(new Map());
  const [picks, setPicks] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [acceptPending, setAcceptPending] = useState(false);
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
  const newCard: DraftCard = {
    mode: "new",
    slug: cardId,
    name: typeof activeCard.name === "string" ? activeCard.name : displayName,
    summary: `${sources.length} ${pluralize(sources.length, "source")}`,
  };
  const groups: NewCardGroup[] = (
    detail ? seedNewCardGroups(detail, sortByProviderOrder(providerSettings), newCard) : []
  ).map((group) => {
    const edit = groupEdits.get(group.key);
    return edit === undefined ? group : { ...group, draft: { ...edit, card: newCard } };
  });
  const checked = new Set(checkedGroupKeys(groups, picks));
  const focused = groups.find((group) => group.key === focusKey) ?? groups.at(0);
  const busy = acceptPending || acceptNewCard.isPending || acceptPrintingGroup.isPending;
  const canAccept = hasRequiredActiveFields(activeCard) && cardId.length > 0;
  const providerRows = sources.filter((source) => source.provider !== USER_SUBMISSION_PROVIDER);
  const remainingGroups = groups.length - checked.size;

  function openCard(cardSlug: string) {
    accepting.current = false;
    void navigate({ to: "/admin/workspace/cards/$cardSlug", params: { cardSlug }, search: true });
  }

  async function acceptPrintings(cardSlug: string, chosen: readonly NewCardGroup[]) {
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
      toast.error(
        "The card was created, but its printings were not accepted. They stay under Printings, New.",
        PERSISTENT_ERROR_TOAST,
      );
      return;
    }
    const failures = await runInSequence(chosen, (group) =>
      acceptPrintingGroup.mutateAsync(toAcceptInput(group.draft, cardUuid)),
    );
    if (failures.length > 0) {
      toast.error(
        `Not accepted: ${failures.map((failure) => failure.item.label).join(", ")}. ${failures.length === 1 ? "It stays" : "They stay"} under Printings, New.`,
        PERSISTENT_ERROR_TOAST,
      );
    }
  }

  async function acceptAsNew() {
    if (!canAccept || busy || accepting.current) {
      return;
    }
    const cardFields = { id: cardId, ...activeCard } as AcceptNewCardBody["cardFields"];
    const issues = describeAcceptCardFieldIssues(cardFields);
    if (issues.length > 0) {
      toast.error(`Can't accept this card:\n${issues.join("\n")}`, PERSISTENT_ERROR_TOAST);
      return;
    }
    accepting.current = true;
    setAcceptPending(true);
    try {
      await acceptNewCard.mutateAsync({ name, cardFields });
    } catch {
      accepting.current = false;
      setAcceptPending(false);
      return;
    }
    const chosen = groups.filter((group) => checked.has(group.key));
    if (chosen.length > 0) {
      await acceptPrintings(cardId, chosen);
    }
    setAcceptPending(false);
    openCard(cardId);
  }

  function editGroup(key: string, draft: CreationDraft) {
    setGroupEdits(new Map(groupEdits).set(key, draft));
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
    accept: () => acceptAsNew(),
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
          <Button variant="ghost" size="sm" onClick={() => navigation.skipToEnd()}>
            Skip to end <Kbd>S</Kbd>
          </Button>
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
          <Button disabled={!canAccept} pending={busy} onClick={() => void acceptAsNew()}>
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
          {checked.size > 0
            ? `Accepting creates the card and the ${checked.size} ticked ${pluralize(checked.size, "printing")} under “What gets created”.`
            : "Accepting creates the card. Tick a complete printing under “What gets created” to add it in the same step."}
          {remainingGroups > 0 &&
            ` ${remainingGroups} unticked ${pluralize(remainingGroups, "printing")} ${remainingGroups === 1 ? "stays" : "stay"} under Printings, New.`}
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
        <FieldRow
          label="Card ID"
          value={<span className="font-mono">{cardId}</span>}
          onEdit={() => setEditingCardId(true)}
          editing={
            editingCardId ? (
              <Input
                aria-label="Card ID"
                value={cardIdEdit ?? detail.defaultCardId}
                onChange={(event) => setCardIdEdit(event.target.value)}
                onBlur={() => setEditingCardId(false)}
                className="w-48 font-mono"
                // oxlint-disable-next-line jsx-a11y/no-autofocus -- opened by its Edit button, focus follows the click
                autoFocus
              />
            ) : undefined
          }
        />
        {groups.length === 0 ? (
          <p className="text-muted-foreground mt-2">
            No source lists a printing. Add one under Printings after accepting.
          </p>
        ) : (
          <div className="mt-2 mb-3 flex flex-col">
            {groups.map((group) => {
              const complete = isDraftComplete(group.draft);
              const id = `new-card-group-${group.key}`;
              return (
                <div
                  key={group.key}
                  className="flex flex-wrap items-center gap-2.5 border-t py-1.5"
                >
                  <Checkbox
                    id={id}
                    checked={checked.has(group.key)}
                    disabled={!complete || busy}
                    onCheckedChange={(value) => setPicks(new Map(picks).set(group.key, value))}
                  />
                  <Label htmlFor={id} className="flex-1">
                    {group.label}
                  </Label>
                  {!complete && <Badge variant="warning">Incomplete</Badge>}
                  <Button
                    variant={focused?.key === group.key ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setFocusKey(group.key)}
                  >
                    {focused?.key === group.key ? "Editing" : "Edit"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        {focused !== undefined && (
          <CreationPanel
            key={focused.key}
            draft={focused.draft}
            onChange={(draft) => editGroup(focused.key, draft)}
            disabled={busy}
          />
        )}
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
