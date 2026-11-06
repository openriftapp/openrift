import type { ListIntent } from "@openrift/shared/types/api/list";
import { FolderIcon, HandshakeIcon, HeartIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PickerDialog } from "@/components/picker-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { QuantityStepperField } from "@/components/ui/quantity-stepper";
import { listKindLabel } from "@/features/lists/components/move-to-list-dialog";
import { useBulkAddCopiesToList, useCreateList, useLists } from "@/features/lists/hooks/use-lists";
import { describeListAdd } from "@/features/lists/lib/list-toast";
import { m } from "@/paraglide/messages.js";

const MAX_BULK_ADD = 500;

function IntentIcon({ intent }: { intent: ListIntent }) {
  const Icon = intent === "trade" ? HandshakeIcon : intent === "wish" ? HeartIcon : FolderIcon;
  return <Icon className="size-4 shrink-0" />;
}

function intentLabel(intent: ListIntent): string {
  return intent === "trade"
    ? m.lists_add_intent_trade()
    : intent === "wish"
      ? m.lists_add_intent_wish()
      : m.lists_add_intent_organize();
}

interface AddToListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  copyIds: string[];
  groupOwnedOnly?: boolean;
  singleCard?: boolean;
  onAdded?: () => void;
}

/** Adds selected copies to any list (the server derives the entry shape); a list can be created inline. */
export function AddToListDialog({
  open,
  onOpenChange,
  copyIds,
  groupOwnedOnly = false,
  singleCard = false,
  onAdded,
}: AddToListDialogProps) {
  const { data: allLists } = useLists();
  const bulkAdd = useBulkAddCopiesToList();
  const createList = useCreateList();

  // Group-owned copies aren't the user's to trade away or wish for, so only
  // organize lists remain for them (mirrors the server's personalOnly rule).
  const eligibleLists = allLists.filter((list) => !groupOwnedOnly || list.intent === "organize");

  const count = copyIds.length;

  const canChooseQuantity = singleCard && count > 1;
  const [quantity, setQuantity] = useState(count);
  const [seed, setSeed] = useState({ open, count });
  if (seed.open !== open || seed.count !== count) {
    setSeed({ open, count });
    if (open) {
      setQuantity(count);
    }
  }
  const effectiveQuantity = canChooseQuantity ? quantity : count;
  const exceedsLimit = effectiveQuantity > MAX_BULK_ADD;

  const addToList = (listId: string, listName: string) => {
    bulkAdd.mutate(
      { listId, copyIds: copyIds.slice(0, effectiveQuantity) },
      {
        onSuccess: (result) => {
          toast[result.added + result.updated === 0 ? "info" : "success"](
            describeListAdd(result, listName),
          );
          onAdded?.();
          onOpenChange(false);
        },
      },
    );
  };

  const createAndAdd = (intent: string, name: string, done: () => void) => {
    if (intent !== "trade" && intent !== "organize") {
      return;
    }
    createList.mutate(
      { name, intent, kind: "copy" },
      {
        onSuccess: (newList) => {
          addToList(newList.id, newList.name);
          done();
        },
      },
    );
  };

  const isPending = bulkAdd.isPending || createList.isPending;
  const disableAdd = isPending || exceedsLimit;

  return (
    <PickerDialog
      open={open}
      onOpenChange={onOpenChange}
      title={m.lists_add_title()}
      before={
        <>
          {canChooseQuantity && (
            <QuantityStepperField
              label={m.lists_add_copies_label()}
              value={quantity}
              onValueChange={setQuantity}
              max={count}
              disabled={isPending}
            />
          )}
          {exceedsLimit && (
            <Alert variant="destructive">
              <AlertDescription>
                {m.lists_add_limit({ max: MAX_BULK_ADD, count: count - MAX_BULK_ADD })}
              </AlertDescription>
            </Alert>
          )}
        </>
      }
      options={eligibleLists.map((list) => ({
        value: list.id,
        label: list.name,
        icon: <IntentIcon intent={list.intent} />,
        meta: `${intentLabel(list.intent)} · ${listKindLabel(list.kind)}`,
      }))}
      emptyText={m.lists_add_no_lists()}
      pending={isPending}
      disabled={exceedsLimit}
      after={
        groupOwnedOnly && (
          <p className="text-muted-foreground text-sm">{m.lists_add_group_owned_note()}</p>
        )
      }
      onPick={(listId) => {
        const list = eligibleLists.find((candidate) => candidate.id === listId);
        if (list) {
          addToList(list.id, list.name);
        }
      }}
      create={{
        actions: [
          ...(groupOwnedOnly
            ? []
            : [
                {
                  key: "trade",
                  label: m.lists_add_new_tradelist(),
                  placeholder: m.lists_add_tradelist_name_placeholder(),
                },
              ]),
          {
            key: "organize",
            label: m.lists_add_new_organize(),
            placeholder: m.lists_add_organize_name_placeholder(),
          },
        ],
        onCreate: createAndAdd,
        disabled: disableAdd,
      }}
    />
  );
}
