import type { Printing } from "@openrift/shared/types/catalog";
import { Link } from "@tanstack/react-router";
import { ImageOffIcon } from "lucide-react";

import { m } from "@/paraglide/messages.js";

export function SuggestImageNotice({ printing }: { printing: Printing }) {
  if (printing.images.length > 0) {
    return null;
  }
  return (
    <div className="@container pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <Link
        to="/contribute/card/$cardSlug/printing/$printingId/image"
        params={{ cardSlug: printing.card.slug, printingId: printing.id }}
        title={m.card_detail_suggest_image_title()}
        className="bg-background/90 hover:bg-primary group/notice pointer-events-auto flex flex-col items-center rounded-[2cqi] px-[5cqi] py-[2cqi] text-center shadow-md transition-colors"
      >
        <span className="text-foreground/90 group-hover/notice:text-primary-foreground flex items-center gap-[1.5cqi] text-[6cqi] font-medium">
          <ImageOffIcon aria-hidden="true" className="size-[6cqi]" />
          {m.card_detail_suggest_image_placeholder()}
        </span>
        <span className="text-primary group-hover/notice:text-primary-foreground text-[5.5cqi] font-medium">
          {m.card_detail_suggest_image_cta()}
        </span>
      </Link>
    </div>
  );
}
