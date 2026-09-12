import { legendDisplayName } from "@openrift/shared/utils";
import { Suspense } from "react";

import { useCards } from "@/features/cards/hooks/use-cards";
import type { MetaIdentityProps } from "@/features/meta/components/meta-identity";
import { MetaIdentity } from "@/features/meta/components/meta-identity";
import { useHydrated } from "@/hooks/use-hydrated";

type Props = Pick<MetaIdentityProps, "layout" | "championOnly" | "className"> & {
  legendCardId: string | null;
  /** Server-provided name for the render before the catalog is in. */
  legendName?: string | null;
};

function CatalogLegend({ legendCardId, legendName, ...rest }: Props & { legendCardId: string }) {
  const { printingsByCardId } = useCards();
  const card = printingsByCardId.get(legendCardId)?.[0]?.card;
  if (card === undefined) {
    return <MetaIdentity name={legendName} {...rest} />;
  }
  return (
    <MetaIdentity
      name={legendDisplayName(card)}
      slug={card.slug}
      domains={card.domains}
      {...rest}
    />
  );
}

/** A player's Legend as the archive shows it: champion, title and domain runes, linked to the card. */
export function TournamentLegend({ legendCardId, legendName = null, ...rest }: Props) {
  const hydrated = useHydrated();
  if (legendCardId === null) {
    return <MetaIdentity name={legendName} {...rest} />;
  }
  if (!hydrated) {
    return <MetaIdentity name={legendName} {...rest} />;
  }
  return (
    <Suspense fallback={<MetaIdentity name={legendName} {...rest} />}>
      <CatalogLegend legendCardId={legendCardId} legendName={legendName} {...rest} />
    </Suspense>
  );
}
