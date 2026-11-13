import { ParaglideMessage } from "@inlang/paraglide-js-react";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { LayersIcon, ListIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CommandEmpty } from "@/components/ui/command";
import { PickerList, PickerRow } from "@/components/ui/picker-list";
import {
  ResponsivePopover,
  ResponsivePopoverContent,
  ResponsivePopoverTrigger,
} from "@/components/ui/responsive-popover";
import { Spinner } from "@/components/ui/spinner";
import { TextLink } from "@/components/ui/text-link";
import { useCards } from "@/features/cards/hooks/use-cards";
import { loadCollection } from "@/features/collections/lib/collection-load";
import { useDeckList } from "@/features/decks/hooks/use-decks";
import { deckCardsForDeck } from "@/features/decks/lib/deck-card-rows";
import { listDetailQueryOptions, listsQueryOptions } from "@/features/lists/lib/lists-queries";
import { deckPrintingIds, listPrintingIds } from "@/features/stage/lib/present-queue-sources";
import { useUserId } from "@/hooks/use-session";
import { useSignInSearch } from "@/hooks/use-sign-in-search";
import { listIntentLabel } from "@/lib/list-intent";
import { m } from "@/paraglide/messages.js";

export interface QueueSource {
  label: string;
  printingIds: string[];
}

function SourcePopover({
  label,
  icon,
  open,
  onOpenChange,
  searchPlaceholder,
  children,
}: {
  label: string;
  icon: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchPlaceholder: string;
  children: ReactNode;
}) {
  const [highlightedId, setHighlightedId] = useState("");

  return (
    <ResponsivePopover open={open} onOpenChange={onOpenChange}>
      <ResponsivePopoverTrigger
        render={
          <Button variant="outline" size="sm">
            {icon}
            {label}
          </Button>
        }
      />
      <ResponsivePopoverContent title={searchPlaceholder} hideTitle>
        <PickerList
          searchPlaceholder={searchPlaceholder}
          highlightedId={highlightedId}
          onHighlightChange={setHighlightedId}
        >
          {children}
        </PickerList>
      </ResponsivePopoverContent>
    </ResponsivePopover>
  );
}

function SourceRow({
  id,
  name,
  detail,
  busy,
  onSelect,
}: {
  id: string;
  name: string;
  detail?: string;
  busy: boolean;
  onSelect: () => void;
}) {
  return (
    <PickerRow value={id} keywords={[name]} onSelect={onSelect}>
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {busy ? (
        <Spinner className="text-muted-foreground" />
      ) : (
        detail !== undefined && (
          <span className="text-muted-foreground shrink-0 text-sm">{detail}</span>
        )
      )}
    </PickerRow>
  );
}

async function loadDeckCards(queryClient: QueryClient, userId: string, deckId: string) {
  try {
    const { getDeckCardsCollection } = await import("@/features/decks/lib/decks-collection");
    const collection = getDeckCardsCollection(queryClient, userId);
    await loadCollection(collection);
    return deckCardsForDeck(collection.toArray, deckId);
  } catch {
    toast.error(m.stage_queue_source_deck_error());
    return [];
  }
}

async function loadListEntries(queryClient: QueryClient, userId: string, listId: string) {
  try {
    const detail = await queryClient.query({
      ...listDetailQueryOptions(userId, listId),
      staleTime: "static",
    });
    return detail.entries;
  } catch {
    toast.error(m.stage_queue_source_list_error());
    return [];
  }
}

/** No "whole set" source: it would truncate the queue in catalog order. Use the browser filter instead. */
export function QueueSourcePicker({ onAdd }: { onAdd: (source: QueueSource) => void }) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const { printingsById, printingsByCardId } = useCards();
  const [openSource, setOpenSource] = useState<"deck" | "list" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const deckRows = useDeckList({ enabled: openSource === "deck" });
  const signIn = useSignInSearch();
  const lists = useQuery({
    ...listsQueryOptions(userId ?? ""),
    enabled: userId !== null && openSource === "list",
  });

  const pickDeck = async (deckId: string, name: string) => {
    setBusyId(deckId);
    const cards = await loadDeckCards(queryClient, userId ?? "", deckId);
    onAdd({ label: name, printingIds: deckPrintingIds(cards, printingsByCardId) });
    setBusyId(null);
    setOpenSource(null);
  };

  const pickList = async (listId: string, name: string) => {
    setBusyId(listId);
    const entries = await loadListEntries(queryClient, userId ?? "", listId);
    onAdd({ label: name, printingIds: listPrintingIds(entries, printingsByCardId, printingsById) });
    setBusyId(null);
    setOpenSource(null);
  };

  if (userId === null) {
    return (
      <p className="text-muted-foreground text-sm">
        <ParaglideMessage
          message={m.stage_queue_source_signin}
          markup={{
            link: ({ children }) => (
              <TextLink variant="muted" render={<Link rel="nofollow" {...signIn} />}>
                {children}
              </TextLink>
            ),
          }}
        />
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground text-sm">{m.stage_queue_fill_from()}</span>

      <SourcePopover
        label={m.stage_queue_source_list()}
        icon={<ListIcon className="size-4" />}
        open={openSource === "list"}
        onOpenChange={(open) => setOpenSource(open ? "list" : null)}
        searchPlaceholder={m.stage_queue_source_list_search()}
      >
        <CommandEmpty>
          {lists.isPending
            ? m.stage_queue_source_lists_loading()
            : m.stage_queue_source_lists_empty()}
        </CommandEmpty>
        {(lists.data ?? []).map((list) => (
          <SourceRow
            key={list.id}
            id={list.id}
            name={list.name}
            detail={listIntentLabel(list.intent)}
            busy={busyId === list.id}
            onSelect={() => void pickList(list.id, list.name)}
          />
        ))}
      </SourcePopover>

      <SourcePopover
        label={m.stage_queue_source_deck()}
        icon={<LayersIcon className="size-4" />}
        open={openSource === "deck"}
        onOpenChange={(open) => setOpenSource(open ? "deck" : null)}
        searchPlaceholder={m.stage_queue_source_deck_search()}
      >
        <CommandEmpty>
          {deckRows === undefined
            ? m.stage_queue_source_decks_loading()
            : m.stage_queue_source_decks_empty()}
        </CommandEmpty>
        {(deckRows ?? [])
          .filter((item) => item.deck.archivedAt === null)
          .map(({ deck }) => (
            <SourceRow
              key={deck.id}
              id={deck.id}
              name={deck.name}
              busy={busyId === deck.id}
              onSelect={() => void pickDeck(deck.id, deck.name)}
            />
          ))}
      </SourcePopover>
    </div>
  );
}
