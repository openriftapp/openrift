import { getOrientation } from "@openrift/shared/card-orientation";
import type { PublicDeckCardResponse } from "@openrift/shared/types/api/deck";
import type { DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import { Link } from "@tanstack/react-router";
import { CopyIcon, EllipsisVerticalIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pressable } from "@/components/ui/pressable";
import { Skeleton } from "@/components/ui/skeleton";
import { TextLink } from "@/components/ui/text-link";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import { useOpenCardDetail } from "@/features/cards/components/card-detail-opener";
import { DomainIcon } from "@/features/cards/components/domain-icon";
import { OwnershipBand } from "@/features/decks/components/ownership-band";
import { useCopyArchivedDeck } from "@/features/decks/hooks/use-copy-archived-deck";
import { useCopyDeckCode } from "@/features/decks/hooks/use-copy-deck-code";
import { toEncodeDeckCards } from "@/features/decks/lib/deck-encode-input";
import type { OwnershipBandSegments } from "@/features/decks/lib/deck-ownership-band";
import { MetaContributors } from "@/features/meta/components/meta-contributors";
import { useMetaDeck } from "@/features/meta/hooks/use-meta";
import { useMetaOwnedCards } from "@/features/meta/hooks/use-meta-owned-cards";
import { describeIncompleteList, unknownZoneCounts } from "@/features/meta/lib/meta-deck-archive";
import type { MetaBanGroup, MetaDeckCardBan } from "@/features/meta/lib/meta-deck-bans";
import { metaDeckCardBanStates } from "@/features/meta/lib/meta-deck-bans";
import { metaCardOwnershipBand } from "@/features/meta/lib/meta-deck-collection";
import { deckRuneSplit, deckTypeSplit } from "@/features/meta/lib/meta-deck-composition";
import { metaDeckCopyFields } from "@/features/meta/lib/meta-deck-copy";
import { deckCardDetailKeys } from "@/features/meta/lib/meta-deck-side-keys";
import { inferredCards, inferredSummary } from "@/features/meta/lib/meta-inferred";
import { useCardHoverPreview } from "@/features/rules/components/rule-card-preview";
import { useHydrated } from "@/hooks/use-hydrated";
import { useSignInSearch } from "@/hooks/use-sign-in-search";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const SKELETON_THUMBS = 12;

function printingIdOf(card: PublicDeckCardResponse): string | null {
  return card.resolvedPrintingId ?? card.preferredPrintingId;
}

function byEnergyThenName(a: PublicDeckCardResponse, b: PublicDeckCardResponse): number {
  const energyA = a.energy ?? Number.MAX_SAFE_INTEGER;
  const energyB = b.energy ?? Number.MAX_SAFE_INTEGER;
  return energyA - energyB || a.cardName.localeCompare(b.cardName);
}

function zoneCards(
  cards: readonly PublicDeckCardResponse[],
  zone: DeckZone,
): PublicDeckCardResponse[] {
  return cards.filter((card) => card.zone === zone);
}

function StripCard({
  card,
  detailKey,
  sequence,
  sideboard,
  inferred,
  band,
  ban,
}: {
  card: PublicDeckCardResponse;
  detailKey: string | null;
  sequence: string[];
  sideboard?: boolean;
  inferred?: boolean;
  band?: OwnershipBandSegments;
  ban?: MetaDeckCardBan;
}) {
  const openCardDetail = useOpenCardDetail();
  const printingId = detailKey;
  const name = inferred ? m.meta_inferred_card_label({ name: card.cardName }) : card.cardName;
  const counted = card.quantity > 1 ? `${card.quantity}× ${name}` : name;
  let label = counted;
  if (ban !== undefined) {
    let banLabel = m.cards_thumb_ban_upcoming();
    if (ban.state === "banned") {
      banLabel =
        ban.modeFormat === undefined
          ? m.cards_thumb_banned()
          : m.cards_thumb_format_ban({ format: ban.modeFormat });
    }
    label = `${counted}, ${banLabel}`;
  }
  const landscape = getOrientation(card.cardTypes) === "landscape";
  const previewProps = {
    "aria-label": label,
    "data-card-image": card.imageId ?? undefined,
    "data-card-landscape": landscape ? "" : undefined,
  };
  const art = (
    <>
      <CardArtThumb
        imageId={card.imageId}
        domains={card.domains}
        className={sideboard ? "w-7" : "w-9"}
        loading="lazy"
        landscape={landscape}
      />
      {card.quantity > 1 && (
        <span
          className={cn(
            "text-2xs absolute right-0 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-black/65 px-1 font-semibold text-white tabular-nums",
            band ? "bottom-0.5" : "bottom-0",
          )}
        >
          {card.quantity}
        </span>
      )}
      {band && <OwnershipBand quantity={card.quantity} band={band} />}
      {ban && (
        <span
          aria-hidden
          className={cn(
            "absolute top-0 right-0 size-0 border-t-8 border-l-8 border-l-transparent",
            ban.state === "banned" ? "border-t-destructive" : "border-t-warning",
          )}
        />
      )}
    </>
  );
  const className = cn(
    "relative inline-block",
    sideboard && "opacity-55",
    inferred &&
      "outline-primary rounded-xs opacity-70 outline-[1.5px] -outline-offset-[1.5px] outline-dashed",
  );

  if (!openCardDetail || printingId === null) {
    return (
      <span role="img" className={className} {...previewProps}>
        {art}
      </span>
    );
  }
  return (
    <Pressable
      className={className}
      {...previewProps}
      onClick={() => openCardDetail({ printingId, sequence })}
    >
      {art}
    </Pressable>
  );
}

/** Suspends on the deck query; mount it under a Suspense boundary with {@link MetaEventDeckPreviewSkeleton}. */
export function MetaEventDeckPreview({
  token,
  banGroups,
}: {
  token: string;
  banGroups?: readonly MetaBanGroup[];
}) {
  const { data } = useMetaDeck(token);
  const copyToMyDecks = useCopyArchivedDeck();
  const deckCode = useCopyDeckCode(toEncodeDeckCards(data.cards));
  const hydrated = useHydrated();
  const signIn = useSignInSearch();
  const owned = useMetaOwnedCards(hydrated && copyToMyDecks.isLoggedIn);
  const cardPreview = useCardHoverPreview("[data-card-image]");
  const bandFor = (card: PublicDeckCardResponse) =>
    owned === undefined
      ? undefined
      : metaCardOwnershipBand(
          card,
          printingIdOf(card),
          owned.ownedByPrinting,
          owned.printingsByCardId,
          owned.lockedByPrinting,
        );

  const banStates = metaDeckCardBanStates(banGroups ?? []);
  const guessed = inferredCards(data.inferred);
  const guessedIds = new Set(guessed.map((card) => `${card.zone}:${card.cardId}`));
  const isGuessed = (card: PublicDeckCardResponse) => guessedIds.has(`${card.zone}:${card.cardId}`);
  const lead = [
    ...zoneCards(data.cards, WellKnown.deckZone.LEGEND),
    ...zoneCards(data.cards, WellKnown.deckZone.CHAMPION),
    ...zoneCards(guessed, WellKnown.deckZone.CHAMPION),
  ];
  const battlefields = [
    ...zoneCards(data.cards, WellKnown.deckZone.BATTLEFIELD),
    ...zoneCards(guessed, WellKnown.deckZone.BATTLEFIELD),
  ];
  const main = zoneCards(data.cards, WellKnown.deckZone.MAIN).toSorted(byEnergyThenName);
  const sideboard = zoneCards(data.cards, WellKnown.deckZone.SIDEBOARD).toSorted(byEnergyThenName);
  const unknown = unknownZoneCounts(data.cards, data.deck.format, data.meta.listStatus);
  const openChampion =
    (unknown.get(WellKnown.deckZone.CHAMPION) ?? 0) - (data.inferred?.champions.length ? 1 : 0);
  const openBattlefields =
    (unknown.get(WellKnown.deckZone.BATTLEFIELD) ?? 0) - (data.inferred?.battlefield ? 1 : 0);
  const groups = [
    { key: "lead", cards: lead, sideboard: false, unknownSlots: Math.max(0, openChampion) },
    {
      key: "battlefields",
      cards: battlefields,
      sideboard: false,
      unknownSlots: Math.max(0, openBattlefields),
    },
    { key: "main", cards: main, sideboard: false, unknownSlots: 0 },
    { key: "sideboard", cards: sideboard, sideboard: true, unknownSlots: 0 },
  ].filter((group) => group.cards.length > 0 || group.unknownSlots > 0);
  const detailKeyOf = deckCardDetailKeys(data.catalog.printings);
  const detailKeyFor = (card: PublicDeckCardResponse) =>
    detailKeyOf({ cardId: card.cardId, printingId: printingIdOf(card) });
  const sequence = [...lead, ...battlefields, ...main, ...sideboard]
    .map((card) => detailKeyFor(card))
    .filter((id) => id !== null);

  const types = deckTypeSplit(data.cards);
  const runes = deckRuneSplit(data.cards);
  const missing = describeIncompleteList(data.deck.format, unknown);

  return (
    <div className="flex flex-col gap-2.5">
      <div
        className="flex flex-wrap items-end gap-x-4 gap-y-1.5"
        onPointerOver={cardPreview.handlePointerOver}
        onPointerOut={cardPreview.handlePointerOut}
        onPointerDown={cardPreview.handlePointerDown}
      >
        {cardPreview.preview}
        {groups.map((group) => (
          <div key={group.key} data-group={group.key} className="flex flex-wrap items-end gap-1">
            {group.cards.map((card) => (
              <StripCard
                key={card.cardId}
                card={card}
                detailKey={detailKeyFor(card)}
                sequence={sequence}
                sideboard={group.sideboard}
                inferred={isGuessed(card)}
                band={isGuessed(card) ? undefined : bandFor(card)}
                ban={banStates.get(card.cardId)}
              />
            ))}
            {Array.from({ length: group.unknownSlots }, (_, index) => (
              <span
                key={`unknown-${index}`}
                aria-hidden
                data-unknown-slot
                className="aspect-card border-muted-foreground/40 inline-block w-9 rounded-xs border border-dashed"
              />
            ))}
          </div>
        ))}
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {types.total > 0 && (
          <span className="tabular-nums">
            {[
              m.meta_deck_preview_units({ count: types.units }),
              m.meta_deck_preview_spells({ count: types.spells }),
              m.meta_deck_preview_gear({ count: types.gear }),
            ].join(" · ")}
          </span>
        )}
        {runes.length > 0 && (
          <span className="flex items-center gap-x-2">
            {runes.map((rune) => (
              <span key={rune.domain} className="flex items-center gap-1">
                <DomainIcon domain={rune.domain} className="size-3.5" />
                <span className="tabular-nums">{rune.count}</span>
              </span>
            ))}
          </span>
        )}
        {missing !== null && <span>{missing}</span>}
        {guessed.length > 0 && (
          <span className="flex items-center gap-1.5">
            <Badge>{m.meta_inferred_badge()}</Badge>
            {inferredSummary(data.inferred)}
          </span>
        )}
        <MetaContributors contributors={data.meta.contributors} className="text-xs" />
        {!copyToMyDecks.isLoggedIn && (
          <TextLink render={<Link rel="nofollow" {...signIn} />}>
            {m.meta_deck_preview_sign_in_compare()}
          </TextLink>
        )}
        <span className="ml-auto" />
        <span className="flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label={m.meta_deck_preview_actions()} />
              }
            >
              <EllipsisVerticalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={copyToMyDecks.isPending}
                onClick={() =>
                  void copyToMyDecks.copy({
                    token,
                    deck: data.deck,
                    cards: data.cards,
                    ...metaDeckCopyFields(data, token),
                  })
                }
              >
                <CopyIcon />
                {copyToMyDecks.label}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={deckCode.pending}
                onClick={() => void deckCode.copyCode()}
              >
                <CopyIcon />
                {m.meta_deck_preview_copy_code()}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link
            to="/meta/decks/$token"
            params={{ token }}
            className={buttonVariants({ size: "sm" })}
          >
            {m.meta_deck_preview_open_deck()}
          </Link>
        </span>
      </div>
    </div>
  );
}

export function MetaEventDeckPreviewSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-end gap-1">
        {Array.from({ length: SKELETON_THUMBS }, (_, index) => (
          <Skeleton key={index} className="aspect-card w-9" />
        ))}
      </div>
      <Skeleton className="h-3 w-64" />
    </div>
  );
}
