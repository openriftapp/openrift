import type { DeckListItemResponse } from "@openrift/shared/types/api/deck";
import { Link } from "@tanstack/react-router";
import { ArchiveIcon, PinIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cardLinkVariants } from "@/components/ui/card-link";
import { DomainIcon } from "@/features/cards/components/domain-icon";
import { usePreferredPrinting } from "@/features/cards/hooks/use-preferred-printing";
import { useBoxedDecks } from "@/features/decks/hooks/use-boxed-decks";
import { useDeckSelectState } from "@/features/decks/hooks/use-deck-select-state";
import { useIsLocalDeck } from "@/features/decks/hooks/use-local-decks";
import type { DeckFamilyEntry } from "@/features/decks/lib/deck-family";
import { familyFrontView } from "@/features/decks/lib/deck-family";
import { deckBoxPart } from "@/features/decks/lib/deck-meta";
import { resolveFormatTagSummary } from "@/features/decks/lib/format-tag-config";
import { useDomainColors } from "@/hooks/use-domain-colors";
import { useCustomTagList } from "@/hooks/use-enums";
import { getDomainGradientStyle } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { DeckActionsMenu } from "./deck-actions-menu";
import { DeckFolderChips } from "./deck-folder-chips";
import { DeckFormatText } from "./deck-format-badge";
import { DeckIdentityLine } from "./deck-identity-line";
import { DeckMetaLine } from "./deck-meta-line";
import { DeckSelectMark } from "./deck-select-mark";
import { DraftBadge, FamilyFrontLine, VariantCountToggle } from "./deck-variant-controls";
import { LocalDeckBadge } from "./local-save-hint";

export function DeckListRow({
  item,
  folderLabels = {},
  family,
  onToggleFamily,
  showPrimary = false,
}: {
  item: DeckListItemResponse;
  folderLabels?: Record<string, string>;
  /** Absent for a standalone deck. */
  family?: DeckFamilyEntry;
  onToggleFamily?: (familyId: string) => void;
  showPrimary?: boolean;
}) {
  const {
    deck,
    legendCardId,
    championCardId,
    isValid,
    totalCards,
    requiredProgress,
    requiredTotal,
  } = item;
  const isLocal = useIsLocalDeck(deck.id);
  const { selectMode, selected } = useDeckSelectState(deck.id, isLocal);
  const { getPreferredPrinting } = usePreferredPrinting();
  const { all: customTags } = useCustomTagList();

  const legendCard = legendCardId ? getPreferredPrinting(legendCardId)?.card : undefined;
  const championCard = championCardId ? getPreferredPrinting(championCardId)?.card : undefined;

  const domainColors = useDomainColors();
  const legendDomains = legendCard?.domains;

  const tagSummary = resolveFormatTagSummary(deck.format, deck.formatConfig, customTags);
  const boxed = useBoxedDecks(deck, family);
  const boxPart = deckBoxPart(boxed, deck.id);

  const gradientStyle =
    legendDomains && legendDomains.length > 0
      ? getDomainGradientStyle(legendDomains, "10", domainColors)
      : undefined;

  // Built before the return so the narrowing survives into the JSX.
  const variantToggle =
    family && onToggleFamily && family.role === "front" && family.memberCount > 1 ? (
      <VariantCountToggle family={family} onToggle={onToggleFamily} />
    ) : null;
  const { title, isNamedGroup, metaItem } = familyFrontView(item, family);

  // One element for both renderings, so the phone line and the columns can't
  // disagree about the deck's state.
  const formatText = (
    <DeckFormatText
      format={deck.format}
      totalCards={totalCards}
      requiredProgress={requiredProgress}
      requiredTotal={requiredTotal}
      isValid={isValid}
    />
  );

  return (
    <div
      className={cn(
        cardLinkVariants(),
        // Domain gradient is an inline style that overrides the hover wash on
        // legend decks, so drop the wash everywhere to keep rows consistent.
        "ring-border group relative flex items-center gap-3 rounded-lg px-3 py-2 ring-1 hover:bg-transparent data-[archived=true]:opacity-60",
        // Stretched-link: the deck name is the row's only anchor (an anchor
        // can't contain the menu and badges), so the focus ring follows it.
        "has-[a:focus-visible]:ring-ring/50 has-[a:focus-visible]:ring-2",
        // Anything reacting to hover must sit above the stretched-link overlay
        // (tooltip triggers, native titles) or it never sees the hover.
        "**:data-[slot=tooltip-trigger]:relative **:data-[slot=tooltip-trigger]:z-10",
        "[&_[title]]:relative [&_[title]]:z-10",
        // Indent is the only thing marking a revealed sibling as one.
        family?.role === "member" && "ml-4 sm:ml-8",
        "data-[selected=true]:ring-border-accent data-[selected=true]:ring-2",
      )}
      data-archived={deck.archivedAt !== null}
      data-selected={selected}
      style={gradientStyle}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {selectMode && <DeckSelectMark deckId={deck.id} deckName={deck.name} />}
        <div className="flex shrink-0 items-center gap-0.5">
          {legendDomains?.map((domain) => (
            <DomainIcon key={domain} domain={domain} className="size-4" />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {deck.isPinned && (
              <PinIcon
                className="text-muted-foreground size-3.5 shrink-0"
                aria-label={m.decks_list_pinned()}
              />
            )}
            {deck.archivedAt !== null && (
              <ArchiveIcon
                className="text-muted-foreground size-3.5 shrink-0"
                aria-label={m.decks_list_archived()}
              />
            )}
            {/* The ::after is what makes the whole row clickable. It resolves
                against the row root, the only positioned ancestor. */}
            {selectMode ? (
              <span className="truncate font-medium">{title}</span>
            ) : (
              <Link
                to="/decks/$deckId"
                params={{ deckId: deck.id }}
                className="truncate rounded-lg font-medium outline-none after:absolute after:inset-0"
              >
                {title}
              </Link>
            )}
            {showPrimary && deck.isPrimary && (
              <Badge variant="secondary" className="shrink-0">
                {m.decks_dialog_variants_badge_primary()}
              </Badge>
            )}
            {deck.isDraft && <DraftBadge />}
            {variantToggle}
          </div>
          {isNamedGroup && <FamilyFrontLine deck={deck} />}
          <DeckIdentityLine
            legendCard={legendCard}
            championCard={championCard}
            tagSummary={tagSummary}
          />
          {/* Below md there's no width for both columns and a readable name. */}
          <DeckMetaLine
            item={metaItem}
            family={family}
            leading={formatText}
            className="mt-0.5 md:hidden"
          />
        </div>
      </div>

      {/* Folders sit alongside the box, on the same md+ tier: below that the row
          is already fighting for the deck name's width. */}
      <DeckFolderChips
        folderIds={item.folderIds}
        folderLabels={folderLabels}
        className="hidden shrink-0 flex-nowrap md:flex"
      />

      {/* The box sits between the name and the stat columns, sized to its own
          text: as free text it would only truncate in a fixed column, and the
          name block's flex-1 pushes it up against the columns anyway. */}
      {boxPart.text && (
        <span
          title={boxPart.title}
          className="text-muted-foreground hidden min-w-0 truncate text-xs md:block"
        >
          {boxPart.text}
        </span>
      )}

      {/* The format rides in the stat cluster as text, not as a badge: a chip
          here is shrink-0 chrome that costs the deck name its width. */}
      <DeckMetaLine
        item={metaItem}
        family={family}
        variant="columns"
        leading={formatText}
        className="hidden shrink-0 md:flex"
      />

      {/* Above the stretched link, so the menu takes its own clicks. */}
      <div className="relative z-10 flex shrink-0 items-center gap-1">
        {isLocal && <LocalDeckBadge className="hidden md:inline-flex" />}
        <DeckActionsMenu item={item} family={family} source={isLocal ? "local" : "server"} />
      </div>
    </div>
  );
}
