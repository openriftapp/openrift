import type {
  ListEntryDetailResponse,
  ListIntent,
  ListKind,
} from "@openrift/shared/types/api/list";
import { FolderIcon, HandshakeIcon, HeartIcon } from "lucide-react";
import type { ComponentType, ReactNode, SVGProps } from "react";

import { PageTopBar, PageTopBarActions, PageTopBarTitle } from "@/components/layout/page-top-bar";
import { TopBarBreadcrumbSeparator } from "@/components/layout/top-bar-breadcrumb";
import { LIST_KIND_ICON } from "@/features/lists/components/create-list-dialog";
import { ListValueLabel } from "@/features/lists/components/list-value-label";
import { useHydrated } from "@/hooks/use-hydrated";
import { m } from "@/paraglide/messages.js";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const INTENT_LABEL: Record<ListIntent, () => string> = {
  wish: () => m.lists_intent_label_wish(),
  trade: () => m.lists_intent_label_trade(),
  organize: () => m.lists_intent_label_organize(),
};

const INTENT_ICON: Record<ListIntent, IconComponent> = {
  wish: HeartIcon,
  trade: HandshakeIcon,
  organize: FolderIcon,
};

const KIND_NOUN: Record<ListKind, { singular: string; plural: string }> = {
  card: { singular: "Card", plural: "Cards" },
  printing: { singular: "Printing", plural: "Printings" },
  copy: { singular: "Copy", plural: "Copies" },
};

interface ListSummary {
  id: string;
  name: string;
  intent: ListIntent;
  kind: ListKind;
}

type ListHeaderAttribution = { kind: "owner"; ownerName: string | null } | { kind: "none" };

interface ListHeaderProps {
  list: ListSummary;
  entries: readonly ListEntryDetailResponse[];
  attribution: ListHeaderAttribution;
  backLink?: ReactNode;
  onToggleSidebar?: () => void;
  actions?: ReactNode;
}

// Slot order, left to right:
// backLink -> (menu) title -> intent badge -> "N Kind" badge -> value/attribution -> actions
export function ListHeader({
  list,
  entries,
  attribution,
  backLink,
  onToggleSidebar,
  actions,
}: ListHeaderProps) {
  const hydrated = useHydrated();
  const IntentIcon = INTENT_ICON[list.intent];
  const KindIcon = LIST_KIND_ICON[list.kind];
  const count = entries.length;
  const kindNoun = count === 1 ? KIND_NOUN[list.kind].singular : KIND_NOUN[list.kind].plural;

  return (
    <PageTopBar>
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:items-baseline">
        {backLink}
        {backLink ? <TopBarBreadcrumbSeparator className="hidden sm:inline" /> : null}
        <PageTopBarTitle onToggleSidebar={onToggleSidebar}>{list.name}</PageTopBarTitle>
        <span className="text-muted-foreground hidden shrink-0 items-baseline gap-1 text-xs sm:inline-flex">
          <IntentIcon className="size-3 self-center" />
          <span>{INTENT_LABEL[list.intent]()}</span>
        </span>
        <span className="text-muted-foreground hidden shrink-0 items-baseline gap-1 text-xs sm:inline-flex">
          <KindIcon className="size-3 self-center" />
          <span>
            {count} {kindNoun}
          </span>
        </span>
        {hydrated && count > 0 && <ListValueLabel kind={list.kind} entries={entries} />}
        {attribution.kind === "owner" && attribution.ownerName ? (
          <span className="text-muted-foreground hidden shrink-0 text-xs sm:inline">
            · by {attribution.ownerName}
          </span>
        ) : null}
      </div>
      {actions ? <PageTopBarActions>{actions}</PageTopBarActions> : null}
    </PageTopBar>
  );
}
