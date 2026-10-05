import { ParaglideMessage } from "@inlang/paraglide-js-react";
import type { ListResponse } from "@openrift/shared/types/api/list";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { PlusSquareIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  PageDescription,
  PageTopBar,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { CountPill } from "@/components/ui/count-pill";
import { Input } from "@/components/ui/input";
import { RadioGroup } from "@/components/ui/radio-group";
import { RadioOptionRow } from "@/components/ui/radio-option-row";
import { RowList } from "@/components/ui/row-list";
import { TextLink } from "@/components/ui/text-link";
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
} from "@/features/collections/lib/import-flow-shared";
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
import { sendInBatches } from "@/lib/send-in-batches";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const NEW_LIST = "__new__";

export function CardmarketPicksImportPage() {
  const { hash } = useLocation();
  const payload = parsePicksHash(hash);

  return (
    <>
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarTitle>{m.extension_picks_title()}</PageTopBarTitle>
        </PageTopBar>
      </PageTopBarSticky>

      <div className={cn(PAGE_WIDTH.capped, "px-safe flex flex-col gap-8 pt-3 pb-12")}>
        <PageDescription>{m.extension_picks_description()}</PageDescription>

        {payload === undefined ? <NothingPicked /> : <PicksReview payload={payload} />}
      </div>
    </>
  );
}

function NothingPicked() {
  return (
    <SettingsSection title={m.extension_picks_nothing_title()}>
      <p className="text-muted-foreground text-sm">
        <ParaglideMessage
          message={m.extension_picks_nothing_body}
          markup={{
            link: ({ children }) => (
              <TextLink render={<Link to="/help/$slug" params={{ slug: "browser-extension" }} />}>
                {children}
              </TextLink>
            ),
          }}
        />
      </p>
    </SettingsSection>
  );
}

function PicksReview({ payload }: { payload: CardmarketPicksPayload }) {
  const { printingsById } = useCards();
  const resolution = useCardmarketPicksResolution(picksToResolveRows(payload));

  if (resolution.isError) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm">{m.extension_picks_match_error()}</p>
        <Button variant="outline" size="sm" onClick={() => void resolution.refetch()}>
          {m.extension_picks_try_again()}
        </Button>
      </div>
    );
  }
  if (resolution.data === undefined) {
    return <p className="text-muted-foreground text-sm">{m.extension_picks_matching()}</p>;
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
    <SettingsSection title={m.extension_picks_save_to()}>
      <RadioGroup
        value={choice.selected}
        onValueChange={(value) => onChange({ ...choice, selected: String(value) })}
      >
        <RadioOptionRow
          className="-mx-2"
          value={NEW_LIST}
          title={m.extension_picks_new_list()}
          meta={<PlusSquareIcon className="text-muted-foreground size-4 shrink-0" />}
        />
        {lists.map((list) => (
          <RadioOptionRow
            key={list.id}
            className="-mx-2"
            value={list.id}
            title={list.name}
            meta={<CountPill>{list.entryCount}</CountPill>}
          />
        ))}
      </RadioGroup>
      {choice.selected === NEW_LIST ? (
        <Input
          value={choice.newName}
          onChange={(event) => onChange({ ...choice, newName: event.target.value })}
          placeholder={m.extension_picks_list_name()}
          aria-label={m.extension_picks_list_name()}
          maxLength={200}
        />
      ) : null}
      <p className="text-muted-foreground text-sm">{m.extension_picks_organize_note()}</p>
    </SettingsSection>
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
    await sendInBatches(
      buildListImportPayload(importableEntries, "printing"),
      IMPORT_BATCH_SIZE,
      (entries) => bulkAdd.mutateAsync({ listId, entries }),
    );
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
      toast.error(m.extension_picks_save_failed());
      setIsSaving(false);
      return;
    }
    toast.success(m.extension_picks_added({ count: summary.totalCards }));
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
    <div className="flex min-w-0 flex-col gap-8">
      <div className="flex min-w-0 flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          <ParaglideMessage
            message={m.extension_picks_picked_from}
            inputs={{ count: matchedEntries.length, seller }}
            markup={{
              strong: ({ children }) => (
                <span className="text-foreground font-medium">{children}</span>
              ),
            }}
          />
        </p>

        {problematicEntries.length > 0 && (
          <RowList>
            {problematicEntries.map(({ entry, index }) => (
              <li key={`${entry.entry.cardName}-${index}`}>{renderRow({ entry, index })}</li>
            ))}
          </RowList>
        )}

        <ImportExactMatchesDisclosure count={exactEntries.length}>
          {exactEntries.map((item) => renderRow(item))}
        </ImportExactMatchesDisclosure>
      </div>

      <TargetPicker lists={printingLists} choice={choice} onChange={setChoice} />

      <Callout className="flex flex-wrap items-center justify-between gap-3">
        <ImportStatusBadges
          readyCount={summary.readyCount}
          toVerifyCount={summary.toVerifyCount}
          needsAttentionCount={summary.needsAttentionCount}
          skippedCount={skippedCount}
        />
        <Button disabled={!canSave} pending={isSaving} onClick={() => void handleSave()}>
          {isSaving ? m.common_saving() : m.extension_picks_save({ count: summary.totalCards })}
        </Button>
      </Callout>
    </div>
  );
}
