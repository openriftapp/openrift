import { enumLabel } from "@openrift/shared/enum-label";
import { slugifyName } from "@openrift/shared/strings";
import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";
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
import { useCreateDeskPrinting } from "@/features/admin/hooks/use-printing-desk";
import { adminCardDetailQueryOptions } from "@/features/admin/lib/admin-card-queries";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { parseIntegerFields, parseIntegerInput } from "@/features/admin/lib/integer-input";
import { catalogKeys, cardsKeys, promosKeys } from "@/features/cards/lib/cards-query-keys";
import { draftImageLabel } from "@/features/catalog-workspace/components/creation/creation-images";
import { CreationPanel } from "@/features/catalog-workspace/components/creation/creation-panel";
import {
  RecordHeader,
  RecordPane,
  RecordSection,
} from "@/features/catalog-workspace/components/record/record-pane";
import { useRegisterRecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
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

type NumField = "might" | "energy" | "power" | "mightBonus";

const NUM_FIELDS: { key: NumField; label: string }[] = [
  { key: "might", label: "Might" },
  { key: "energy", label: "Energy" },
  { key: "power", label: "Power" },
  { key: "mightBonus", label: "Might bonus" },
];

function asExistingCard(draft: CreationDraft, id: string, slug: string, name: string) {
  return { ...draft, card: { mode: "existing" as const, id, slug, name } };
}

export function NewManualCardRecord() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const createCard = useCreateCard();
  const createPrinting = useCreateDeskPrinting({ inlineError: true });
  const uploadImage = useUploadPrintingImage(IMAGE_SCOPE);
  const { orders, labels } = useEnumOrders();
  const preferredLanguages = useEffectiveLanguageOrder();

  const [name, setName] = useState("");
  const [slugEdit, setSlugEdit] = useState<string | null>(null);
  const [types, setTypes] = useState<string[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [superTypes, setSuperTypes] = useState<string[]>([]);
  const [numeric, setNumeric] = useState<Record<NumField, string>>({
    might: "",
    energy: "",
    power: "",
    mightBonus: "",
  });
  const [tags, setTags] = useState<string[]>([]);
  const [withPrinting, setWithPrinting] = useState(true);
  const [draftEdit, setDraftEdit] = useState<CreationDraft | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useRegisterRecordActions({});

  const slug = (slugEdit ?? slugifyName(name)).trim();
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
  const stats = parseIntegerFields(numeric);
  const cardReady =
    stats !== undefined &&
    name.trim().length > 0 &&
    slug.length > 0 &&
    types.length > 0 &&
    domains.length > 0;
  const canCreate =
    cardReady &&
    (!withPrinting || printingIssues.length === 0) &&
    !pending &&
    !createCard.isPending;
  const credit = session?.user.name;

  async function createFirstPrinting(cardSlug: string): Promise<string | null> {
    let fresh: AdminCardDetailResponse | null = null;
    try {
      fresh = (await queryClient.query(
        adminCardDetailQueryOptions(cardSlug),
      )) as AdminCardDetailResponse;
    } catch {
      fresh = null;
    }
    const cardId = fresh?.card?.id;
    if (cardId === undefined) {
      return "The card was created, but its printing was not. Add it under Printings.";
    }
    const ready = asExistingCard(draft, cardId, cardSlug, name.trim());
    let created: Awaited<ReturnType<typeof createPrinting.mutateAsync>> | undefined;
    let reason = "unknown error";
    const ok = await runReportedMutation(
      async () => {
        created = await createPrinting.mutateAsync(toDeskCreateInput(ready));
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
        uploadImage.mutateAsync({
          printingId,
          file,
          mode: upload.mode,
          face: upload.face,
          credit: uploadCredit,
        }),
      );
      if (!uploaded) {
        failed.push(draftImageLabel(upload.image));
      }
    }
    return failed.length > 0
      ? `The card and its printing were created, but ${failed.join(", ")} did not upload.`
      : null;
  }

  async function create() {
    if (!canCreate) {
      return;
    }
    setPending(true);
    setNotice(null);
    const input = {
      id: slug,
      name: name.trim(),
      types,
      domains,
      ...(superTypes.length > 0 && { superTypes }),
      ...stats,
      ...(tags.length > 0 && { tags }),
    };
    let createdCard: Awaited<ReturnType<typeof createCard.mutateAsync>> | undefined;
    const ok = await runReportedMutation(
      async () => {
        createdCard = await createCard.mutateAsync(input);
      },
      (error) => setNotice(errorText(error, "Could not create the card.")),
    );
    if (!ok || !createdCard) {
      setPending(false);
      return;
    }
    const { cardSlug } = createdCard;
    const printingError = withPrinting ? await createFirstPrinting(cardSlug) : null;
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
              <Button disabled={!canCreate} pending={pending} onClick={() => void create()}>
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
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="new-card-name">Name *</FieldLabel>
              <Input
                id="new-card-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Jinx, Rebel"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-card-slug">Card ID *</FieldLabel>
              <Input
                id="new-card-slug"
                value={slugEdit ?? slugifyName(name)}
                onChange={(event) => setSlugEdit(event.target.value)}
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
              value={types}
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
              value={domains}
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
              value={superTypes}
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
            {NUM_FIELDS.map(({ key, label }) => {
              const invalid = parseIntegerInput(numeric[key]) === undefined;
              return (
                <Field key={key} data-invalid={invalid}>
                  <FieldLabel htmlFor={`new-card-${key}`}>{label}</FieldLabel>
                  <Input
                    id={`new-card-${key}`}
                    type="number"
                    min={0}
                    value={numeric[key]}
                    aria-invalid={invalid}
                    onChange={(event) => setNumeric({ ...numeric, [key]: event.target.value })}
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
              value={tags}
              onChange={setTags}
              placeholder="Press Enter or comma to add"
            />
          </Field>
        </FieldGroup>
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
