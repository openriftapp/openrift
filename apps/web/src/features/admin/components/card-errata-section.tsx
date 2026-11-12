import { labelMap, enumLabel } from "@openrift/shared/enum-label";
import { formatDay } from "@openrift/shared/format-date";
import { PencilIcon, PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Heading } from "@/components/heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardList } from "@/components/ui/card-list";
import { TextLink } from "@/components/ui/text-link";
import { ErrataEditor } from "@/features/admin/components/errata-editor";
import { useErrataAnnouncements } from "@/features/admin/hooks/use-admin-card-queries";
import type { AdminCardErrata, ErrataDraft } from "@/features/admin/lib/errata-draft";
import {
  EMPTY_ERRATA_DRAFT,
  errataDraftFrom,
  errataDraftInput,
  nextErrataLanguage,
} from "@/features/admin/lib/errata-draft";
import { useDeleteCardErrata, useUpsertCardErrata } from "@/features/cards/hooks/use-card-errata";
import { useLanguageList } from "@/hooks/use-enums";

function ErrataRow({
  errata,
  languageLabel,
  onEdit,
  onRemove,
}: {
  errata: AdminCardErrata;
  languageLabel: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex flex-wrap items-start gap-2 px-3 py-2">
      <Badge variant="warning">Errata</Badge>
      <Badge variant="outline">{languageLabel}</Badge>
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
          {errata.effectiveDate !== null && (
            <>
              {" "}
              &middot; {errata.announcementId === null ? "first seen" : "published"}{" "}
              {formatDay(errata.effectiveDate)}
            </>
          )}
          {errata.announcementId === null && <> &middot; unannounced</>}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Edit the ${languageLabel} errata`}
        onClick={onEdit}
      >
        <PencilIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove the ${languageLabel} errata`}
        onClick={onRemove}
      >
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
  errata: AdminCardErrata[];
}) {
  const upsertErrata = useUpsertCardErrata();
  const announcements = useErrataAnnouncements();
  const deleteErrata = useDeleteCardErrata();
  const languages = useLanguageList();
  const languageLabels = labelMap(
    languages.map((language) => ({ slug: language.code, label: language.name })),
  );
  const labelFor = (code: string) => enumLabel(languageLabels, code);

  const [draft, setDraft] = useState<ErrataDraft>(EMPTY_ERRATA_DRAFT);
  const [editing, setEditing] = useState<"new" | "existing" | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const nextLanguage = nextErrataLanguage(
    errata,
    languages.map((language) => language.code),
  );
  const freeLanguages = languages.filter(
    (language) => !errata.some((entry) => entry.language === language.code),
  );

  return (
    <section className="flex flex-col gap-4">
      <Heading level={2}>Errata</Heading>

      {errata.length === 0 && editing === null && (
        <p className="text-muted-foreground text-sm">
          Nothing on this card has been corrected after printing.
        </p>
      )}

      {errata.length > 0 && editing === null && (
        <CardList>
          {errata.map((entry) => (
            <ErrataRow
              key={entry.language}
              errata={entry}
              languageLabel={labelFor(entry.language)}
              onEdit={() => {
                setDraft(errataDraftFrom(entry));
                setEditing("existing");
              }}
              onRemove={() => setRemoving(entry.language)}
            />
          ))}
        </CardList>
      )}

      {editing === null ? (
        nextLanguage !== null && (
          <Button
            variant="outline"
            onClick={() => {
              setDraft({ ...EMPTY_ERRATA_DRAFT, language: nextLanguage });
              setEditing("new");
            }}
          >
            <PlusIcon />
            Add errata
          </Button>
        )
      ) : (
        <ErrataEditor
          draft={draft}
          announcements={announcements.data ?? []}
          languages={
            editing === "new"
              ? freeLanguages
              : [{ code: draft.language, name: labelFor(draft.language) }]
          }
          isPending={upsertErrata.isPending}
          submitLabel={editing === "new" ? "Add" : "Save"}
          onChange={(next) => setDraft((current) => ({ ...current, ...next }))}
          onSubmit={() =>
            upsertErrata.mutate(errataDraftInput(cardId, draft), {
              onSuccess: () => setEditing(null),
            })
          }
          onCancel={() => setEditing(null)}
        />
      )}

      <ConfirmActionDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null);
          }
        }}
        title={`Remove the ${labelFor(removing ?? "")} errata?`}
        description="Printings in this language fall back to the text printed on them."
        confirmLabel="Remove errata"
        pendingLabel="Removing…"
        isPending={deleteErrata.isPending}
        onConfirm={() => {
          if (removing !== null) {
            deleteErrata.mutate(
              { cardId, language: removing },
              { onSuccess: () => setRemoving(null) },
            );
          }
        }}
      />
    </section>
  );
}
