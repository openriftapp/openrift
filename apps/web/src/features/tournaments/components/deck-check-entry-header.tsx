import { legendDisplayName } from "@openrift/shared/card-name";
import type {
  DeckCheckEntryCardResponse,
  DeckCheckEntryDetailResponse,
  DeckCheckEntryState,
  DeckCheckReviewOutcome,
} from "@openrift/shared/types/api/deck-check";
import { WellKnown } from "@openrift/shared/well-known";
import {
  BanIcon,
  CheckIcon,
  EllipsisVerticalIcon,
  Link2Icon,
  PencilIcon,
  RotateCcwIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UndoIcon,
  Unlink2Icon,
  XIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { PageTopBarIconButton, PageTopBarPrimaryButton } from "@/components/layout/page-top-bar";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DefinitionDetail, DefinitionList, DefinitionTerm } from "@/components/ui/definition-list";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { DomainIcon } from "@/features/cards/components/domain-icon";
import { usePreferredPrinting } from "@/features/cards/hooks/use-preferred-printing";
import { DeckDomainBar } from "@/features/decks/components/deck-domain-bar";
import { FormatStateBadge } from "@/features/decks/components/deck-format-badge";
import { DeckIdentityLine } from "@/features/decks/components/deck-identity-line";
import { FannedPreview, typeCountSummary } from "@/features/decks/components/deck-tile";
import { DeckCheckStateBadge } from "@/features/tournaments/components/deck-check-state-badge";
import { SaveError } from "@/features/tournaments/components/save-error";
import {
  TournamentBreadcrumbBar,
  tournamentDecksCrumb,
} from "@/features/tournaments/components/tournament-detail-frame";
import { useDraftRevision } from "@/features/tournaments/hooks/use-draft-revision";
import {
  useDenyTournamentDeckCheckUnlock,
  useUnlinkTournamentDeckCheckEntry,
  useUpdateTournamentDeckCheckEntry,
} from "@/features/tournaments/hooks/use-tournament-deck-check";
import type { PendingTransition } from "@/features/tournaments/lib/deck-check-actions";
import {
  canRequestChanges,
  isPendingTransition,
  primaryActionFor,
} from "@/features/tournaments/lib/deck-check-actions";
import { useDomainColors } from "@/hooks/use-domain-colors";
import { getDomainGradientStyle } from "@/lib/domain";
import { memberName } from "@/lib/member-name";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function DeckEntryTopBar({
  tournamentId,
  entry,
  actions,
}: {
  tournamentId: string;
  entry?: DeckCheckEntryDetailResponse["entry"];
  actions?: ReactNode;
}) {
  return (
    <TournamentBreadcrumbBar
      id={tournamentId}
      trail={[tournamentDecksCrumb(tournamentId)]}
      title={entry?.playerName ?? m.tournaments_deck_check_entry_fallback_title()}
      actions={
        entry || actions ? (
          <>
            {entry ? (
              <DeckCheckStateBadge
                state={entry.state}
                reviewOutcome={entry.reviewOutcome}
                audience="staff"
              />
            ) : null}
            {actions}
          </>
        ) : undefined
      }
    />
  );
}

export function EntryTopBarActions({
  entry,
  transition,
  pendingTransition,
  canManage,
  onEdit,
  onDelete,
}: {
  entry: DeckCheckEntryDetailResponse["entry"];
  transition: (state: DeckCheckEntryState, reviewOutcome?: DeckCheckReviewOutcome) => void;
  pendingTransition: PendingTransition | null;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const primary = primaryActionFor(entry.state);
  const pending = pendingTransition !== null;
  return (
    <>
      {primary ? (
        <PageTopBarPrimaryButton
          disabled={pending}
          pending={isPendingTransition(pendingTransition, primary.state, primary.reviewOutcome)}
          onClick={() => transition(primary.state, primary.reviewOutcome)}
        >
          <primary.icon />
          {primary.label}
        </PageTopBarPrimaryButton>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<PageTopBarIconButton aria-label={m.tournaments_deck_check_entry_actions()} />}
        >
          <EllipsisVerticalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <PencilIcon className="size-4" />
            {m.tournaments_deck_check_edit_player_title()}
          </DropdownMenuItem>
          {entry.state === "withdrawn" ? null : (
            <DropdownMenuItem disabled={pending} onClick={() => transition("withdrawn")}>
              <BanIcon className="size-4" />
              {m.tournaments_deck_check_withdraw_entry()}
            </DropdownMenuItem>
          )}
          {canManage ? (
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2Icon className="size-4" />
              {m.tournaments_deck_check_delete_entry()}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export function EntryPreview({ cards }: { cards: DeckCheckEntryCardResponse[] }) {
  const { getPreferredPrinting, getPreferredFrontImage } = usePreferredPrinting();
  const domainColors = useDomainColors();

  const legendCardId = cards.find(
    (card) => card.zone === WellKnown.deckZone.LEGEND && card.resolvedCardId,
  )?.resolvedCardId;
  const championCardId = cards.find(
    (card) => card.zone === WellKnown.deckZone.CHAMPION && card.resolvedCardId,
  )?.resolvedCardId;
  const legendDomains = legendCardId ? getPreferredPrinting(legendCardId)?.card.domains : undefined;
  const gradientStyle =
    legendDomains && legendDomains.length > 0
      ? getDomainGradientStyle(legendDomains, "40", domainColors)
      : undefined;

  return (
    <div className="w-full shrink-0 self-start overflow-hidden rounded-lg border md:w-72">
      <FannedPreview
        legendImage={legendCardId ? (getPreferredFrontImage(legendCardId) ?? null) : null}
        championImage={championCardId ? (getPreferredFrontImage(championCardId) ?? null) : null}
        gradientStyle={gradientStyle}
      />
    </div>
  );
}

export function EntryHeader({
  tournamentId,
  entryId,
  detail,
  transition,
  pendingTransition,
}: {
  tournamentId: string;
  entryId: string;
  detail: DeckCheckEntryDetailResponse;
  transition: (state: DeckCheckEntryState, reviewOutcome?: DeckCheckReviewOutcome) => void;
  pendingTransition: PendingTransition | null;
}) {
  const { entry } = detail;
  const pending = pendingTransition !== null;
  const denyUnlock = useDenyTournamentDeckCheckUnlock();

  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <EntryMetaGrid entry={entry} />
          {entry.state === "editable" ? (
            <p className="text-muted-foreground mt-1.5 text-sm">
              {m.tournaments_deck_check_editing_note()}
            </p>
          ) : null}
          {entry.state === "withdrawn" ? (
            <p className="text-muted-foreground mt-1.5 text-sm">
              {m.tournaments_deck_check_withdrawn_note()}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AccountLinkAction tournamentId={tournamentId} entryId={entryId} entry={entry} />
          {entry.state === "submitted" && canRequestChanges(entry) ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              pending={isPendingTransition(pendingTransition, "editable", "issue")}
              onClick={() => transition("editable", "issue")}
            >
              <UndoIcon className="size-4" />
              {m.tournaments_deck_check_request_changes()}
            </Button>
          ) : null}
          {entry.state === "approved" ? (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                pending={isPendingTransition(pendingTransition, "submitted")}
                onClick={() => transition("submitted")}
              >
                <RotateCcwIcon className="size-4" />
                {m.tournaments_deck_check_revoke_approval()}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                pending={isPendingTransition(pendingTransition, "checked", "issue")}
                onClick={() => transition("checked", "issue")}
              >
                <TriangleAlertIcon className="size-4" />
                {m.tournaments_deck_check_mark_issue()}
              </Button>
            </>
          ) : null}
        </div>
      </div>
      {entry.unlockRequestedAt && (entry.state === "approved" || entry.state === "submitted") ? (
        <Alert variant="warning" className="flex flex-wrap items-center gap-2">
          <TriangleAlertIcon className="shrink-0" />
          <span className="min-w-0 flex-1">
            {entry.state === "approved"
              ? m.tournaments_deck_check_unlock_request_approved()
              : m.tournaments_deck_check_unlock_request_submitted()}
          </span>
          <Button
            size="sm"
            disabled={pending}
            pending={isPendingTransition(pendingTransition, "editable")}
            onClick={() => transition("editable")}
          >
            {m.tournaments_deck_check_allow_editing()}
          </Button>
          <Button
            size="sm"
            variant="outline"
            pending={denyUnlock.isPending}
            onClick={() => denyUnlock.mutate({ tournamentId, entryId })}
          >
            {m.tournaments_deck_check_decline()}
          </Button>
        </Alert>
      ) : null}
    </header>
  );
}

// An unlinked entry shows no Account row: "not linked" is the default, so
// omitting the row isn't a bug.
function EntryMetaGrid({ entry }: { entry: DeckCheckEntryDetailResponse["entry"] }) {
  const contact = [entry.riotId].filter(Boolean).join(" · ");
  const reviewer =
    entry.state === "checked" && entry.checkedByName
      ? entry.reviewOutcome === "issue"
        ? m.tournaments_deck_check_flagged_by({ name: entry.checkedByName })
        : m.tournaments_deck_check_checked_by({ name: entry.checkedByName })
      : entry.state === "approved" && entry.approvedByName
        ? m.tournaments_deck_check_approved_by({ name: entry.approvedByName })
        : null;
  return (
    <DefinitionList className="mt-1.5 gap-y-1">
      <MetaRow label={m.tournaments_deck_check_meta_contact()}>
        {contact || (
          <span className="text-muted-foreground">
            {m.tournaments_deck_check_meta_no_contact()}
          </span>
        )}
      </MetaRow>
      {reviewer ? (
        <MetaRow label={m.tournaments_deck_check_meta_reviewer()}>{reviewer}</MetaRow>
      ) : null}
      <MetaRow label={m.tournaments_deck_check_meta_sharing()}>
        <SharingValue entry={entry} />
      </MetaRow>
      {entry.claimedUserId ? (
        <MetaRow label={m.tournaments_deck_check_meta_account()}>
          <span className="flex items-center gap-1">
            <Link2Icon className="size-3.5 shrink-0" />
            {m.tournaments_deck_check_linked_to({
              name: memberName(entry.claimedUserName),
            })}
            {entry.claimSource === "self_submit"
              ? m.tournaments_deck_check_self_submitted_suffix()
              : ""}
          </span>
        </MetaRow>
      ) : null}
    </DefinitionList>
  );
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <DefinitionTerm>{label}</DefinitionTerm>
      <DefinitionDetail>{children}</DefinitionDetail>
    </>
  );
}

// Withholding the deck list keeps everything private, so name/Riot ID read as
// withheld too regardless of their own flags.
function SharingValue({ entry }: { entry: DeckCheckEntryDetailResponse["entry"] }) {
  const published = entry.allowDeckPublishing;
  const items = [
    { label: m.tournaments_deck_check_sharing_deck_list(), allowed: published },
    {
      label: m.tournaments_deck_check_sharing_name(),
      allowed: published && entry.allowNameSharing,
    },
    {
      label: m.tournaments_deck_check_sharing_riot_id(),
      allowed: published && entry.allowRiotIdSharing,
    },
  ];
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
      {items.map((item) => (
        <span
          key={item.label}
          className={cn("flex items-center gap-1", !item.allowed && "text-muted-foreground/50")}
        >
          {item.allowed ? (
            <CheckIcon className="text-success size-3.5" />
          ) : (
            <XIcon className="size-3.5" />
          )}
          {item.label}
        </span>
      ))}
    </span>
  );
}

// There is no manual link: an entry only attaches to an account via auto email
// match or the player's own claim, so this renders nothing when unlinked.
function AccountLinkAction({
  tournamentId,
  entryId,
  entry,
}: {
  tournamentId: string;
  entryId: string;
  entry: DeckCheckEntryDetailResponse["entry"];
}) {
  const unlink = useUnlinkTournamentDeckCheckEntry();

  if (!entry.claimedUserId) {
    return null;
  }
  return (
    <Button
      size="sm"
      variant="outline"
      pending={unlink.isPending}
      title={m.tournaments_deck_check_unlink_title()}
      onClick={() => unlink.mutate({ tournamentId, entryId })}
    >
      <Unlink2Icon className="size-4" />
      {m.tournaments_deck_check_unlink()}
    </Button>
  );
}

export function PlayerMessageField({
  tournamentId,
  entryId,
  entry,
}: {
  tournamentId: string;
  entryId: string;
  entry: DeckCheckEntryDetailResponse["entry"];
}) {
  const updateEntry = useUpdateTournamentDeckCheckEntry();
  const [message, setMessage] = useState("");
  const { dirty, markEdited, beginSave } = useDraftRevision();
  const value = dirty ? message : (entry.playerMessage ?? "");

  const save = async () => {
    const onSaved = beginSave();
    const playerMessage = value.trim() || null;
    if (
      await runReportedMutation(() =>
        updateEntry.mutateAsync({ tournamentId, entryId, playerMessage }),
      )
    ) {
      onSaved();
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Textarea
        value={value}
        onChange={(event) => {
          setMessage(event.target.value);
          markEdited();
        }}
        placeholder={m.tournaments_deck_check_player_message_placeholder()}
        maxLength={2000}
        rows={2}
      />
      <SaveError error={updateEntry.error} />
      {dirty ? (
        <Button
          size="sm"
          variant="outline"
          className="self-end"
          pending={updateEntry.isPending}
          onClick={() => void save()}
        >
          {m.tournaments_deck_check_save_message()}
        </Button>
      ) : null}
    </div>
  );
}

export function DeckCheckStatsSummary({
  cards,
  typeCounts,
  format,
  isValid,
  domainDistribution,
}: {
  cards: DeckCheckEntryCardResponse[];
  typeCounts: DeckCheckEntryDetailResponse["typeCounts"];
  format: string | null;
  isValid: boolean;
  domainDistribution: DeckCheckEntryDetailResponse["domainDistribution"];
}) {
  const { getPreferredPrinting } = usePreferredPrinting();

  const resolvedCard = (line: DeckCheckEntryCardResponse | undefined) =>
    line?.resolvedCardId ? getPreferredPrinting(line.resolvedCardId)?.card : undefined;
  const legendLine = cards.find((card) => card.zone === WellKnown.deckZone.LEGEND);
  const championLine = cards.find((card) => card.zone === WellKnown.deckZone.CHAMPION);
  const legendCard = resolvedCard(legendLine);
  const championCard = resolvedCard(championLine);
  const unresolved =
    (legendLine !== undefined && legendCard === undefined) ||
    (championLine !== undefined && championCard === undefined);
  const typeSummary = typeCountSummary(typeCounts);

  return (
    <div className="flex flex-col gap-2">
      {unresolved ? (
        <p className="text-muted-foreground truncate text-sm">
          {[
            legendCard ? legendDisplayName(legendCard) : legendLine?.rawName,
            championCard ? championCard.name : championLine?.rawName,
          ]
            .filter(Boolean)
            .join(" / ")}
        </p>
      ) : (
        <DeckIdentityLine legendCard={legendCard} championCard={championCard} className="text-sm" />
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1">
          {legendCard?.domains.map((domain) => (
            <DomainIcon key={domain} domain={domain} />
          ))}
          {typeSummary ? (
            <span className="text-muted-foreground text-2xs ml-1">{typeSummary}</span>
          ) : null}
        </span>
        {format ? <FormatStateBadge format={format} isValid={isValid} /> : null}
      </div>
      {domainDistribution.length > 0 ? <DeckDomainBar distribution={domainDistribution} /> : null}
    </div>
  );
}
