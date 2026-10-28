import type { Card, Printing } from "@openrift/shared/types/catalog";
import { Link } from "@tanstack/react-router";
import { ChevronDownIcon, ExternalLinkIcon, PencilLineIcon, ShieldIcon } from "lucide-react";

import { useIsAdmin } from "@/features/admin/hooks/use-admin";
import { SuggestCorrectionMenu } from "@/features/cards/components/suggest-correction-menu";
import { m } from "@/paraglide/messages.js";

/**
 * Escape hatches out of the overlay: the card's own page, the correction and
 * image forms, and the admin view for admins. Not rendered on the standalone
 * card page, which already carries its own top-bar links.
 */
export function CardDetailLinks({ card, printing }: { card: Card; printing?: Printing }) {
  const { data: isAdmin } = useIsAdmin();

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <Link
        to="/cards/$cardSlug/{-$printingSlug}"
        params={{ cardSlug: card.slug }}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
      >
        <ExternalLinkIcon className="size-3" />
        {m.card_detail_link_open_card_page()}
      </Link>
      <SuggestCorrectionMenu
        cardSlug={card.slug}
        printing={printing}
        triggerClassName="text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center gap-1 text-xs"
      >
        <PencilLineIcon className="size-3" />
        {m.card_detail_link_suggest_correction()}
        <ChevronDownIcon className="size-3" />
      </SuggestCorrectionMenu>
      {isAdmin && (
        <Link
          to="/admin/cards/$cardSlug"
          params={{ cardSlug: card.slug }}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          <ShieldIcon className="size-3" />
          {m.card_detail_link_admin_view()}
        </Link>
      )}
    </div>
  );
}
