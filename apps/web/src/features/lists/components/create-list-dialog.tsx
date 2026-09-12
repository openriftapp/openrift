import type { ListIntent, ListKind, ListResponse } from "@openrift/shared/types/api/list";
import type { Currency, TradePreference } from "@openrift/shared/types/api/trade-preferences";
import { ChevronDownIcon, CopyIcon, SquareIcon, SquareStackIcon } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { TradePreferenceEditor } from "@/features/groups/components/trade-preference-editor";
import { useShareListWithFriendGroup } from "@/features/groups/hooks/use-friend-group-sharing";
import { useFriendGroupsList } from "@/features/groups/hooks/use-friend-groups";
import { useBulkAddListEntries, useCreateList } from "@/features/lists/hooks/use-lists";
import type { InitialEntry } from "@/features/lists/lib/list-initial-entry";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

const EMPTY_TRADE_PREFERENCE: TradePreference = {
  pricePref: null,
  priceAbsoluteCents: null,
  tradeType: null,
};

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

interface KindOption {
  kind: ListKind;
  icon: IconComponent;
}

const KIND_OPTIONS: Record<ListKind, KindOption> = {
  card: {
    kind: "card",
    icon: SquareIcon,
  },
  printing: {
    kind: "printing",
    icon: CopyIcon,
  },
  copy: {
    kind: "copy",
    icon: SquareStackIcon,
  },
};

function kindLabel(kind: ListKind): string {
  switch (kind) {
    case "card": {
      return m.lists_create_kind_cards();
    }
    case "printing": {
      return m.lists_create_kind_printings();
    }
    case "copy": {
      return m.lists_create_kind_copies();
    }
  }
}

function kindHint(intent: ListIntent, kind: ListKind): string {
  const hints: Record<ListIntent, Record<ListKind, string>> = {
    wish: {
      card: m.lists_create_hint_wish_card(),
      printing: m.lists_create_hint_wish_printing(),
      copy: m.lists_create_hint_wish_copy(),
    },
    trade: {
      card: m.lists_create_hint_trade_card(),
      printing: m.lists_create_hint_trade_printing(),
      copy: m.lists_create_hint_trade_copy(),
    },
    organize: {
      card: m.lists_create_hint_organize_card(),
      printing: m.lists_create_hint_organize_printing(),
      copy: m.lists_create_hint_organize_copy(),
    },
  };
  return hints[intent][kind];
}

const KINDS_BY_INTENT: Record<ListIntent, ListKind[]> = {
  wish: ["card", "printing"],
  trade: ["copy"],
  organize: ["card", "printing", "copy"],
};

function intentTitle(intent: ListIntent): string {
  switch (intent) {
    case "wish": {
      return m.lists_create_title_wish();
    }
    case "trade": {
      return m.lists_create_title_trade();
    }
    case "organize": {
      return m.lists_create_title_organize();
    }
  }
}

interface CreateListDialogProps {
  intent: ListIntent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (listId: string) => void;
  defaultName?: string;
  initialEntries?: (kind: ListKind) => InitialEntry[];
  title?: string;
  description?: string;
  kindHints?: Partial<Record<ListKind, string>>;
}

/** Picks the list's `kind` (when the intent allows more than one) and its name. */
export function CreateListDialog({
  intent,
  open,
  onOpenChange,
  onCreated,
  defaultName,
  initialEntries,
  title,
  description,
  kindHints,
}: CreateListDialogProps) {
  const availableKinds = KINDS_BY_INTENT[intent];
  const [kind, setKind] = useState<ListKind>(availableKinds[0] ?? "card");
  const [name, setName] = useState(defaultName ?? "");
  const defaultCurrency = useDisplayStore((s) => s.defaultCurrency);
  const [tradeDefaults, setTradeDefaults] = useState<TradePreference>(EMPTY_TRADE_PREFERENCE);
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [tradePrefsOpen, setTradePrefsOpen] = useState(false);
  const createList = useCreateList();
  const bulkAdd = useBulkAddListEntries();
  const shareWithGroup = useShareListWithFriendGroup();
  // Non-suspending: fetching groups never blocks the rest of the dialog from rendering.
  const groups = useFriendGroupsList(open).data?.items ?? [];

  const supportsPrefs = intent !== "organize";
  const absoluteNeedsAmount =
    tradeDefaults.pricePref === "absolute" && tradeDefaults.priceAbsoluteCents === null;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setName(defaultName ?? "");
      setKind(availableKinds[0] ?? "card");
      setTradeDefaults(EMPTY_TRADE_PREFERENCE);
      setCurrency(defaultCurrency);
      setSelectedGroupIds(new Set());
      setTradePrefsOpen(false);
    }
    onOpenChange(next);
  };

  const finishCreate = async (list: ListResponse) => {
    const entries = initialEntries?.(kind) ?? [];
    if (entries.length > 0) {
      try {
        await bulkAdd.mutateAsync({ listId: list.id, entries });
      } catch {
        /* Reported by the global mutation error toast. */
        return;
      }
    }
    // allSettled: one group's share failing shouldn't block the others or the create.
    const selectedGroups = groups.filter((group) => selectedGroupIds.has(group.id));
    await Promise.allSettled(
      selectedGroups.map((group) =>
        shareWithGroup.mutateAsync({ slug: group.slug, listId: list.id }),
      ),
    );
    onCreated?.(list.id);
    handleOpenChange(false);
  };

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (
      !trimmed ||
      createList.isPending ||
      bulkAdd.isPending ||
      shareWithGroup.isPending ||
      absoluteNeedsAmount
    ) {
      return;
    }
    createList.mutate(
      {
        name: trimmed,
        intent,
        kind,
        // Currency is saved even when unused: a later fixed-price override needs a unit.
        ...(supportsPrefs && { tradeDefaults, currency }),
      },
      { onSuccess: (list) => void finishCreate(list) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title ?? intentTitle(intent)}</DialogTitle>
          <DialogDescription>
            {description ??
              (availableKinds.length === 1
                ? m.lists_create_description_single()
                : m.lists_create_description_multi())}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <Input
            autoFocus // oxlint-disable-line jsx-a11y/no-autofocus -- intentional inside dialog
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={m.lists_create_name_placeholder()}
          />
          {availableKinds.length > 1 && (
            <div className="flex flex-col gap-1">
              {availableKinds.map((option) => {
                const meta = KIND_OPTIONS[option];
                const Icon = meta.icon;
                const isSelected = kind === option;
                return (
                  <Pressable
                    key={option}
                    className={cn(
                      "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted border-transparent",
                    )}
                    onClick={() => setKind(option)}
                  >
                    <Icon className="mt-0.5 size-4 shrink-0" />
                    <div className="flex-1">
                      <div className="font-medium">{kindLabel(meta.kind)}</div>
                      <div className="text-muted-foreground text-xs">
                        {kindHints?.[option] ?? kindHint(intent, option)}
                      </div>
                    </div>
                  </Pressable>
                );
              })}
            </div>
          )}
          {groups.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {m.lists_create_group_visibility()}
              </div>
              <div className="text-muted-foreground text-xs">
                {intent === "organize"
                  ? m.lists_create_group_hint_organize()
                  : m.lists_create_group_hint_trade()}
              </div>
              <ul className="flex flex-col gap-2">
                {groups.map((group) => {
                  const checkboxId = `create-list-group-${group.id}`;
                  const isSelected = selectedGroupIds.has(group.id);
                  return (
                    <li key={group.id} className="flex items-center gap-2">
                      <Checkbox
                        id={checkboxId}
                        checked={isSelected}
                        disabled={createList.isPending || bulkAdd.isPending}
                        onCheckedChange={(checked) => {
                          setSelectedGroupIds((prev) => {
                            const next = new Set(prev);
                            if (checked === false) {
                              next.delete(group.id);
                            } else {
                              next.add(group.id);
                            }
                            return next;
                          });
                        }}
                      />
                      <label htmlFor={checkboxId} className="cursor-pointer text-sm">
                        {group.name}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {supportsPrefs && (
            <Collapsible open={tradePrefsOpen} onOpenChange={setTradePrefsOpen}>
              <CollapsibleTrigger
                type="button"
                className="text-muted-foreground hover:text-foreground flex w-full cursor-pointer items-center gap-1.5 text-xs font-medium tracking-wide uppercase"
              >
                <ChevronDownIcon
                  className={cn(
                    "size-3.5 shrink-0 transition-transform",
                    tradePrefsOpen && "rotate-180",
                  )}
                />
                {m.lists_create_trade_preferences()}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="flex flex-col gap-2 pt-2">
                  <div className="text-muted-foreground text-xs">
                    {m.lists_create_trade_defaults_hint()}
                  </div>
                  <TradePreferenceEditor
                    value={tradeDefaults}
                    onChange={setTradeDefaults}
                    currency={currency}
                    showCurrency
                    onCurrencyChange={setCurrency}
                    idPrefix="create-list"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={createList.isPending || bulkAdd.isPending || shareWithGroup.isPending}
            >
              {m.common_cancel()}
            </Button>
            <Button
              type="submit"
              disabled={
                !name.trim() ||
                createList.isPending ||
                bulkAdd.isPending ||
                shareWithGroup.isPending ||
                absoluteNeedsAmount
              }
            >
              {m.common_create()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// A record, not a lookup function: the React Compiler can't prove a function
// returns a stable component and would treat the result as created during render.
export const LIST_KIND_ICON: Record<ListKind, IconComponent> = {
  card: KIND_OPTIONS.card.icon,
  printing: KIND_OPTIONS.printing.icon,
  copy: KIND_OPTIONS.copy.icon,
};
