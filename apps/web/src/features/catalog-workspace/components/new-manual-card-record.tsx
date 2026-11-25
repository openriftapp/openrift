import { WellKnown } from "@openrift/shared/well-known";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldGroup } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { TextLink } from "@/components/ui/text-link";
import { ManualCardFields } from "@/features/admin/components/manual-card-fields";
import { useCreateCard } from "@/features/admin/hooks/use-admin-card-mutations";
import { useManualCardDraft } from "@/features/admin/hooks/use-manual-card-draft";
import { useCreateDeskPrinting } from "@/features/admin/hooks/use-printing-desk";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { readCreatedCardId } from "@/features/admin/lib/created-card-id";
import { CreationPanel } from "@/features/catalog-workspace/components/creation/creation-panel";
import {
  RecordHeader,
  RecordPane,
  RecordSection,
} from "@/features/catalog-workspace/components/record/record-pane";
import { useCreationFollowUps } from "@/features/catalog-workspace/hooks/use-printing-creation";
import { useRegisterRecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import type { CreationDraft } from "@/features/catalog-workspace/lib/creation-draft";
import {
  draftFromBasePrinting,
  toDeskCreateInput,
  validateDraft,
} from "@/features/catalog-workspace/lib/creation-draft";
import { useEffectiveLanguageOrder } from "@/hooks/use-effective-language-order";
import { useEnumOrders } from "@/hooks/use-enums";
import { errorText } from "@/lib/error-text";
import { runReportedMutation } from "@/lib/run-reported-mutation";

function asExistingCard(draft: CreationDraft, id: string, slug: string, name: string) {
  return { ...draft, card: { mode: "existing" as const, id, slug, name } };
}

export function NewManualCardRecord() {
  const queueWrite = useQueueWorkspaceWrite();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createCard = useCreateCard();
  const createPrinting = useCreateDeskPrinting({ inlineError: true });
  const followUps = useCreationFollowUps();
  const { orders } = useEnumOrders();
  const preferredLanguages = useEffectiveLanguageOrder();

  const cardDraft = useManualCardDraft();
  const { name, slug, input } = cardDraft;
  const [withPrinting, setWithPrinting] = useState(true);
  const [draftEdit, setDraftEdit] = useState<CreationDraft | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  useRegisterRecordActions({});

  const baseDraft: CreationDraft = {
    ...draftFromBasePrinting({ id: "", slug: "", name: "" }, undefined, {
      language: preferredLanguages.at(0) ?? WellKnown.language.EN,
      finish: orders.finishes[0] ?? "",
      size: orders.cardSizes[0] ?? "",
    }),
    pickRarity: true,
  };
  const draft: CreationDraft = {
    ...(draftEdit ?? baseDraft),
    card: { mode: "new", slug, name: name.trim(), summary: "" },
  };
  const printingIssues = validateDraft(asExistingCard(draft, "pending", slug, name.trim()));
  const canCreate =
    input !== undefined &&
    (!withPrinting || printingIssues.length === 0) &&
    !pending &&
    createdSlug === null &&
    !createCard.isPending;

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
    return followUps.finish(signal, created.printingId, ready, { fields: false, urls: false });
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
      setCreatedSlug(cardSlug);
      setNotice(printingError);
      return;
    }
    void navigate({ to: "/admin/workspace/cards/$cardSlug", params: { cardSlug } });
  }

  function requestCreate() {
    if (!canCreate) {
      return;
    }
    setPending(true);
    void queueWrite(create, { limit: "upload" });
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
              <Button disabled={!canCreate} pending={pending} onClick={requestCreate}>
                Create card
              </Button>
            </>
          }
        />
      }
    >
      {notice !== null && (
        <Alert variant="destructive">
          <AlertDescription>
            {notice}
            {createdSlug !== null && (
              <>
                {" "}
                <TextLink
                  render={
                    <Link
                      to="/admin/workspace/cards/$cardSlug"
                      params={{ cardSlug: createdSlug }}
                    />
                  }
                >
                  Open the card
                </TextLink>
              </>
            )}
          </AlertDescription>
        </Alert>
      )}
      <RecordSection title="Card fields">
        <fieldset disabled={pending || createdSlug !== null} className="min-w-0">
          <FieldGroup>
            <ManualCardFields draft={cardDraft} idPrefix="new-card" />
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
              disabled={pending || createdSlug !== null}
              onCheckedChange={setWithPrinting}
            />
            <Label htmlFor="new-card-with-printing">Create it with the card</Label>
          </span>
        }
      >
        {withPrinting ? (
          <>
            <CreationPanel
              draft={draft}
              onChange={setDraftEdit}
              disabled={pending || createdSlug !== null}
            />
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
