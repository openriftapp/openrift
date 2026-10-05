import { legendNameParts } from "@openrift/shared/card-name";
import { Suspense } from "react";

import { useCards } from "@/features/cards/hooks/use-cards";
import type {
  MetaIdentityLegend,
  MetaIdentityProps,
} from "@/features/meta/components/meta-identity";
import { MetaIdentity } from "@/features/meta/components/meta-identity";
import { useHydrated } from "@/hooks/use-hydrated";

interface ServerLegendName {
  legendCharacter: string | null;
  legendEpithet: string | null;
}

type Props = Pick<MetaIdentityProps, "layout" | "championOnly" | "className"> & {
  legendCardId: string | null;
  /** Server-provided name for the render before the catalog is in. */
  fallback?: ServerLegendName | null;
};

function fallbackLegend(fallback: ServerLegendName | null | undefined): MetaIdentityLegend | null {
  return fallback ? { character: fallback.legendCharacter, epithet: fallback.legendEpithet } : null;
}

function CatalogLegend({ legendCardId, fallback, ...rest }: Props & { legendCardId: string }) {
  const { printingsByCardId } = useCards();
  const card = printingsByCardId.get(legendCardId)?.[0]?.card;
  if (card === undefined) {
    return <MetaIdentity legend={fallbackLegend(fallback)} {...rest} />;
  }
  return (
    <MetaIdentity
      legend={legendNameParts(card)}
      slug={card.slug}
      domains={card.domains}
      {...rest}
    />
  );
}

/** A player's Legend as the archive shows it: champion, title and domain runes, linked to the card. */
export function TournamentLegend({ legendCardId, fallback, ...rest }: Props) {
  const hydrated = useHydrated();
  if (legendCardId === null || !hydrated) {
    return <MetaIdentity legend={fallbackLegend(fallback)} {...rest} />;
  }
  return (
    <Suspense fallback={<MetaIdentity legend={fallbackLegend(fallback)} {...rest} />}>
      <CatalogLegend legendCardId={legendCardId} fallback={fallback} {...rest} />
    </Suspense>
  );
}
