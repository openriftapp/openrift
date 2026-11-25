import type { DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";
import { useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link, useLocation, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TextLink } from "@/components/ui/text-link";
import {
  useCreateDeskPrinting,
  useDeskCardPrintings,
} from "@/features/admin/hooks/use-printing-desk";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { deskPrintingCodes, deskPrintingName } from "@/features/admin/lib/desk-face-options";
import {
  basePrintingForLanguage,
  defaultCardLanguage,
} from "@/features/admin/lib/printing-desk-base";
import { CatalogCardSlugSearch } from "@/features/cards/components/catalog-card-slug-search";
import { CreationPanel } from "@/features/catalog-workspace/components/creation/creation-panel";
import type { ExistingPrinting } from "@/features/catalog-workspace/components/record/existing-printings-section";
import { ExistingPrintingsSection } from "@/features/catalog-workspace/components/record/existing-printings-section";
import {
  RecordHeader,
  RecordPane,
  RecordSection,
} from "@/features/catalog-workspace/components/record/record-pane";
import { useCreationFollowUps } from "@/features/catalog-workspace/hooks/use-printing-creation";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import type { CreationDraft } from "@/features/catalog-workspace/lib/creation-draft";
import {
  draftFromBasePrinting,
  draftFromDeskPrinting,
  duplicateProbeFromDeskRow,
  duplicateSource,
  findDuplicateCandidates,
  toDeskCreateInput,
  validateDraft,
} from "@/features/catalog-workspace/lib/creation-draft";
import { stopNavigation } from "@/features/catalog-workspace/lib/review-stops";
import type { PrintingPrefill } from "@/features/catalog-workspace/lib/workspace-search";
import { useEffectiveLanguageOrder } from "@/hooks/use-effective-language-order";
import { useEnumOrders } from "@/hooks/use-enums";
import { errorText } from "@/lib/error-text";
import { runReportedMutation } from "@/lib/run-reported-mutation";

const routeApi = getRouteApi("/_app/_authenticated/admin/workspace/printings/create");

function StepTitle({ step, children }: { step: number; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <Badge variant="secondary">{step}</Badge>
      {children}
    </span>
  );
}

function PendingStep({ step, title, hint }: { step: number; title: string; hint: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border px-4 py-3 opacity-60">
      <StepTitle step={step}>
        <span className="font-semibold">{title}</span>
      </StepTitle>
      <span className="text-muted-foreground ml-auto text-sm">{hint}</span>
    </div>
  );
}

function HeaderActions({
  onCancel,
  onCreate,
  canCreate,
  pending = false,
}: {
  onCancel: () => void;
  onCreate?: () => void;
  canCreate: boolean;
  pending?: boolean;
}) {
  return (
    <>
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      <Button disabled={!canCreate} pending={pending} onClick={onCreate}>
        Create printing
      </Button>
    </>
  );
}

function existingFromDesk(
  rows: readonly DeskPrintingRow[],
  onPick?: (row: DeskPrintingRow) => void,
): ExistingPrinting[] {
  return rows.map((row) => ({
    ...row,
    key: `${row.printingId}:${row.side}`,
    code: deskPrintingCodes(row),
    handleCopy: onPick === undefined ? undefined : () => onPick(row),
  }));
}

function DraftEditor({
  initialDraft,
  rows,
  cardName,
  onChangeCard,
  onCancel,
}: {
  initialDraft: CreationDraft;
  rows: readonly DeskPrintingRow[];
  cardName: string;
  onChangeCard: () => void;
  onCancel: () => void;
}) {
  const queueWrite = useQueueWorkspaceWrite();
  const navigate = useNavigate();
  const trail = useLocation({ select: (location) => location.state.workspaceReview });
  const queryClient = useQueryClient();
  const createPrinting = useCreateDeskPrinting({ inlineError: true });
  const followUps = useCreationFollowUps();
  const [draft, setDraft] = useState(initialDraft);
  const [pending, setPending] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const issues = validateDraft(draft);
  const duplicates = findDuplicateCandidates(
    draft,
    rows.map((row) => duplicateProbeFromDeskRow(row)),
  );
  const canCreate = issues.length === 0 && !pending && createdId === null;

  async function create(signal: AbortSignal) {
    if (!canCreate) {
      return;
    }
    setPending(true);
    setError(null);
    let created: Awaited<ReturnType<typeof createPrinting.mutateAsync>> | undefined;
    const ok = await runReportedMutation(
      async () => {
        created = await createPrinting.mutateAsync(toDeskCreateInput(draft), { signal });
      },
      (failure) => setError(errorText(failure, "Could not create the printing.")),
    );
    if (!ok || !created) {
      setPending(false);
      return;
    }
    const { printingId } = created;
    setCreatedId(printingId);
    const failure = await followUps.finish(signal, printingId, draft, {
      fields: false,
      urls: false,
    });
    await queryClient.invalidateQueries({ queryKey: adminKeys.workspace });
    setPending(false);
    if (failure !== null) {
      setError(failure);
      return;
    }
    if (trail !== undefined && trail.cardSlug === draft.card?.slug) {
      void navigate(stopNavigation({ kind: "card" }, trail));
      return;
    }
    void navigate({ to: "/admin/workspace/printings/$printingId", params: { printingId } });
  }

  return (
    <RecordPane
      header={
        <RecordHeader
          title="New printing"
          subtitle={createdId === null ? "Not saved" : "Created"}
          actions={
            <HeaderActions
              onCancel={onCancel}
              onCreate={() => void queueWrite(create, { limit: "upload" })}
              canCreate={canCreate}
              pending={pending}
            />
          }
        />
      }
    >
      {error !== null && (
        <Alert variant="destructive">
          <AlertDescription>
            {error}
            {createdId !== null && (
              <>
                {" "}
                <TextLink
                  render={
                    <Link
                      to="/admin/workspace/printings/$printingId"
                      params={{ printingId: createdId }}
                    />
                  }
                >
                  Open the printing
                </TextLink>
              </>
            )}
          </AlertDescription>
        </Alert>
      )}
      <RecordSection
        title={<StepTitle step={1}>Card</StepTitle>}
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={pending || createdId !== null}
            onClick={onChangeCard}
          >
            Change
          </Button>
        }
      >
        <p className="font-semibold">{cardName}</p>
      </RecordSection>
      <ExistingPrintingsSection
        title={`${cardName} already has`}
        printings={existingFromDesk(rows)}
      />
      <CreationPanel
        draft={draft}
        onChange={setDraft}
        duplicateCandidates={duplicates}
        layout="steps"
        disabled={pending || createdId !== null}
      />
      {issues.length > 0 && (
        <p className="text-muted-foreground text-sm">
          Still needed: {issues.map((issue) => issue.message).join(" ")}
        </p>
      )}
      <p className="text-muted-foreground text-sm">Goes live as soon as you create it.</p>
    </RecordPane>
  );
}

function PickedCard({
  cardSlug,
  duplicate,
  prefill,
  onChangeCard,
  onCancel,
}: {
  cardSlug: string;
  duplicate: boolean;
  prefill: Pick<PrintingPrefill, "language" | "finish" | "duplicateFrom">;
  onChangeCard: () => void;
  onCancel: () => void;
}) {
  const { data } = useDeskCardPrintings(cardSlug);
  const { orders } = useEnumOrders();
  const preferred = useEffectiveLanguageOrder();
  const rows = data.printings;
  const [copyFrom, setCopyFrom] = useState<DeskPrintingRow | null>(() =>
    duplicateSource(rows, duplicate ? prefill.duplicateFrom : undefined),
  );
  const card = { id: data.card.id, slug: data.card.slug, name: data.card.name };

  if (duplicate && copyFrom === null) {
    return (
      <RecordPane
        header={
          <RecordHeader
            title="New printing"
            subtitle="Not saved"
            actions={<HeaderActions onCancel={onCancel} canCreate={false} />}
          />
        }
      >
        <RecordSection
          title={<StepTitle step={1}>{card.name}</StepTitle>}
          actions={
            <Button variant="outline" size="sm" onClick={onChangeCard}>
              Change
            </Button>
          }
        >
          <p className="text-muted-foreground">
            Copy a printing for another promo of the same face. Change what differs in the next
            steps.
          </p>
        </RecordSection>
        <ExistingPrintingsSection
          title="Which printing do you copy?"
          printings={existingFromDesk(rows, setCopyFrom)}
        />
      </RecordPane>
    );
  }

  const language =
    prefill.language ??
    defaultCardLanguage(
      rows.map((row) => row.language),
      preferred,
    );
  const initialDraft =
    copyFrom === null
      ? draftFromBasePrinting(
          card,
          basePrintingForLanguage(rows, language),
          {
            language,
            finish: prefill.finish ?? orders.finishes[0] ?? "",
            size: orders.cardSizes[0] ?? "",
          },
          prefill.finish === undefined ? {} : { finish: prefill.finish },
        )
      : draftFromDeskPrinting(card, copyFrom);

  return (
    <DraftEditor
      key={copyFrom?.printingId ?? "base"}
      initialDraft={initialDraft}
      rows={rows}
      cardName={
        copyFrom === null ? card.name : `${card.name} · copy of ${deskPrintingName(copyFrom)}`
      }
      onChangeCard={onChangeCard}
      onCancel={onCancel}
    />
  );
}

const PENDING_STEPS = [
  { step: 2, title: "Faces", hint: "New face or pick an existing one" },
  { step: 3, title: "Images", hint: "Photos for each face" },
  { step: 4, title: "Printing details", hint: "Channel, size, dates" },
] as const;

export function ManualPrintingRecord() {
  const navigate = useNavigate();
  const trail = useLocation({ select: (location) => location.state.workspaceReview });
  const prefill = routeApi.useSearch();
  const [cardSlug, setCardSlug] = useState<string | null>(prefill.card ?? null);
  const [duplicate, setDuplicate] = useState(prefill.duplicateFrom !== undefined);

  function cancel() {
    void navigate(
      trail === undefined
        ? { to: "/admin/workspace/printings" }
        : stopNavigation({ kind: "card" }, trail),
    );
  }

  if (cardSlug !== null) {
    return (
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <PickedCard
          key={`${cardSlug}:${String(duplicate)}`}
          cardSlug={cardSlug}
          duplicate={duplicate}
          prefill={cardSlug === prefill.card ? prefill : {}}
          onChangeCard={() => setCardSlug(null)}
          onCancel={cancel}
        />
      </Suspense>
    );
  }

  return (
    <RecordPane
      header={
        <RecordHeader
          title="New printing"
          subtitle="Not saved"
          actions={<HeaderActions onCancel={cancel} canCreate={false} />}
        />
      }
    >
      <RecordSection
        title={
          <StepTitle step={1}>
            {duplicate ? "Which card's printing do you copy?" : "Which card is it?"}
          </StepTitle>
        }
      >
        <div className="flex flex-col gap-2.5">
          <Suspense fallback={<Skeleton className="h-8 w-full" />}>
            <CatalogCardSlugSearch onPick={setCardSlug} />
          </Suspense>
          <p>
            <Button variant="link" className="h-auto p-0" onClick={() => setDuplicate(!duplicate)}>
              {duplicate ? "Start from the card instead" : "Or duplicate an existing printing"}
            </Button>{" "}
            {!duplicate && (
              <span className="text-muted-foreground">for another promo of the same face.</span>
            )}
          </p>
          <p className="text-muted-foreground text-sm">
            The next step shows the printings this card already has, so you can check it is not
            there yet.
          </p>
        </div>
      </RecordSection>
      {PENDING_STEPS.map((pendingStep) => (
        <PendingStep key={pendingStep.step} {...pendingStep} />
      ))}
    </RecordPane>
  );
}
