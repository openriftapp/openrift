import type { Printing } from "@openrift/shared/types/catalog";
import { PlusSquareIcon } from "lucide-react";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { Input } from "@/components/ui/input";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { RadioGroup } from "@/components/ui/radio-group";
import { RadioOptionRow } from "@/components/ui/radio-option-row";
import { useCreateTrade } from "@/features/groups/hooks/use-card-trades";
import {
  useFriendGroupShareableLists,
  useShareListWithFriendGroup,
} from "@/features/groups/hooks/use-friend-group-sharing";
import { useFriendGroupMatches } from "@/features/groups/hooks/use-friend-groups";
import { listTargetOptions, preferredListId } from "@/features/groups/lib/tradelist-exchange";
import { useBulkAddListEntries, useCreateList } from "@/features/lists/hooks/use-lists";
import { m } from "@/paraglide/messages.js";

const NEW_LIST = "__new__";

export interface OfferToWishlistContext {
  groupSlug: string;
  groupName: string;
  counterpartyUserId: string;
  counterpartyName: string;
}

export interface OfferablePrintingChoice {
  printing: Printing;
  copyIds: string[];
}

interface OfferToWishlistDialogProps extends OfferToWishlistContext {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  choices: OfferablePrintingChoice[];
  wantQuantity: number;
}

export function OfferToWishlistDialog({
  open,
  onOpenChange,
  choices,
  wantQuantity,
  groupSlug,
  groupName,
  counterpartyUserId,
  counterpartyName,
}: OfferToWishlistDialogProps) {
  const [firstChoice, ...otherChoices] = choices;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && firstChoice !== undefined ? (
          <Suspense
            fallback={
              <div className="text-muted-foreground py-4 text-sm">{m.trades_loading_lists()}</div>
            }
          >
            <OfferBody
              choices={[firstChoice, ...otherChoices]}
              wantQuantity={wantQuantity}
              groupSlug={groupSlug}
              groupName={groupName}
              counterpartyUserId={counterpartyUserId}
              counterpartyName={counterpartyName}
              onClose={() => onOpenChange(false)}
            />
          </Suspense>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function OfferBody({
  choices,
  wantQuantity,
  groupSlug,
  groupName,
  counterpartyUserId,
  counterpartyName,
  onClose,
}: OfferToWishlistContext & {
  choices: [OfferablePrintingChoice, ...OfferablePrintingChoice[]];
  wantQuantity: number;
  onClose: () => void;
}) {
  const { data: shareable } = useFriendGroupShareableLists(groupSlug);
  const { data: matches } = useFriendGroupMatches(groupSlug);
  const options = listTargetOptions(shareable.items, "trade");

  const createList = useCreateList();
  const bulkAdd = useBulkAddListEntries();
  const shareWithGroup = useShareListWithFriendGroup();
  const createTrade = useCreateTrade();
  const pending =
    createList.isPending || bulkAdd.isPending || shareWithGroup.isPending || createTrade.isPending;

  // `choices` arrives most-owned first.
  const [choiceIndex, setChoiceIndex] = useState(0);
  const chosenPrinting = choices[choiceIndex] ?? choices[0];
  const ownedCount = chosenPrinting.copyIds.length;
  const cardName = chosenPrinting.printing.card.name;

  const existingMatch = matches.othersWantYourHaves.find(
    (row) =>
      row.printingId === chosenPrinting.printing.id &&
      row.counterpartyUserId === counterpartyUserId,
  );

  const matchCap = existingMatch ? existingMatch.buyQuantity : wantQuantity;
  const maxQuantity = Math.max(1, Math.min(ownedCount, matchCap));
  const [quantity, setQuantity] = useState(1);
  const clampQuantity = (value: number) => Math.min(Math.max(1, value), maxQuantity);
  const effectiveQuantity = clampQuantity(quantity);

  const [phase, setPhase] = useState<"pick" | "confirm-share">("pick");
  const [selectedId, setSelectedId] = useState<string>(() => preferredListId(options) ?? NEW_LIST);
  const [newName, setNewName] = useState<string>(m.trades_default_tradelist_name());

  const chosenList = options.find((option) => option.listId === selectedId);
  // New lists are always private; an unshared existing list needs the same
  // confirmation. Either way the offer can't match until it's shared.
  const needsShare = selectedId === NEW_LIST ? true : chosenList ? !chosenList.isShared : false;
  const chosenListName =
    selectedId === NEW_LIST
      ? newName.trim() || m.trades_default_tradelist_name()
      : (chosenList?.listName ?? "");

  const sendOffer = async () => {
    const newListName = newName.trim() || m.trades_default_tradelist_name();
    try {
      const copyIds = chosenPrinting.copyIds.slice(0, effectiveQuantity);
      if (!existingMatch) {
        let listId: string;
        if (selectedId === NEW_LIST) {
          const created = await createList.mutateAsync({
            name: newListName,
            intent: "trade",
            kind: "copy",
          });
          listId = created.id;
        } else if (chosenList) {
          listId = chosenList.listId;
        } else {
          return;
        }
        await bulkAdd.mutateAsync({
          listId,
          entries: copyIds.map((copyId) => ({ copyId })),
        });
        if (needsShare) {
          await shareWithGroup.mutateAsync({ slug: groupSlug, listId });
        }
      }
      await createTrade.mutateAsync({
        groupSlug,
        counterpartyUserId,
        role: "giver",
        printingId: chosenPrinting.printing.id,
        quantity: effectiveQuantity,
      });
      toast.success(m.trades_offered_toast({ card: cardName, name: counterpartyName }));
      onClose();
    } catch {
      // Reported by the global mutation error toast.
    }
  };

  const printingPicker =
    choices.length > 1 ? (
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-sm">{m.trades_which_printing_offering()}</span>
        <RadioGroup
          value={String(choiceIndex)}
          onValueChange={(value) => {
            setChoiceIndex(Number(value));
            setQuantity(1);
          }}
        >
          {choices.map((choice, index) => (
            <RadioOptionRow
              key={choice.printing.id}
              value={String(index)}
              title={choice.printing.shortCode}
              meta={
                <span className="text-muted-foreground text-xs">
                  {m.trades_owned_count({ count: choice.copyIds.length })}
                </span>
              }
            />
          ))}
        </RadioGroup>
      </div>
    ) : null;

  const stepper = (
    <div className="flex items-center justify-between gap-4 py-2">
      <span>{m.trades_how_many()}</span>
      <QuantityStepper
        value={effectiveQuantity}
        onValueChange={setQuantity}
        max={maxQuantity}
        editable
      />
    </div>
  );

  if (existingMatch) {
    return (
      <DialogForm onSubmit={() => void sendOffer()}>
        <DialogHeader>
          <DialogTitle>{m.trades_offer_card_title()}</DialogTitle>
          <DialogDescription>
            {m.trades_offer_to_description({ card: cardName, name: counterpartyName })}
          </DialogDescription>
        </DialogHeader>
        {printingPicker}
        {stepper}
        <DialogFooter>
          <DialogCancel />
          <Button type="submit" disabled={pending}>
            {m.trades_send_offer()}
          </Button>
        </DialogFooter>
      </DialogForm>
    );
  }

  if (phase === "confirm-share") {
    return (
      <DialogForm onSubmit={() => void sendOffer()}>
        <DialogHeader>
          <DialogTitle>
            {m.trades_share_list_title({ list: chosenListName, group: groupName })}
          </DialogTitle>
          <DialogDescription>
            {m.trades_share_list_description({ list: chosenListName, group: groupName })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => setPhase("pick")}>
            {m.trades_back()}
          </Button>
          <Button type="submit" disabled={pending}>
            {m.trades_share_and_send_offer()}
          </Button>
        </DialogFooter>
      </DialogForm>
    );
  }

  return (
    <DialogForm onSubmit={needsShare ? () => setPhase("confirm-share") : sendOffer}>
      <DialogHeader>
        <DialogTitle>{m.trades_offer_card_title()}</DialogTitle>
        <DialogDescription>
          {m.trades_pick_tradelist_description({
            card: cardName,
            group: groupName,
            name: counterpartyName,
          })}
        </DialogDescription>
      </DialogHeader>

      {printingPicker}

      <RadioGroup value={selectedId} onValueChange={(value) => setSelectedId(String(value))}>
        {options.map((option) => (
          <RadioOptionRow
            key={option.listId}
            value={option.listId}
            title={option.listName}
            meta={
              <>
                <span className="text-muted-foreground text-xs">
                  {m.common_copies({ count: option.entryCount })}
                </span>
                <Badge variant={option.isShared ? "secondary" : "outline"}>
                  {option.isShared ? m.trades_shared() : m.trades_will_be_shared()}
                </Badge>
              </>
            }
          />
        ))}
        <RadioOptionRow
          value={NEW_LIST}
          title={
            <>
              <PlusSquareIcon className="text-muted-foreground mr-2 inline size-4 align-text-bottom" />
              {m.trades_new_tradelist()}
            </>
          }
          meta={<Badge variant="outline">{m.trades_will_be_shared()}</Badge>}
        />
      </RadioGroup>

      {selectedId === NEW_LIST ? (
        <Input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder={m.trades_tradelist_name_placeholder()}
          aria-label={m.trades_new_tradelist_name_label()}
        />
      ) : null}

      {stepper}

      <DialogFooter>
        <DialogCancel />
        {needsShare ? (
          <Button
            type="submit"
            disabled={pending || (selectedId === NEW_LIST && newName.trim().length === 0)}
          >
            {m.trades_continue()}
          </Button>
        ) : (
          <Button type="submit" disabled={pending}>
            {m.trades_send_offer()}
          </Button>
        )}
      </DialogFooter>
    </DialogForm>
  );
}
