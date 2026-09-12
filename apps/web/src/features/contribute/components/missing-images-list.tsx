import type { MissingImagePrinting } from "@openrift/shared/contracts/card-submissions";
import { enumLabel } from "@openrift/shared/enum-label";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { CountPill } from "@/components/ui/count-pill";
import { ExpandToggle } from "@/components/ui/expand-toggle";
import { RowList, RowListItem, RowListLink } from "@/components/ui/row-list";
import { useEnumOrders, useLanguageLabels } from "@/hooks/use-enums";
import { m } from "@/paraglide/messages.js";

const VISIBLE_LIMIT = 10;

interface MissingImagesListProps {
  items: readonly MissingImagePrinting[];
}

export function MissingImagesList({ items }: MissingImagesListProps) {
  const { labels } = useEnumOrders();
  const languageLabels = useLanguageLabels();
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? items : items.slice(0, VISIBLE_LIMIT);

  return (
    <div className="flex flex-col gap-3">
      <RowList>
        {visible.map((item) => (
          <RowListItem key={item.printingId}>
            <RowListLink
              render={
                <Link
                  to="/contribute/card/$cardSlug/printing/$printingId/image"
                  params={{ cardSlug: item.cardSlug, printingId: item.printingId }}
                />
              }
              className="justify-between"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{item.cardName}</span>
                <span className="text-muted-foreground truncate text-sm">
                  {item.setName} · {item.publicCode} · {enumLabel(labels.finishes, item.finish)} ·{" "}
                  {enumLabel(languageLabels, item.language)}
                </span>
              </span>
              <CountPill title={m.contribute_missing_copies_title({ count: item.copies })}>
                {item.copies}
              </CountPill>
            </RowListLink>
          </RowListItem>
        ))}
      </RowList>
      {items.length > VISIBLE_LIMIT && (
        <ExpandToggle
          expanded={showAll}
          chevronPosition="end"
          onClick={() => setShowAll(!showAll)}
          className="text-muted-foreground hover:text-foreground self-start text-sm"
        >
          {showAll ? m.contribute_show_fewer() : m.contribute_show_all({ count: items.length })}
        </ExpandToggle>
      )}
    </div>
  );
}
