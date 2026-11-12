import { imageUrl } from "@openrift/shared/image-url";
import { formatRecord } from "@openrift/shared/meta-standings";
import type { PublicDeckCardResponse } from "@openrift/shared/types/api/deck";
import type { MetaDeckInference, MetaInferenceNeighbour } from "@openrift/shared/types/api/meta";
import type { DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pressable } from "@/components/ui/pressable";
import { TextLink } from "@/components/ui/text-link";
import type { InferredZoneSlots } from "@/features/decks/components/deck-overview-zone-tile";
import {
  LANDSCAPE_THUMB_CLASS,
  LANDSCAPE_THUMB_STYLE,
  PORTRAIT_THUMB_CLASS,
  PORTRAIT_THUMB_STYLE,
} from "@/features/decks/lib/deck-thumb-metrics";
import { formatRank } from "@/features/meta/lib/meta-format";
import { inferredCardLabel, joinNames } from "@/features/meta/lib/meta-inferred";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

function NeighbourRow({
  neighbour,
  zone,
  mainCount,
}: {
  neighbour: MetaInferenceNeighbour;
  zone: DeckZone;
  mainCount: number;
}) {
  const played =
    zone === WellKnown.deckZone.CHAMPION
      ? neighbour.championName
      : neighbour.battlefieldNames.length > 0
        ? joinNames(neighbour.battlefieldNames)
        : null;
  const record = formatRecord(neighbour.wins, neighbour.losses, neighbour.draws);
  const finish = [formatRank(neighbour.rank, neighbour.rankIsTier), record]
    .filter((part) => part !== null)
    .join(" · ");
  return (
    <li className="border-border grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-t py-2 text-sm">
      <TextLink
        className="truncate"
        render={<Link to="/meta/decks/$token" params={{ token: neighbour.shareToken }} />}
      >
        {neighbour.playerName === ""
          ? neighbour.eventName
          : `${neighbour.playerName} · ${neighbour.eventName}`}
      </TextLink>
      <span className="text-muted-foreground text-xs">
        {m.meta_inferred_shared({
          shared: String(neighbour.shared),
          total: String(mainCount),
        })}
      </span>
      <span className="text-muted-foreground text-xs">{finish}</span>
      {played !== null && (
        <span className="text-muted-foreground col-span-2 text-xs">
          {m.meta_inferred_played({ name: played })}
        </span>
      )}
    </li>
  );
}

function WhyPopoverBody({
  title,
  explanation,
  neighbours,
  zone,
  mainCount,
}: {
  title: string;
  explanation: string;
  neighbours: readonly MetaInferenceNeighbour[];
  zone: DeckZone;
  mainCount: number;
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Badge>{m.meta_inferred_badge()}</Badge>
        <span className="font-medium">{title}</span>
      </div>
      <p className="text-muted-foreground text-sm">{explanation}</p>
      <ul>
        {neighbours.map((neighbour) => (
          <NeighbourRow
            key={neighbour.shareToken}
            neighbour={neighbour}
            mainCount={mainCount}
            zone={zone}
          />
        ))}
      </ul>
    </>
  );
}

function AlsoSeen({ cards }: { cards: MetaDeckInference["alsoSeenBattlefields"] }) {
  if (cards.length === 0) {
    return null;
  }
  return (
    <p className="text-muted-foreground text-sm">
      {m.meta_inferred_also_seen()}:{" "}
      {cards.map((card, index) => (
        <span key={card.cardId}>
          {index > 0 && ", "}
          <TextLink
            render={
              <Link to="/cards/$cardSlug/{-$printingSlug}" params={{ cardSlug: card.slug }} />
            }
          >
            {card.name}
          </TextLink>
        </span>
      ))}
    </p>
  );
}

function InferredCardFrame({
  card,
  landscape,
  caption,
  className,
}: {
  card: PublicDeckCardResponse;
  landscape: boolean;
  caption?: string;
  className?: string;
}) {
  const label = inferredCardLabel(card);
  return (
    <span
      style={landscape ? LANDSCAPE_THUMB_STYLE : PORTRAIT_THUMB_STYLE}
      className={cn(
        landscape ? LANDSCAPE_THUMB_CLASS : PORTRAIT_THUMB_CLASS,
        "outline-primary bg-primary/10 relative flex shrink-0 flex-col justify-end overflow-hidden rounded-md text-left outline-[1.5px] -outline-offset-[1.5px] outline-dashed",
        className,
      )}
    >
      {card.imageId !== null && (
        <img
          src={imageUrl(card.imageId, "400w")}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover opacity-45"
        />
      )}
      <Badge className="absolute top-1.5 left-1.5">{m.meta_inferred_badge()}</Badge>
      <span className="from-background/90 relative bg-linear-to-t to-transparent p-2 pt-6 text-xs">
        {caption !== undefined && <span className="text-primary block font-medium">{caption}</span>}
        <span className="text-foreground line-clamp-2">{label}</span>
      </span>
    </span>
  );
}

function InferredSlot({
  cards,
  zone,
  inferred,
  mainCount,
}: {
  cards: readonly PublicDeckCardResponse[];
  zone: DeckZone;
  inferred: MetaDeckInference;
  mainCount: number;
}) {
  const landscape = zone === WellKnown.deckZone.BATTLEFIELD;
  const isChampion = zone === WellKnown.deckZone.CHAMPION;
  const unsure = isChampion && inferred.championUnsure;
  const [first = "", second] = cards.map((card) => inferredCardLabel(card));
  const title = second === undefined ? first : m.meta_inferred_either({ first, second });
  let explanation = m.meta_inferred_why_battlefield();
  if (isChampion) {
    explanation = unsure ? m.meta_inferred_why_champion_unsure() : m.meta_inferred_why_champion();
  }
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        render={
          <Pressable
            aria-label={m.meta_inferred_show_why({ name: title })}
            className="flex cursor-help items-center gap-1.5 rounded-md"
          />
        }
      >
        {cards.map((card, index) => (
          <span key={card.cardId} className="contents">
            {index > 0 && (
              <span className="text-muted-foreground text-sm">{m.meta_inferred_or()}</span>
            )}
            <InferredCardFrame
              card={card}
              landscape={landscape}
              caption={isChampion && !unsure ? m.meta_inferred_likely() : undefined}
              className={unsure ? "opacity-90" : undefined}
            />
          </span>
        ))}
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-96 max-w-[calc(100vw-2rem)]">
        <WhyPopoverBody
          title={title}
          explanation={explanation}
          neighbours={isChampion ? inferred.championNeighbours : inferred.battlefieldNeighbours}
          zone={zone}
          mainCount={mainCount}
        />
      </PopoverContent>
    </Popover>
  );
}

export function metaInferredZoneSlots(
  inferred: MetaDeckInference | null,
  mainCount: number,
): Map<DeckZone, InferredZoneSlots> {
  const slots = new Map<DeckZone, InferredZoneSlots>();
  if (inferred === null) {
    return slots;
  }
  const hint = <p className="text-muted-foreground text-sm">{m.meta_inferred_hint()}</p>;
  if (inferred.champions.length > 0) {
    let unsureNote: string | null = null;
    if (inferred.championUnsure) {
      unsureNote =
        inferred.champions.length > 1 ? m.meta_inferred_split() : m.meta_inferred_unsure_one();
    }
    slots.set(WellKnown.deckZone.CHAMPION, {
      count: 1,
      footer: (
        <div className="flex flex-col gap-0.5">
          {unsureNote !== null && <p className="text-sm">{unsureNote}</p>}
          {hint}
        </div>
      ),
      node: (
        <InferredSlot
          cards={inferred.champions}
          zone={WellKnown.deckZone.CHAMPION}
          inferred={inferred}
          mainCount={mainCount}
        />
      ),
    });
  }
  if (inferred.battlefield !== null) {
    slots.set(WellKnown.deckZone.BATTLEFIELD, {
      count: 1,
      footer: (
        <div className="flex flex-col gap-0.5">
          <AlsoSeen cards={inferred.alsoSeenBattlefields} />
          {hint}
        </div>
      ),
      node: (
        <InferredSlot
          cards={[inferred.battlefield]}
          zone={WellKnown.deckZone.BATTLEFIELD}
          inferred={inferred}
          mainCount={mainCount}
        />
      ),
    });
  }
  return slots;
}
