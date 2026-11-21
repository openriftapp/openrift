import { useState } from "react";
import { toast } from "sonner";
import { v7 as uuidv7 } from "uuid";

import { useAddCopies, useDisposeCopies } from "@/features/collections/hooks/use-copies";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

interface DeckBoxAdding {
  adding: boolean;
  createdIds: ReadonlySet<string>;
  start: () => void;
  add: (printingId: string) => string;
  remove: (copyId: string) => void;
  replace: (copyId: string, printingId: string) => string;
  finish: () => void;
}

export function useDeckBoxAdding(
  homeCollectionId: string,
  homeCollectionName: string,
): DeckBoxAdding {
  const [adding, setAdding] = useState(false);
  const [createdIds, setCreatedIds] = useState<ReadonlySet<string>>(new Set());
  const addCopies = useAddCopies();
  const disposeCopies = useDisposeCopies();

  const track = (copyId: string) => setCreatedIds((previous) => new Set(previous).add(copyId));
  const forget = (copyId: string) =>
    setCreatedIds((previous) => {
      const next = new Set(previous);
      next.delete(copyId);
      return next;
    });

  const insert = async (id: string, printingId: string) => {
    const ok = await runReportedMutation(() =>
      addCopies.mutateAsync({ copies: [{ id, printingId, collectionId: homeCollectionId }] }),
    );
    if (!ok) {
      forget(id);
    }
  };

  const dispose = async (copyId: string) => {
    forget(copyId);
    const ok = await runReportedMutation(() => disposeCopies.mutateAsync({ copyIds: [copyId] }));
    if (!ok) {
      track(copyId);
    }
  };

  const add = (printingId: string) => {
    const id = uuidv7();
    track(id);
    void insert(id, printingId);
    return id;
  };

  const finish = () => {
    const copyIds = [...createdIds];
    setAdding(false);
    setCreatedIds(new Set());
    if (copyIds.length === 0) {
      return;
    }
    toast.success(
      m.decks_overview_box_added({ count: copyIds.length, collection: homeCollectionName }),
      {
        action: {
          label: m.decks_overview_box_undo(),
          onClick: () => disposeCopies.mutate({ copyIds }),
        },
      },
    );
  };

  return {
    adding,
    createdIds,
    start: () => setAdding(true),
    add,
    remove: (copyId) => void dispose(copyId),
    replace: (copyId, printingId) => {
      void dispose(copyId);
      return add(printingId);
    },
    finish,
  };
}
