import type { DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";
import { enumLabel } from "@openrift/shared/enum-label";
import { useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TextLink } from "@/components/ui/text-link";
import { useUploadPrintingImage } from "@/features/admin/hooks/use-admin-image-mutations";
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
import { CardSearchDropdown } from "@/features/cards/components/card-search-dropdown";
import { useCards } from "@/features/cards/hooks/use-cards";
import { useCatalogCardSearch } from "@/features/cards/hooks/use-catalog-card-search";
import { catalogKeys, cardsKeys, promosKeys } from "@/features/cards/lib/cards-query-keys";
import { draftImageLabel } from "@/features/catalog-workspace/components/creation/creation-images";
import { CreationPanel } from "@/features/catalog-workspace/components/creation/creation-panel";
import {
  RecordHeader,
  RecordPane,
  RecordSection,
} from "@/features/catalog-workspace/components/record/record-pane";
import type {
  CreationDraft,
  PlannedImageUpload,
} from "@/features/catalog-workspace/lib/creation-draft";
import {
  draftFromBasePrinting,
  draftFromDeskPrinting,
  duplicateProbeFromDeskRow,
  findDuplicateCandidates,
  plannedImageUploads,
  toDeskCreateInput,
  validateDraft,
} from "@/features/catalog-workspace/lib/creation-draft";
import type { PrintingPrefill } from "@/features/catalog-workspace/lib/workspace-search";
import { useEffectiveLanguageOrder } from "@/hooks/use-effective-language-order";
import { useEnumOrders } from "@/hooks/use-enums";
import { useSession } from "@/hooks/use-session";
import { errorText } from "@/lib/error-text";

const routeApi = getRouteApi("/_app/_authenticated/admin/workspace/printings/create");

const IMAGE_SCOPE = [
  adminKeys.printingDesk.all,
  adminKeys.cards.all,
  adminKeys.workspace,
  catalogKeys.all,
  cardsKeys.all,
  promosKeys.all,
] as const;

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

async function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    return { ok: false, error };
  }
}

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

function CardSearch({ onPick }: { onPick: (cardSlug: string) => void }) {
  const [query, setQuery] = useState("");
  const results = useCatalogCardSearch(query);
  const { cardsById } = useCards();

  return (
    <CardSearchDropdown
      results={results}
      onSearch={setQuery}
      onSelect={(cardId) => {
        const slug = cardsById[cardId]?.slug;
        if (slug) {
          onPick(slug);
        }
      }}
      placeholder="Search the catalog…"
      className="w-full"
    />
  );
}

function HeaderActions({
  onCancel,
  onCreate,
  canCreate,
}: {
  onCancel: () => void;
  onCreate?: () => void;
  canCreate: boolean;
}) {
  return (
    <>
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      <Button disabled={!canCreate} onClick={onCreate}>
        Create printing
      </Button>
    </>
  );
}

function rowSummary(row: DeskPrintingRow, finishLabel: string): string {
  return [row.language, finishLabel, ...row.distributionChannelSlugs].join(" · ");
}

function ExistingPrintings({
  cardName,
  rows,
  onPick,
}: {
  cardName: string;
  rows: readonly DeskPrintingRow[];
  onPick?: (row: DeskPrintingRow) => void;
}) {
  const { labels } = useEnumOrders();

  return (
    <RecordSection title={onPick ? "Which printing do you copy?" : `${cardName} already has`}>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">No printings yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <li
              key={`${row.printingId}:${row.side}`}
              className="flex flex-wrap items-center gap-2.5"
            >
              <span className="w-36 font-mono text-sm">{deskPrintingCodes(row)}</span>
              <span className="text-muted-foreground flex-1">
                {rowSummary(row, enumLabel(labels.finishes, row.finish))}
              </span>
              {onPick && (
                <Button variant="outline" size="sm" onClick={() => onPick(row)}>
                  Copy
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </RecordSection>
  );
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const createPrinting = useCreateDeskPrinting();
  const uploadImage = useUploadPrintingImage(IMAGE_SCOPE);
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
  const credit = session?.user.name;

  function uploadOne(printingId: string, upload: PlannedImageUpload, file: File) {
    return uploadImage.mutateAsync({
      printingId,
      file,
      mode: upload.mode,
      face: upload.face,
      credit: credit !== undefined && credit.length > 0 ? credit : undefined,
    });
  }

  async function create() {
    if (!canCreate) {
      return;
    }
    setPending(true);
    setError(null);
    const created = await settle(createPrinting.mutateAsync(toDeskCreateInput(draft)));
    if (!created.ok) {
      setPending(false);
      setError(errorText(created.error, "Could not create the printing."));
      return;
    }
    const { printingId } = created.value;
    setCreatedId(printingId);
    const failed: string[] = [];
    for (const upload of plannedImageUploads(draft)) {
      if (upload.image.kind !== "file") {
        continue;
      }
      const result = await settle(uploadOne(printingId, upload, upload.image.file));
      if (!result.ok) {
        failed.push(draftImageLabel(upload.image));
      }
    }
    await queryClient.invalidateQueries({ queryKey: adminKeys.workspace });
    setPending(false);
    if (failed.length > 0) {
      setError(`The printing was created, but ${failed.join(", ")} did not upload.`);
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
              onCreate={() => void create()}
              canCreate={canCreate}
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
      <ExistingPrintings cardName={cardName} rows={rows} />
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
  prefill: Pick<PrintingPrefill, "language" | "finish">;
  onChangeCard: () => void;
  onCancel: () => void;
}) {
  const { data } = useDeskCardPrintings(cardSlug);
  const { orders } = useEnumOrders();
  const preferred = useEffectiveLanguageOrder();
  const [copyFrom, setCopyFrom] = useState<DeskPrintingRow | null>(null);
  const card = { id: data.card.id, slug: data.card.slug, name: data.card.name };
  const rows = data.printings;

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
        <ExistingPrintings cardName={card.name} rows={rows} onPick={setCopyFrom} />
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
  const prefill = routeApi.useSearch();
  const [cardSlug, setCardSlug] = useState<string | null>(prefill.card ?? null);
  const [duplicate, setDuplicate] = useState(false);

  function cancel() {
    void navigate({ to: "/admin/workspace/printings" });
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
            <CardSearch onPick={setCardSlug} />
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
