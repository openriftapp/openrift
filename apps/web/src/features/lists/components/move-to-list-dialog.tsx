import type { ListIntent, ListKind, ListResponse } from "@openrift/shared/types/api/list";
import { ListIcon } from "lucide-react";
import { Suspense, useState } from "react";

import { PickerDialogBody } from "@/components/picker-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConnectedMoveEntryDialogBody } from "@/features/lists/components/move-entry-dialog";
import type { MoveEntrySubject, MoveMode, MoveResolution } from "@/features/lists/lib/list-move";
import { hasTwoCards, moveNeedsDialog, movePickFor } from "@/features/lists/lib/list-move";
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
  selectionHasTwoCards?: boolean;
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
  selectionHasTwoCards = false,
  onConfirm,
  isPending,
}: MoveToListDialogProps) {
  const [target, setTarget] = useState<ListResponse | null>(null);
  const [session, setSession] = useState({ open, count: 0 });
  if (session.open !== open) {
    setSession({ open, count: open ? session.count + 1 : session.count });
    if (open) {
      setTarget(null);
    }
  }

  const isCopy = mode === "copy";
  const needsSingle = (list: ListResponse) =>
    subject === null && movePickFor(source.kind, list.kind, selectionHasTwoCards) !== "none";

  const proceed = (listId: string) => {
    const list = lists.find((candidate) => candidate.id === listId);
    if (!list || needsSingle(list)) {
      return;
    }
    if (moveNeedsDialog(source, list, hasTwoCards(subject?.printing))) {
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
          <PickerDialogBody
            key={session.count}
            title={isCopy ? m.lists_entry_copy_title() : m.lists_entry_move_title()}
            description={
              isCopy ? m.lists_entry_copy_description() : m.lists_entry_move_description()
            }
            options={lists.map((list) => ({
              value: list.id,
              label: list.name,
              keywords: [list.name],
              icon: <ListIcon className="size-4 shrink-0" />,
              meta: listKindLabel(list.kind),
              group: list.intent,
              disabled: needsSingle(list),
            }))}
            groups={INTENT_ORDER.map((intent) => ({ key: intent, label: intentHeading(intent) }))}
            searchPlaceholder={m.lists_entry_move_filter_placeholder()}
            noMatchesText={m.lists_entry_move_no_match()}
            emptyText={m.lists_entry_move_none()}
            after={
              subject === null &&
              lists.some((list) => needsSingle(list)) && (
                <p className="text-muted-foreground text-sm">{m.lists_entry_move_needs_single()}</p>
              )
            }
            pending={isPending}
            confirm={{
              label: isCopy ? m.common_copy() : m.lists_entry_move_confirm(),
              pendingLabel: isCopy ? m.lists_copy_pending() : m.lists_entry_move_pending(),
              onConfirm: proceed,
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
