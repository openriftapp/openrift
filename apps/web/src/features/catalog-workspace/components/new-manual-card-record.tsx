import { enumLabel } from "@openrift/shared/enum-label";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCreateCard } from "@/features/admin/hooks/use-admin-card-mutations";
import { useUploadPrintingImage } from "@/features/admin/hooks/use-admin-image-mutations";
import {
  MANUAL_CARD_STATS,
  useManualCardDraft,
} from "@/features/admin/hooks/use-manual-card-draft";
import { useCreateDeskPrinting } from "@/features/admin/hooks/use-printing-desk";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { readCreatedCardId } from "@/features/admin/lib/created-card-id";
import { catalogKeys, cardsKeys, promosKeys } from "@/features/cards/lib/cards-query-keys";
import { draftImageLabel } from "@/features/catalog-workspace/components/creation/creation-images";
import { CreationPanel } from "@/features/catalog-workspace/components/creation/creation-panel";
import {
  RecordHeader,
  RecordPane,
  RecordSection,
} from "@/features/catalog-workspace/components/record/record-pane";
import { useRegisterRecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import type { CreationDraft } from "@/features/catalog-workspace/lib/creation-draft";
import {
  draftFromBasePrinting,
  plannedImageUploads,
  toDeskCreateInput,
  validateDraft,
} from "@/features/catalog-workspace/lib/creation-draft";
import { ChipInput } from "@/features/contribute/components/form-fields";
import { useEffectiveLanguageOrder } from "@/hooks/use-effective-language-order";
import { useEnumOrders } from "@/hooks/use-enums";
import { useSession } from "@/hooks/use-session";
import { errorText } from "@/lib/error-text";
import { parseIntegerInput } from "@/lib/integer-input";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { PERSISTENT_ERROR_TOAST } from "@/lib/toast";

const IMAGE_SCOPE = [
  adminKeys.printingDesk.all,
  adminKeys.cards.all,
  adminKeys.workspace,
  catalogKeys.all,
  cardsKeys.all,
  promosKeys.all,
] as const;

function asExistingCard(draft: CreationDraft, id: string, slug: string, name: string) {
  return { ...draft, card: { mode: "existing" as const, id, slug, name } };
}

export function NewManualCardRecord() {
  const queueWrite = useQueueWorkspaceWrite();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const createCard = useCreateCard();
  const createPrinting = useCreateDeskPrinting({ inlineError: true });
  const uploadImage = useUploadPrintingImage(IMAGE_SCOPE);
  const { orders, labels } = useEnumOrders();
  const preferredLanguages = useEffectiveLanguageOrder();

  const cardDraft = useManualCardDraft();
  const { name, slug, input } = cardDraft;
  const { setTypes, setDomains, setSuperTypes, setTags } = cardDraft;
  const [withPrinting, setWithPrinting] = useState(true);
  const [draftEdit, setDraftEdit] = useState<CreationDraft | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useRegisterRecordActions({});

  const baseDraft = draftFromBasePrinting({ id: "", slug: "", name: "" }, undefined, {
    language: preferredLanguages.at(0) ?? "en",
    finish: orders.finishes[0] ?? "",
    size: orders.cardSizes[0] ?? "",
  });
  const draft: CreationDraft = {
    ...(draftEdit ?? baseDraft),
    card: { mode: "new", slug, name: name.trim(), summary: "" },
  };
  const printingIssues = validateDraft(asExistingCard(draft, "pending", slug, name.trim()));
  const canCreate =
    input !== undefined &&
    (!withPrinting || printingIssues.length === 0) &&
    !pending &&
    !createCard.isPending;
  const credit = session?.user.name;

  async function createFirstPrinting(
    signal: AbortSignal,
    cardSlug: string,
  ): Promise<string | null> {
    const card = await readCreatedCardId(queryClient, cardSlug);
    if (!card.ok) {
      return `The card was created, but its printing was not: ${card.reason}. Add it under Printings.`;
    }
    const cardId = card.id;
    const ready = asExistingCard(draft, cardId, cardSlug, name.trim());
    let created: Awaited<ReturnType<typeof createPrinting.mutateAsync>> | undefined;
    let reason = "unknown error";
    const ok = await runReportedMutation(
      async () => {
        created = await createPrinting.mutateAsync(toDeskCreateInput(ready), { signal });
      },
      (error) => {
        reason = errorText(error, reason);
      },
    );
    if (!ok || !created) {
      return `The card was created, but its printing was not: ${reason}`;
    }
    const { printingId } = created;
    const failed: string[] = [];
    const uploadCredit = credit !== undefined && credit.length > 0 ? credit : undefined;
    for (const upload of plannedImageUploads(ready)) {
      if (upload.image.kind !== "file") {
        continue;
      }
      const file = upload.image.file;
      const uploaded = await runReportedMutation(() =>
        uploadImage.mutateAsync(
          {
            printingId,
            file,
            mode: upload.mode,
            face: upload.face,
            credit: uploadCredit,
          },
          { signal },
        ),
      );
      if (!uploaded) {
        failed.push(draftImageLabel(upload.image));
      }
    }
    return failed.length > 0
      ? `The card and its printing were created, but ${failed.join(", ")} did not upload.`
      : null;
  }

  async function create(signal: AbortSignal) {
    if (!canCreate || input === undefined) {
      return;
    }
    setPending(true);
    setNotice(null);
    let createdCard: Awaited<ReturnType<typeof createCard.mutateAsync>> | undefined;
    const ok = await runReportedMutation(
      async () => {
        createdCard = await createCard.mutateAsync(input, { signal });
      },
      (error) => setNotice(errorText(error, "Could not create the card.")),
    );
    if (!ok || !createdCard) {
      setPending(false);
      return;
    }
    const { cardSlug } = createdCard;
    const printingError = withPrinting ? await createFirstPrinting(signal, cardSlug) : null;
    await queryClient.invalidateQueries({ queryKey: adminKeys.workspace });
    setPending(false);
    if (printingError !== null) {
      toast.error(printingError, PERSISTENT_ERROR_TOAST);
    }
    void navigate({ to: "/admin/workspace/cards/$cardSlug", params: { cardSlug } });
  }

  return (
    <RecordPane
      header={
        <RecordHeader
          title={name.trim().length > 0 ? name : "New card"}
          subtitle="Not saved"
          actions={
            <>
              <Button
                variant="ghost"
                onClick={() => void navigate({ to: "/admin/workspace/cards", search: true })}
              >
                Cancel
              </Button>
              <Button
                disabled={!canCreate}
                pending={pending}
                onClick={() => void queueWrite(create, { limit: "upload" })}
              >
                Create card
              </Button>
            </>
          }
        />
      }
    >
      {notice !== null && (
        <Alert variant="destructive">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      <RecordSection title="Card fields">
        <fieldset disabled={pending} className="min-w-0">
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="new-card-name">Name *</FieldLabel>
                <Input
                  id="new-card-name"
                  value={name}
                  onChange={(event) => cardDraft.setName(event.target.value)}
                  placeholder="e.g. Jinx, Rebel"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-card-slug">Card ID *</FieldLabel>
                <Input
                  id="new-card-slug"
                  value={cardDraft.slugInput}
                  onChange={(event) => cardDraft.setSlug(event.target.value)}
                  placeholder="made from the name"
                  className="font-mono"
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Types *</FieldLabel>
              <ToggleGroup
                multiple
                variant="outline"
                spacing={2}
                value={cardDraft.types}
                onValueChange={setTypes}
                className="w-full flex-wrap"
              >
                {orders.cardTypes.map((typeSlug) => (
                  <ToggleGroupItem key={typeSlug} value={typeSlug}>
                    {enumLabel(labels.cardTypes, typeSlug)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
            <Field>
              <FieldLabel>Domains *</FieldLabel>
              <ToggleGroup
                multiple
                variant="outline"
                spacing={2}
                value={cardDraft.domains}
                onValueChange={setDomains}
                className="w-full flex-wrap"
              >
                {orders.domains.map((domainSlug) => (
                  <ToggleGroupItem key={domainSlug} value={domainSlug}>
                    {enumLabel(labels.domains, domainSlug)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
            <Field>
              <FieldLabel>Supertypes</FieldLabel>
              <ToggleGroup
                multiple
                variant="outline"
                spacing={2}
                value={cardDraft.superTypes}
                onValueChange={setSuperTypes}
                className="w-full flex-wrap"
              >
                {orders.superTypes.map((superTypeSlug) => (
                  <ToggleGroupItem key={superTypeSlug} value={superTypeSlug}>
                    {enumLabel(labels.superTypes, superTypeSlug)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {MANUAL_CARD_STATS.map(({ key, label }) => {
                const invalid = parseIntegerInput(cardDraft.numeric[key]) === undefined;
                return (
                  <Field key={key} data-invalid={invalid}>
                    <FieldLabel htmlFor={`new-card-${key}`}>{label}</FieldLabel>
                    <Input
                      id={`new-card-${key}`}
                      type="number"
                      min={0}
                      value={cardDraft.numeric[key]}
                      aria-invalid={invalid}
                      onChange={(event) => cardDraft.setStat(key, event.target.value)}
                    />
                    {invalid && <FieldError>Whole number</FieldError>}
                  </Field>
                );
              })}
            </div>
            <Field>
              <FieldLabel htmlFor="new-card-tags">Tags</FieldLabel>
              <ChipInput
                id="new-card-tags"
                value={cardDraft.tags}
                onChange={setTags}
                placeholder="Press Enter or comma to add"
              />
            </Field>
          </FieldGroup>
        </fieldset>
      </RecordSection>

      <RecordSection
        title="First printing"
        actions={
          <span className="flex items-center gap-2">
            <Checkbox
              id="new-card-with-printing"
              checked={withPrinting}
              disabled={pending}
              onCheckedChange={setWithPrinting}
            />
            <Label htmlFor="new-card-with-printing">Create it with the card</Label>
          </span>
        }
      >
        {withPrinting ? (
          <>
            <CreationPanel draft={draft} onChange={setDraftEdit} disabled={pending} />
            {printingIssues.length > 0 && (
              <p className="text-muted-foreground mt-2 text-sm">
                Still needed: {printingIssues.map((issue) => issue.message).join(" ")}
              </p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">
            Only the card is created. Add printings under Printings later.
          </p>
        )}
      </RecordSection>
    </RecordPane>
  );
}
