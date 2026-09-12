import type { CardDetailRelatedCard } from "@openrift/shared/types/api/catalog";
import { getOrientation } from "@openrift/shared/utils";
import { Link } from "@tanstack/react-router";

import { Heading } from "@/components/heading";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import { m } from "@/paraglide/messages.js";

export function RelatedCardsSection({ related }: { related: CardDetailRelatedCard[] }) {
  if (related.length === 0) {
    return null;
  }
  return (
    <section className="flex flex-col gap-4">
      <Heading level={2}>{m.card_detail_related_title()}</Heading>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {related.map((relatedCard) => (
          <Link
            key={relatedCard.slug}
            to="/cards/$cardSlug/{-$printingSlug}"
            params={{ cardSlug: relatedCard.slug }}
            className="group flex flex-col gap-1.5"
          >
            <CardArtThumb
              imageId={relatedCard.imageId}
              variant="240w"
              alt=""
              rarity={relatedCard.rarity}
              domains={relatedCard.domains}
              landscape={getOrientation(relatedCard.types) === "landscape"}
              loading="lazy"
              className="w-full transition-transform group-hover:scale-[1.02]"
            />
            <span className="group-hover:text-primary truncate text-sm transition-colors">
              {relatedCard.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
