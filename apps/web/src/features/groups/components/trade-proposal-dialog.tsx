import { sideKey } from "@openrift/shared/printing-side";
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
import { PrintingVariantLine } from "@/features/cards/components/printing-row";
import { printingDisplayName } from "@/features/cards/lib/card-meta";
import { useCreateTrade } from "@/features/groups/hooks/use-card-trades";
import {
  useFriendGroupShareableLists,
  useShareListWithFriendGroup,
} from "@/features/groups/hooks/use-friend-group-sharing";
import { useFriendGroupMatches } from "@/features/groups/hooks/use-friend-groups";
import { matchOnPrinting } from "@/features/groups/lib/trade-printing";
import type { ListTargetOption } from "@/features/groups/lib/tradelist-exchange";
import {
  entryForPrinting,
  listTargetOptions,
  preferredListId,
  requestListKind,
} from "@/features/groups/lib/tradelist-exchange";
import { LIST_KIND_ICON } from "@/features/lists/components/create-list-dialog";
import { useBulkAddListEntries, useCreateList } from "@/features/lists/hooks/use-lists";
import { listKindNoun } from "@/lib/list-intent";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

const NEW_LIST = "__new__";

type TradeProposalSide = "offer" | "request";

export interface TradeProposalContext {
  groupSlug: string;
  groupName: string;
  counterpartyUserId: string;
  counterpartyName: string;
}

export interface TradePrintingChoice {
  printing: Printing;
  available: number;
  copyIds?: string[];
}

interface CardAndName {
  card: string;
  name: string;
}

interface CardGroupAndName extends CardAndName {
  group: string;
}

const SIDES = {
  offer: {
    intent: "trade",
    role: "giver",
    newListKind: () => "copy" as const,
    defaultListName: m.trades_default_tradelist_name,
    title: m.trades_offer_card_title,
    matchedDescription: (args: CardAndName) => m.trades_offer_to_description(args),
    pickDescription: (args: CardGroupAndName) => m.trades_pick_tradelist_description(args),
    send: m.trades_send_offer,
    shareAndSend: m.trades_share_and_send_offer,
    newList: m.trades_new_tradelist,
    namePlaceholder: m.trades_tradelist_name_placeholder,
    nameLabel: m.trades_new_tradelist_name_label,
    sentToast: (args: CardAndName) => m.trades_offered_toast(args),
  },
  request: {
    intent: "wish",
    role: "receiver",
    newListKind: (chosen?: ListTargetOption) => requestListKind(chosen),
    defaultListName: m.trades_default_wishlist_name,
    title: m.trades_request_card_title,
    matchedDescription: (args: CardAndName) => m.trades_request_from_description(args),
    pickDescription: (args: CardGroupAndName) => m.trades_pick_wishlist_description(args),
    send: m.trades_send_request,
    shareAndSend: m.trades_share_and_send_request,
    newList: m.trades_new_wishlist,
    namePlaceholder: m.trades_wishlist_name_placeholder,
    nameLabel: m.trades_new_wishlist_name_label,
    sentToast: (args: CardAndName) => m.trades_requested_toast(args),
  },
} as const;

interface TradeProposalDialogProps extends TradeProposalContext {
  side: TradeProposalSide;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  choices: TradePrintingChoice[];
  wantQuantity?: number;
}

export function TradeProposalDialog({
  side,
  open,
  onOpenChange,
  choices,
  wantQuantity,
  ...context
}: TradeProposalDialogProps) {
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
            <ProposalBody
              side={side}
              choices={[firstChoice, ...otherChoices]}
              wantQuantity={wantQuantity ?? Number.POSITIVE_INFINITY}
              {...context}
              onClose={() => onOpenChange(false)}
            />
          </Suspense>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ProposalBody({
  side,
  choices,
  wantQuantity,
  groupSlug,
  groupName,
  counterpartyUserId,
  counterpartyName,
  onClose,
}: TradeProposalContext & {
  side: TradeProposalSide;
  choices: [TradePrintingChoice, ...TradePrintingChoice[]];
  wantQuantity: number;
  onClose: () => void;
}) {
  const copy = SIDES[side];
  const { data: shareable } = useFriendGroupShareableLists(groupSlug);
  const { data: matches } = useFriendGroupMatches(groupSlug);
  const options = listTargetOptions(shareable.items, copy.intent);

  const createList = useCreateList();
  const bulkAdd = useBulkAddListEntries();
  const shareWithGroup = useShareListWithFriendGroup();
  const createTrade = useCreateTrade();
  const pending =
    createList.isPending || bulkAdd.isPending || shareWithGroup.isPending || createTrade.isPending;

  const [choiceIndex, setChoiceIndex] = useState(0);
  const choice = choices[choiceIndex] ?? choices[0];
  const { printing } = choice;
  const cardName = printingDisplayName(printing);

  const existingMatch = matchOnPrinting(
    side === "offer" ? matches.othersWantYourHaves : matches.othersHaveYourWants,
    printing,
    counterpartyUserId,
  );
  const cap = existingMatch ? existingMatch.buyQuantity : wantQuantity;
  const maxQuantity = Math.max(1, Math.min(choice.available, cap));
  const [quantity, setQuantity] = useState(1);
  const effectiveQuantity = Math.min(Math.max(1, quantity), maxQuantity);

  const [phase, setPhase] = useState<"pick" | "confirm-share">("pick");
  const [selectedId, setSelectedId] = useState<string>(() => preferredListId(options) ?? NEW_LIST);
  const [newName, setNewName] = useState<string>(copy.defaultListName());

  const chosenList = options.find((option) => option.listId === selectedId);
  const listKind = copy.newListKind(chosenList);
  const NewKindIcon = LIST_KIND_ICON[copy.newListKind()];
  const needsShare = selectedId === NEW_LIST ? true : chosenList ? !chosenList.isShared : false;
  const chosenListName =
    selectedId === NEW_LIST
      ? newName.trim() || copy.defaultListName()
      : (chosenList?.listName ?? "");

  const submit = async (): Promise<boolean> => {
    const newListName = newName.trim() || copy.defaultListName();
    if (!existingMatch) {
      let listId: string;
      if (selectedId === NEW_LIST) {
        const created = await createList.mutateAsync({
          name: newListName,
          intent: copy.intent,
          kind: listKind,
        });
        listId = created.id;
      } else if (chosenList) {
        listId = chosenList.listId;
      } else {
        return false;
      }
      await bulkAdd.mutateAsync({
        listId,
        entries:
          listKind === "copy"
            ? (choice.copyIds ?? []).slice(0, effectiveQuantity).map((copyId) => ({ copyId }))
            : [entryForPrinting(listKind, printing, effectiveQuantity)],
      });
      if (needsShare) {
        await shareWithGroup.mutateAsync({ slug: groupSlug, listId });
      }
    }
    await createTrade.mutateAsync({
      groupSlug,
      counterpartyUserId,
      role: copy.role,
      printingId: printing.printingId,
      cardId: existingMatch?.cardId ?? printing.cardId,
      quantity: effectiveQuantity,
    });
    return true;
  };

  const send = async () => {
    let sent = false;
    const ok = await runReportedMutation(async () => {
      sent = await submit();
    });
    if (ok && sent) {
      toast.success(copy.sentToast({ card: cardName, name: counterpartyName }));
      onClose();
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
          {choices.map((option, index) => (
            <RadioOptionRow
              key={sideKey(option.printing)}
              value={String(index)}
              title={
                <PrintingVariantLine
                  printing={option.printing}
                  siblings={choices.map((other) => other.printing)}
                />
              }
              meta={
                <span className="text-muted-foreground text-xs">
                  {m.trades_owned_count({ count: option.available })}
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
      <DialogForm onSubmit={() => void send()}>
        <DialogHeader>
          <DialogTitle>{copy.title()}</DialogTitle>
          <DialogDescription>
            {copy.matchedDescription({ card: cardName, name: counterpartyName })}
          </DialogDescription>
        </DialogHeader>
        {printingPicker}
        {stepper}
        <DialogFooter>
          <DialogCancel />
          <Button type="submit" disabled={pending}>
            {copy.send()}
          </Button>
        </DialogFooter>
      </DialogForm>
    );
  }

  if (phase === "confirm-share") {
    return (
      <DialogForm onSubmit={() => void send()}>
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
            {copy.shareAndSend()}
          </Button>
        </DialogFooter>
      </DialogForm>
    );
  }

  return (
    <DialogForm onSubmit={needsShare ? () => setPhase("confirm-share") : send}>
      <DialogHeader>
        <DialogTitle>{copy.title()}</DialogTitle>
        <DialogDescription>
          {copy.pickDescription({ card: cardName, group: groupName, name: counterpartyName })}
        </DialogDescription>
      </DialogHeader>

      {printingPicker}

      <RadioGroup value={selectedId} onValueChange={(value) => setSelectedId(String(value))}>
        {options.map((option) => {
          const KindIcon = LIST_KIND_ICON[option.listKind];
          return (
            <RadioOptionRow
              key={option.listId}
              value={option.listId}
              title={option.listName}
              meta={
                <>
                  <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                    <KindIcon className="size-3" />
                    {option.entryCount} {listKindNoun(option.listKind, option.entryCount)}
                  </span>
                  <Badge variant={option.isShared ? "secondary" : "outline"}>
                    {option.isShared ? m.trades_shared() : m.trades_will_be_shared()}
                  </Badge>
                </>
              }
            />
          );
        })}
        <RadioOptionRow
          value={NEW_LIST}
          title={
            <>
              <PlusSquareIcon className="text-muted-foreground mr-2 inline size-4 align-text-bottom" />
              {copy.newList()}
            </>
          }
          meta={
            <>
              <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                <NewKindIcon className="size-3" />
                {listKindNoun(copy.newListKind(), 2)}
              </span>
              <Badge variant="outline">{m.trades_will_be_shared()}</Badge>
            </>
          }
        />
      </RadioGroup>

      {selectedId === NEW_LIST ? (
        <Input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder={copy.namePlaceholder()}
          aria-label={copy.nameLabel()}
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
            {copy.send()}
          </Button>
        )}
      </DialogFooter>
    </DialogForm>
  );
}
