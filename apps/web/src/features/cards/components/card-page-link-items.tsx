import type { Printing } from "@openrift/shared/types/catalog";
import { useRouter } from "@tanstack/react-router";
import { AppWindowIcon, LinkIcon } from "lucide-react";
import { toast } from "sonner";

import { CardMenuItem } from "@/features/cards/components/card-context-menu";
import { cardPageHref } from "@/features/cards/lib/card-page-href";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { getSiteUrl } from "@/lib/site-config";
import { m } from "@/paraglide/messages.js";

export function CardPageLinkItems({ printing }: { printing: Printing }) {
  const router = useRouter();
  const { copy } = useCopyToClipboard();
  const href = cardPageHref(router, printing);

  const copyLink = async () => {
    if (await copy(`${getSiteUrl()}${href}`)) {
      toast.success(m.cards_context_link_copied());
      return;
    }
    toast.error(m.common_copy_link_error());
  };

  return (
    <>
      <CardMenuItem
        icon={AppWindowIcon}
        render={
          // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- text label is inside the CardMenuItem children
          <a href={href} target="_blank" rel="noreferrer" />
        }
      >
        {m.cards_context_open_in_new_tab()}
      </CardMenuItem>
      <CardMenuItem icon={LinkIcon} onSelect={() => void copyLink()}>
        {m.cards_context_copy_link()}
      </CardMenuItem>
    </>
  );
}
