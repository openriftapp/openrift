import type { ListIntent } from "@openrift/shared/types/api/list";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { LayersIcon, ListIcon, Loader2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CommandEmpty } from "@/components/ui/command";
import { PickerList, PickerRow } from "@/components/ui/picker-list";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCards } from "@/features/cards/hooks/use-cards";
import { deckDetailQueryOptions, decksQueryOptions } from "@/features/decks/hooks/use-decks";
import { listDetailQueryOptions, listsQueryOptions } from "@/features/lists/hooks/use-lists";
import { deckPrintingIds, listPrintingIds } from "@/features/stage/lib/present-queue-sources";
import { useUserId } from "@/lib/auth-session";
import { m } from "@/paraglide/messages.js";

function intentLabel(intent: ListIntent): string {
  switch (intent) {
    case "wish": {
      return m.lists_intent_label_wish();
    }
    case "trade": {
      return m.lists_intent_label_trade();
    }
    default: {
      return m.lists_intent_label_organize();
    }
  }
}

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
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            {icon}
            {label}
          </Button>
        }
      />
      <PopoverContent align="start" className="w-80 p-0">
        <PickerList
          searchPlaceholder={searchPlaceholder}
          highlightedId={highlightedId}
          onHighlightChange={setHighlightedId}
        >
          {children}
        </PickerList>
      </PopoverContent>
    </Popover>
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
        <Loader2Icon className="text-muted-foreground size-4 animate-spin" />
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
    const detail = await queryClient.query({
      ...deckDetailQueryOptions(userId, deckId),
      staleTime: "static",
    });
    return detail.cards;
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

  const decks = useQuery({
    ...decksQueryOptions(userId ?? ""),
    enabled: userId !== null && openSource === "deck",
  });
  const lists = useQuery({
    ...listsQueryOptions(userId ?? ""),
    enabled: userId !== null && openSource === "list",
  });

  const pickDeck = async (deckId: string, name: string) => {
    setBusyId(deckId);
    const cards = await loadDeckCards(queryClient, userId ?? "", deckId);
    onAdd({ label: name, printingIds: deckPrintingIds(cards, printingsByCardId, printingsById) });
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
        <Link
          to="/login"
          search={{ redirect: "/stage", email: undefined }}
          className="underline underline-offset-2"
        >
          {m.common_sign_in()}
        </Link>{" "}
        {m.stage_queue_source_signin_suffix()}
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
            detail={intentLabel(list.intent)}
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
          {decks.isPending
            ? m.stage_queue_source_decks_loading()
            : m.stage_queue_source_decks_empty()}
        </CommandEmpty>
        {(decks.data ?? [])
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
