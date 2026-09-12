import type { ListKind } from "@openrift/shared/types/api/list";
import type { Printing } from "@openrift/shared/types/catalog";
import { legendDisplayName } from "@openrift/shared/utils";
import { useState } from "react";

import { AddToWishlistDialog } from "@/features/lists/components/add-to-wishlist-dialog";
import { CreateListDialog } from "@/features/lists/components/create-list-dialog";
import { m } from "@/paraglide/messages.js";

export function WishlistPickerHost({
  target,
  onClose,
}: {
  target: Printing | null;
  onClose: () => void;
}) {
  const [creating, setCreating] = useState(false);

  if (!target) {
    return null;
  }

  const entriesFor = (kind: ListKind) =>
    kind === "card" ? [{ cardId: target.cardId }] : [{ printingId: target.id }];
  const cardName = legendDisplayName(target.card);

  const close = () => {
    setCreating(false);
    onClose();
  };

  return (
    <>
      <AddToWishlistDialog
        open={!creating}
        onOpenChange={(open) => {
          if (!open) {
            close();
          }
        }}
        entriesFor={entriesFor}
        onCreateNew={() => setCreating(true)}
        onAdded={close}
      />
      <CreateListDialog
        intent="wish"
        open={creating}
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
        onCreated={close}
      />
    </>
  );
}
