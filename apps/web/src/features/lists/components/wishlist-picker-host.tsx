import { legendDisplayName } from "@openrift/shared/card-name";
import type { ListKind } from "@openrift/shared/types/api/list";
import type { Printing } from "@openrift/shared/types/catalog";
import { useState } from "react";

import {
  AddToWishlistDialog,
  toastAddedToWishlist,
} from "@/features/lists/components/add-to-wishlist-dialog";
import { CreateListDialog } from "@/features/lists/components/create-list-dialog";
import { m } from "@/paraglide/messages.js";

export function WishlistPickerHost({
  target,
  onClose,
}: {
  target: Printing | null;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"picking" | "creating">("picking");

  if (!target) {
    return null;
  }

  const entriesFor = (kind: ListKind) =>
    kind === "card" ? [{ cardId: target.cardId }] : [{ printingId: target.printingId }];
  const cardName = legendDisplayName(target.card);

  const close = () => {
    setStep("picking");
    onClose();
  };

  return (
    <>
      <AddToWishlistDialog
        open={step === "picking"}
        onOpenChange={(open) => {
          if (!open) {
            close();
          }
        }}
        entriesFor={entriesFor}
        onCreateNew={() => setStep("creating")}
        onAdded={close}
      />
      <CreateListDialog
        intent="wish"
        open={step === "creating"}
        onOpenChange={(open) => {
          if (!open) {
            close();
          }
        }}
        initialEntries={entriesFor}
        title={m.lists_add_new_wishlist_title({ name: cardName })}
        description={m.lists_add_new_wishlist_description()}
        kindHints={{
          card: m.lists_add_new_wishlist_hint_card(),
          printing: m.lists_add_new_wishlist_hint_printing(),
        }}
        onCreated={(_listId, listName) => {
          toastAddedToWishlist(1, listName);
          close();
        }}
      />
    </>
  );
}
