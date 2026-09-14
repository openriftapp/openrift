import type { ListIntent, ListKind, ListResponse } from "@openrift/shared/types/api/list";
import { ListIcon } from "lucide-react";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import { CommandEmpty, CommandGroup } from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { PickerList, PickerRow } from "@/components/ui/picker-list";
import { ConnectedMoveEntryDialogBody } from "@/features/lists/components/move-entry-dialog";
import type { MoveEntrySubject, MoveMode, MoveResolution } from "@/features/lists/lib/list-move";
import { moveNeedsDialog, movePickFor } from "@/features/lists/lib/list-move";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const INTENT_ORDER: ListIntent[] = ["wish", "trade", "organize"];

function intentHeading(intent: ListIntent): string {
  switch (intent) {
    case "wish": {
      return m.collections_sidebar_wishlists();
    }
    case "trade": {
      return m.collections_sidebar_tradelists();
    }
    case "organize": {
      return m.collections_sidebar_organize_lists();
    }
  }
}

export function listKindLabel(kind: ListKind): string {
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

interface MoveToListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: MoveMode;
  /** Every list except the source; the dialog groups and gates them itself. */
  lists: ListResponse[];
  source: { kind: ListKind; intent: ListIntent };
  /** The single entry being moved, or null for a multi-entry action. */
  subject: MoveEntrySubject | null;
  onConfirm: (toList: ListResponse, resolution: MoveResolution | null) => void;
  isPending: boolean;
}

/**
 * Step one picks the target list; a wider kind or a changed intent adds the
 * confirmation and pick step from `MoveEntryDialogBody`.
 */
export function MoveToListDialog({
  open,
  onOpenChange,
  mode,
  lists,
  source,
  subject,
  onConfirm,
  isPending,
}: MoveToListDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState("");
  const [target, setTarget] = useState<ListResponse | null>(null);
  const [seedOpen, setSeedOpen] = useState(open);
  if (seedOpen !== open) {
    setSeedOpen(open);
    if (open) {
      setSelectedId(null);
      setHighlightedId("");
      setTarget(null);
    }
  }

  const isCopy = mode === "copy";
  const needsSingle = (list: ListResponse) =>
    subject === null && movePickFor(source.kind, list.kind) !== "none";
  const byIntent = Map.groupBy(lists, (list) => list.intent);

  const proceed = () => {
    const list = lists.find((candidate) => candidate.id === selectedId);
    if (!list || needsSingle(list)) {
      return;
    }
    if (moveNeedsDialog(source, list)) {
      setTarget(list);
      return;
    }
    onConfirm(list, null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {target && subject ? (
          <Suspense fallback={null}>
            <ConnectedMoveEntryDialogBody
              key={target.id}
              mode={mode}
              subject={subject}
              target={{
                listName: target.name,
                listKind: target.kind,
                listIntent: target.intent,
              }}
              onConfirm={(resolution) => onConfirm(target, resolution)}
              onCancel={() => setTarget(null)}
              isPending={isPending}
            />
          </Suspense>
        ) : (
          <DialogForm onSubmit={proceed}>
            <DialogHeader>
              <DialogTitle>
                {isCopy ? m.lists_entry_copy_title() : m.lists_entry_move_title()}
              </DialogTitle>
              <DialogDescription>
                {isCopy ? m.lists_entry_copy_description() : m.lists_entry_move_description()}
              </DialogDescription>
            </DialogHeader>
            {/* Do not add overflow here: CommandList scrolls internally. */}
            <div>
              {lists.length === 0 ? (
                <Empty>
                  <EmptyDescription>{m.lists_entry_move_none()}</EmptyDescription>
                </Empty>
              ) : (
                <PickerList
                  searchPlaceholder={m.lists_entry_move_filter_placeholder()}
                  highlightedId={highlightedId}
                  onHighlightChange={setHighlightedId}
                >
                  <CommandEmpty>{m.lists_entry_move_no_match()}</CommandEmpty>
                  {INTENT_ORDER.map((intent) => {
                    const group = byIntent.get(intent);
                    if (!group || group.length === 0) {
                      return null;
                    }
                    return (
                      <CommandGroup key={intent} heading={intentHeading(intent)}>
                        {group.map((list) => {
                          const gated = needsSingle(list);
                          return (
                            <PickerRow
                              key={list.id}
                              value={list.id}
                              keywords={[list.name]}
                              onSelect={gated ? undefined : () => setSelectedId(list.id)}
                              className={cn(
                                "px-3 py-2",
                                gated && "opacity-50",
                                selectedId === list.id &&
                                  "bg-primary/10 text-primary data-selected:bg-primary/10 data-selected:text-primary data-selected:**:text-primary",
                              )}
                            >
                              <ListIcon className="size-4 shrink-0" />
                              <span className="flex-1 truncate">{list.name}</span>
                              <span className="text-muted-foreground text-2xs shrink-0">
                                {listKindLabel(list.kind)}
                              </span>
                            </PickerRow>
                          );
                        })}
                      </CommandGroup>
                    );
                  })}
                </PickerList>
              )}
            </div>
            {subject === null && lists.some((list) => needsSingle(list)) && (
              <p className="text-muted-foreground text-sm">{m.lists_entry_move_needs_single()}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
                {m.common_cancel()}
              </Button>
              <Button type="submit" disabled={!selectedId || isPending}>
                {isPending
                  ? isCopy
                    ? m.lists_copy_pending()
                    : m.lists_entry_move_pending()
                  : isCopy
                    ? m.lists_copy_confirm()
                    : m.lists_entry_move_confirm()}
              </Button>
            </div>
          </DialogForm>
        )}
      </DialogContent>
    </Dialog>
  );
}
