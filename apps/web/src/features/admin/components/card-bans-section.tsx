import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Heading } from "@/components/heading";
import { Button } from "@/components/ui/button";
import { CardList } from "@/components/ui/card-list";
import { Skeleton } from "@/components/ui/skeleton";
import { BanEditor } from "@/features/admin/components/ban-editor";
import { BanRow } from "@/features/admin/components/ban-row";
import { useFormats } from "@/features/admin/hooks/use-formats";
import type { BanDraft } from "@/features/admin/lib/ban-draft";
import {
  banDraftFromBan,
  banDraftInput,
  newBanDraft,
  selectableFormats,
} from "@/features/admin/lib/ban-draft";
import type { RunWrite } from "@/features/admin/lib/run-write";
import { runWriteDirectly } from "@/features/admin/lib/run-write";
import {
  useCardBans,
  useCreateCardBan,
  useRemoveCardBan,
  useUpdateCardBan,
} from "@/features/cards/hooks/use-card-bans";

export function CardBansSection({
  cardId,
  runWrite = runWriteDirectly,
}: {
  cardId: string;
  runWrite?: RunWrite;
}) {
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
  const openFormats = selectableFormats(formats ?? [], rows, draft.circuit);
  const removing = rows.find((ban) => ban.id === removingId) ?? null;

  function changeDraft(next: Partial<BanDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  async function submit() {
    const input = banDraftInput(cardId, draft);
    const save = editingId === null ? createBan : updateBan;
    if (await runWrite((signal) => save.mutateAsync(input, { signal }))) {
      setAdding(false);
      setEditingId(null);
    }
  }

  async function confirmRemove() {
    if (removing === null) {
      return;
    }
    const { formatId, circuit } = removing;
    if (
      await runWrite((signal) => removeBan.mutateAsync({ cardId, formatId, circuit }, { signal }))
    ) {
      setRemovingId(null);
    }
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
                  onSubmit={() => void submit()}
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
          onSubmit={() => void submit()}
          onCancel={() => setAdding(false)}
        />
      )}

      {!adding && !isPending && (formats ?? []).length > 0 && (
        <Button
          variant="outline"
          onClick={() => {
            setEditingId(null);
            setDraft(newBanDraft(selectableFormats(formats ?? [], rows, null).at(0)?.id ?? ""));
            setAdding(true);
          }}
        >
          <PlusIcon />
          Add ban
        </Button>
      )}

      <ConfirmActionDialog
        open={removing !== null}
        onOpenChange={(open) => setRemovingId(open ? removingId : null)}
        title={`Lift the ${removing?.formatName ?? ""} ban?`}
        description="The card counts as legal in that format again as soon as this is removed."
        confirmLabel="Remove ban"
        isPending={removeBan.isPending}
        onConfirm={() => void confirmRemove()}
      />
    </section>
  );
}
