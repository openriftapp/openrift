import type { ListResponse } from "@openrift/shared/types/api/list";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Loader2Icon, PlusSquareIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  PageDescription,
  PageTopBar,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCards } from "@/features/cards/hooks/use-cards";
import { ImportEntryRow } from "@/features/collections/components/import-entry-row";
import {
  ImportExactMatchesDisclosure,
  ImportStatusBadges,
} from "@/features/collections/components/import-preview-chrome";
import {
  createImportEntryHandlers,
  deriveImportSummary,
  IMPORT_BATCH_SIZE,
} from "@/features/collections/hooks/import-flow-shared";
import type { MatchedEntry } from "@/features/collections/lib/import-matcher";
import { partitionMatchedEntries } from "@/features/collections/lib/import-summary";
import { useCardmarketPicksResolution } from "@/features/extension/hooks/use-cardmarket-picks";
import type { CardmarketPicksPayload } from "@/features/extension/lib/cardmarket-picks-payload";
import {
  defaultPicksListName,
  matchedEntriesFromPicks,
  parsePicksHash,
  picksToResolveRows,
} from "@/features/extension/lib/cardmarket-picks-payload";
import { buildListImportPayload } from "@/features/lists/hooks/use-list-import-flow";
import { useBulkAddListEntries, useCreateList, useLists } from "@/features/lists/hooks/use-lists";
import { cn, PAGE_WIDTH } from "@/lib/utils";

const NEW_LIST = "__new__";

export function CardmarketPicksImportPage() {
  const { hash } = useLocation();
  const payload = parsePicksHash(hash);

  return (
    <>
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarTitle>Cards picked on Cardmarket</PageTopBarTitle>
        </PageTopBar>
      </PageTopBarSticky>

      <div className={cn(PAGE_WIDTH.capped, "space-y-4 px-4 pt-3 pb-12")}>
        <PageDescription>
          The cards you picked on a seller&apos;s Cardmarket offers with the OpenRift extension,
          ready to become a list you can share with them.
        </PageDescription>

        {payload === undefined ? <NothingPicked /> : <PicksReview payload={payload} />}
      </div>
    </>
  );
}

function NothingPicked() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <p>Nothing has been handed over.</p>
        <p className="text-muted-foreground text-sm">
          Open a seller&apos;s offers on Cardmarket, press + on the cards you want, then choose
          &quot;Send to OpenRift&quot; from the extension popup. See{" "}
          <Link
            to="/help/$slug"
            params={{ slug: "deck-importer-extension" }}
            className="text-primary hover:underline"
          >
            how the extension works
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}

function PicksReview({ payload }: { payload: CardmarketPicksPayload }) {
  const { printingsById } = useCards();
  const resolution = useCardmarketPicksResolution(picksToResolveRows(payload));

  if (resolution.isError) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm">Your picks could not be matched to cards.</p>
        <Button variant="outline" size="sm" onClick={() => void resolution.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  if (resolution.data === undefined) {
    return <p className="text-muted-foreground text-sm">Matching your picks…</p>;
  }
  return (
    <PicksEditor
      seller={payload.seller}
      initialEntries={matchedEntriesFromPicks(payload, resolution.data, printingsById)}
    />
  );
}

interface TargetChoice {
  selected: string;
  newName: string;
}

function TargetPicker({
  lists,
  choice,
  onChange,
}: {
  lists: ListResponse[];
  choice: TargetChoice;
  onChange: (choice: TargetChoice) => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <p className="font-medium">Save to</p>
        <RadioGroup
          value={choice.selected}
          onValueChange={(value) => onChange({ ...choice, selected: String(value) })}
        >
          <label
            htmlFor="picks-target-new"
            className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-md px-2 py-2"
          >
            <RadioGroupItem id="picks-target-new" value={NEW_LIST} />
            <span className="flex-1 font-medium">New list</span>
            <PlusSquareIcon className="text-muted-foreground size-4 shrink-0" />
          </label>
          {lists.map((list) => (
            <label
              key={list.id}
              htmlFor={`picks-target-${list.id}`}
              className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-md px-2 py-2"
            >
              <RadioGroupItem id={`picks-target-${list.id}`} value={list.id} />
              <span className="min-w-0 flex-1 truncate font-medium">{list.name}</span>
              <span className="text-muted-foreground shrink-0 text-xs">
                {list.entryCount} {list.entryCount === 1 ? "card" : "cards"}
              </span>
            </label>
          ))}
        </RadioGroup>
        {choice.selected === NEW_LIST ? (
          <Input
            value={choice.newName}
            onChange={(event) => onChange({ ...choice, newName: event.target.value })}
            placeholder="List name"
            aria-label="List name"
            maxLength={200}
          />
        ) : null}
        <p className="text-muted-foreground text-sm">
          Picks go to an organize list, so your wishlists stay as they are.
        </p>
      </CardContent>
    </Card>
  );
}

function PicksEditor({
  seller,
  initialEntries,
}: {
  seller: string;
  initialEntries: MatchedEntry[];
}) {
  const { allPrintings } = useCards();
  const { data: organizeLists } = useLists("organize");
  const createList = useCreateList();
  const bulkAdd = useBulkAddListEntries();
  const navigate = useNavigate();

  const [matchedEntries, setMatchedEntries] = useState(initialEntries);
  const [skippedIndices, setSkippedIndices] = useState<Set<number>>(new Set());
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());
  const [choice, setChoice] = useState<TargetChoice>({
    selected: NEW_LIST,
    newName: defaultPicksListName(seller),
  });
  const [isSaving, setIsSaving] = useState(false);

  const printingLists = organizeLists.filter((list) => list.kind === "printing");
  const { handleResolve, handleSkip, handleUnskip, handleToggleExpand } = createImportEntryHandlers(
    setMatchedEntries,
    setSkippedIndices,
    setExpandedIndices,
  );
  const { importableEntries, summary, skippedCount } = deriveImportSummary(
    matchedEntries,
    skippedIndices,
  );
  const { problematicEntries, exactEntries } = partitionMatchedEntries(matchedEntries);

  const newName = choice.newName.trim();
  const canSave =
    importableEntries.length > 0 && (choice.selected !== NEW_LIST || newName.length > 0);

  const targetListId = async (): Promise<string> => {
    if (choice.selected !== NEW_LIST) {
      return choice.selected;
    }
    const created = await createList.mutateAsync({
      name: newName,
      intent: "organize",
      kind: "printing",
    });
    return created.id;
  };

  const addAll = async (listId: string) => {
    const entries = buildListImportPayload(importableEntries, "printing");
    for (let offset = 0; offset < entries.length; offset += IMPORT_BATCH_SIZE) {
      await bulkAdd.mutateAsync({
        listId,
        entries: entries.slice(offset, offset + IMPORT_BATCH_SIZE),
      });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    let listId: string;
    try {
      listId = await targetListId();
    } catch {
      // Reported by the global mutation error toast.
      setIsSaving(false);
      return;
    }
    try {
      await addAll(listId);
    } catch {
      // Deliberate second toast on top of the global mutation error one: this says the
      // save was left half-done (batches before the failing one already committed).
      toast.error("Saving failed. Some cards may have been added.");
      setIsSaving(false);
      return;
    }
    toast.success(
      `Added ${summary.totalCards} ${summary.totalCards === 1 ? "card" : "cards"} to the list.`,
    );
    void navigate({ to: "/collections/lists/$listId", params: { listId } });
  };

  const renderRow = ({ entry, index }: { entry: MatchedEntry; index: number }) => (
    <ImportEntryRow
      key={`${entry.entry.cardName}-${index}`}
      entry={entry}
      allPrintings={allPrintings}
      index={index}
      isSkipped={skippedIndices.has(index)}
      isExpanded={expandedIndices.has(index)}
      onResolve={handleResolve}
      onSkip={handleSkip}
      onUnskip={handleUnskip}
      onToggleExpand={handleToggleExpand}
    />
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        {matchedEntries.length} {matchedEntries.length === 1 ? "card" : "cards"} picked from{" "}
        <span className="text-foreground font-medium">{seller}</span>.
      </p>

      {problematicEntries.length > 0 && (
        <div className="divide-border divide-y rounded-md border">
          {problematicEntries.map((item) => renderRow(item))}
        </div>
      )}

      <ImportExactMatchesDisclosure count={exactEntries.length}>
        {exactEntries.map((item) => renderRow(item))}
      </ImportExactMatchesDisclosure>

      <TargetPicker lists={printingLists} choice={choice} onChange={setChoice} />

      <div className="bg-muted/30 flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
        <ImportStatusBadges
          readyCount={summary.readyCount}
          toVerifyCount={summary.toVerifyCount}
          needsAttentionCount={summary.needsAttentionCount}
          skippedCount={skippedCount}
        />
        <Button disabled={!canSave || isSaving} onClick={() => void handleSave()}>
          {isSaving ? (
            <>
              <Loader2Icon className="size-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              Save {summary.totalCards} {summary.totalCards === 1 ? "card" : "cards"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
