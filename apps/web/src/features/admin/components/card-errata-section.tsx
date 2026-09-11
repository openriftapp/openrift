import { formatDay } from "@openrift/shared/format-date";
import type { CardErrata } from "@openrift/shared/types/catalog";
import { PencilIcon, PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardList } from "@/components/ui/card-list";
import { TextLink } from "@/components/ui/text-link";
import { AdminConfirmDialog } from "@/features/admin/components/admin-confirm-dialog";
import { ErrataEditor } from "@/features/admin/components/errata-editor";
import type { ErrataDraft } from "@/features/admin/lib/errata-draft";
import {
  EMPTY_ERRATA_DRAFT,
  errataDraftFrom,
  errataDraftInput,
} from "@/features/admin/lib/errata-draft";
import { useDeleteCardErrata, useUpsertCardErrata } from "@/features/cards/hooks/use-card-errata";

function ErrataRow({
  errata,
  onEdit,
  onRemove,
}: {
  errata: CardErrata;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex flex-wrap items-start gap-2 px-3 py-2">
      <Badge variant="warning">Errata</Badge>
      <div className="min-w-0 flex-1 space-y-1 text-sm">
        {errata.correctedRulesText !== null && (
          <p>
            <span className="text-muted-foreground">Rules: </span>
            {errata.correctedRulesText}
          </p>
        )}
        {errata.correctedEffectText !== null && (
          <p>
            <span className="text-muted-foreground">Effect: </span>
            {errata.correctedEffectText}
          </p>
        )}
        <p className="text-muted-foreground">
          {errata.sourceUrl === null ? (
            errata.source
          ) : (
            <TextLink variant="muted" href={errata.sourceUrl} target="_blank" rel="noreferrer">
              {errata.source}
            </TextLink>
          )}
          {errata.effectiveDate !== null && <> &middot; since {formatDay(errata.effectiveDate)}</>}
        </p>
      </div>
      <Button variant="ghost" size="icon-sm" aria-label="Edit the errata" onClick={onEdit}>
        <PencilIcon />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Remove the errata" onClick={onRemove}>
        <XIcon />
      </Button>
    </li>
  );
}

export function CardErrataSection({
  cardId,
  errata,
}: {
  cardId: string;
  errata: CardErrata | null;
}) {
  const upsertErrata = useUpsertCardErrata();
  const deleteErrata = useDeleteCardErrata();

  const [draft, setDraft] = useState<ErrataDraft>(EMPTY_ERRATA_DRAFT);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Errata</h2>

      {errata === null && !editing && (
        <p className="text-muted-foreground text-sm">
          Nothing on this card has been corrected after printing.
        </p>
      )}

      {errata !== null && !editing && (
        <CardList>
          <ErrataRow
            errata={errata}
            onEdit={() => {
              setDraft(errataDraftFrom(errata));
              setEditing(true);
            }}
            onRemove={() => setRemoving(true)}
          />
        </CardList>
      )}

      {editing ? (
        <ErrataEditor
          draft={draft}
          isPending={upsertErrata.isPending}
          submitLabel={errata === null ? "Add" : "Save"}
          onChange={(next) => setDraft((current) => ({ ...current, ...next }))}
          onSubmit={() =>
            upsertErrata.mutate(errataDraftInput(cardId, draft), {
              onSuccess: () => setEditing(false),
            })
          }
          onCancel={() => setEditing(false)}
        />
      ) : (
        errata === null && (
          <Button
            variant="outline"
            onClick={() => {
              setDraft(EMPTY_ERRATA_DRAFT);
              setEditing(true);
            }}
          >
            <PlusIcon />
            Add errata
          </Button>
        )
      )}

      <AdminConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        copy={{
          title: "Remove the errata?",
          description: "The card falls back to the text printed on it.",
          confirmLabel: "Remove errata",
        }}
        onConfirm={() => deleteErrata.mutate({ cardId })}
      />
    </section>
  );
}
