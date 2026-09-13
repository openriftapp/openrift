import { ParaglideMessage } from "@inlang/paraglide-js-react";
import type { ListResponse } from "@openrift/shared/types/api/list";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Loader2Icon, PlusSquareIcon } from "lucide-react";
import type { ReactNode } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
        <TargetOption id="picks-target-new" value={NEW_LIST} label={m.extension_picks_new_list()}>
          <PlusSquareIcon className="text-muted-foreground size-4 shrink-0" />
        </TargetOption>
        {lists.map((list) => (
          <TargetOption
            key={list.id}
            id={`picks-target-${list.id}`}
            value={list.id}
            label={list.name}
          >
            <CountPill>{list.entryCount}</CountPill>
          </TargetOption>
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

function TargetOption({
  id,
  value,
  label,
  children,
}: {
  id: string;
  value: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      className="hover:bg-muted/50 -mx-2 flex cursor-pointer items-center gap-3 rounded-md px-2 py-1"
    >
      <RadioGroupItem id={id} value={value} />
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      {children}
    </label>
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
        <Button disabled={!canSave || isSaving} onClick={() => void handleSave()}>
          {isSaving ? (
            <>
              <Loader2Icon className="size-4 animate-spin" />
              {m.extension_picks_saving()}
            </>
          ) : (
            m.extension_picks_save({ count: summary.totalCards })
          )}
        </Button>
      </Callout>
    </div>
  );
}
