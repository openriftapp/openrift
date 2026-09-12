import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { Heading } from "@/components/heading";
import { Button } from "@/components/ui/button";
import { CardList } from "@/components/ui/card-list";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminConfirmDialog } from "@/features/admin/components/admin-confirm-dialog";
import { BanEditor } from "@/features/admin/components/ban-editor";
import { BanRow } from "@/features/admin/components/ban-row";
import type { BanDraft } from "@/features/admin/lib/ban-draft";
import {
  banDraftFromBan,
  banDraftInput,
  newBanDraft,
  selectableFormats,
} from "@/features/admin/lib/ban-draft";
import {
  useCardBans,
  useCreateCardBan,
  useRemoveCardBan,
  useUpdateCardBan,
} from "@/features/cards/hooks/use-card-bans";
import { useFormats } from "@/hooks/use-formats";

export function CardBansSection({ cardId }: { cardId: string }) {
  const { data: bans, isPending } = useCardBans(cardId);
  const { data: formats } = useFormats();
  const createBan = useCreateCardBan();
  const updateBan = useUpdateCardBan();
  const removeBan = useRemoveCardBan();

  const [draft, setDraft] = useState<BanDraft>(() => newBanDraft(""));
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const rows = bans ?? [];
  const openFormats = selectableFormats(formats ?? [], rows);
  const removing = rows.find((ban) => ban.id === removingId) ?? null;

  function changeDraft(next: Partial<BanDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function submit() {
    const input = banDraftInput(cardId, draft);
    const settle = {
      onSuccess: () => {
        setAdding(false);
        setEditingId(null);
      },
    };
    if (editingId === null) {
      createBan.mutate(input, settle);
      return;
    }
    updateBan.mutate(input, settle);
  }

  function confirmRemove() {
    if (removing === null) {
      return;
    }
    removeBan.mutate({ cardId, formatId: removing.formatId });
  }

  return (
    <section className="flex flex-col gap-4">
      <Heading level={2}>Bans</Heading>

      {isPending && <Skeleton className="h-16 w-full" />}

      {!isPending && rows.length === 0 && (
        <p className="text-muted-foreground text-sm">This card is legal in every format.</p>
      )}

      {rows.length > 0 && (
        <CardList>
          {rows.map((ban) =>
            editingId === ban.id ? (
              <li key={ban.id} className="p-1.5">
                <BanEditor
                  draft={draft}
                  formats={openFormats}
                  lockedFormatName={ban.formatName}
                  isPending={updateBan.isPending}
                  submitLabel="Save"
                  onChange={changeDraft}
                  onSubmit={submit}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <BanRow
                key={ban.id}
                ban={ban}
                onEdit={() => {
                  setAdding(false);
                  setDraft(banDraftFromBan(ban));
                  setEditingId(ban.id);
                }}
                onRemove={() => setRemovingId(ban.id)}
              />
            ),
          )}
        </CardList>
      )}

      {adding && (
        <BanEditor
          draft={draft}
          formats={openFormats}
          lockedFormatName={null}
          isPending={createBan.isPending}
          submitLabel="Add"
          onChange={changeDraft}
          onSubmit={submit}
          onCancel={() => setAdding(false)}
        />
      )}

      {!adding && !isPending && openFormats.length > 0 && (
        <Button
          variant="outline"
          onClick={() => {
            setEditingId(null);
            setDraft(newBanDraft(openFormats.at(0)?.id ?? ""));
            setAdding(true);
          }}
        >
          <PlusIcon />
          Add ban
        </Button>
      )}

      <AdminConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => setRemovingId(open ? removingId : null)}
        copy={{
          title: `Lift the ${removing?.formatName ?? ""} ban?`,
          description: "The card counts as legal in that format again as soon as this is removed.",
          confirmLabel: "Remove ban",
        }}
        onConfirm={confirmRemove}
      />
    </section>
  );
}
