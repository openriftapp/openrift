import type { Printing } from "@openrift/shared/types/catalog";
import { Loader2Icon } from "lucide-react";
import { useState } from "react";

import {
  SectionHeader,
  SectionHeaderActions,
  SectionHeaderDescription,
  SectionHeaderGroup,
  SectionHeaderTitle,
} from "@/components/section-header";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImportEntryRow } from "@/features/collections/components/import-entry-row";
import {
  ImportExactMatchesDisclosure,
  ImportParseErrorDetails,
  ImportPreviewStack,
  ImportRowsSection,
  ImportStatusBadges,
  ImportToVerifyNote,
  ImportTroubleNote,
} from "@/features/collections/components/import-preview-chrome";
import type { ImportableListOption } from "@/features/collections/hooks/use-import-flow";
import type { MatchedEntry } from "@/features/collections/lib/import-matcher";
import { isReplaceableTarget, LIST_TARGET_PREFIX } from "@/features/collections/lib/import-replace";
import { partitionMatchedEntries } from "@/features/collections/lib/import-summary";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export interface CollectionOption {
  id: string;
  name: string;
  isInbox: boolean;
  copyCount: number;
}

export function CollectionImportPreviewStep({
  matchedEntries,
  allPrintings,
  rowCount,
  parseErrors,
  skippedIndices,
  expandedIndices,
  collections,
  importableLists,
  collectionId,
  newCollectionName,
  readyCount,
  toVerifyCount,
  needsAttentionCount,
  importableCount,
  skippedCount,
  totalCards,
  isImporting,
  onResolve,
  onSkip,
  onUnskip,
  onToggleExpand,
  onCollectionChange,
  onNewCollectionNameChange,
  onImport,
  onBack,
}: {
  matchedEntries: MatchedEntry[];
  allPrintings: Printing[];
  rowCount: number;
  parseErrors: string[];
  skippedIndices: Set<number>;
  expandedIndices: Set<number>;
  collections: CollectionOption[];
  importableLists: ImportableListOption[];
  collectionId: string;
  newCollectionName: string;
  readyCount: number;
  toVerifyCount: number;
  needsAttentionCount: number;
  importableCount: number;
  skippedCount: number;
  totalCards: number;
  isImporting: boolean;
  onResolve: (index: number, printing: Printing) => void;
  onSkip: (index: number) => void;
  onUnskip: (index: number) => void;
  onToggleExpand: (index: number) => void;
  onCollectionChange: (id: string) => void;
  onNewCollectionNameChange: (name: string) => void;
  onImport: (options?: { replaceExisting?: boolean }) => void;
  onBack: () => void;
}) {
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const targetCollection = collections.find((col) => col.id === collectionId);
  const targetCopyCount = targetCollection?.copyCount ?? 0;
  // A non-empty existing collection is the only case that needs the add/replace
  // question — new collections start empty and lists are additive only.
  const promptsForReplace = isReplaceableTarget(collectionId, collections);
  const isListTarget = collectionId.startsWith(LIST_TARGET_PREFIX);
  const canImport =
    importableCount > 0 &&
    collectionId !== "" &&
    (collectionId !== "__new__" || newCollectionName.trim().length > 0);
  const importLabel = isListTarget
    ? totalCards === 1
      ? m.collections_import_button_add_cards_one({ count: totalCards })
      : m.collections_import_button_add_cards_other({ count: totalCards })
    : totalCards === 1
      ? m.collections_import_button_import_copies_one({ count: totalCards })
      : m.collections_import_button_import_copies_other({ count: totalCards });

  const { problematicEntries, exactEntries } = partitionMatchedEntries(matchedEntries);

  const renderRow = ({ entry, index }: { entry: MatchedEntry; index: number }) => (
    <ImportEntryRow
      key={`${entry.entry.sourceCode}-${entry.entry.finish}-${index}`}
      entry={entry}
      allPrintings={allPrintings}
      index={index}
      isSkipped={skippedIndices.has(index)}
      isExpanded={expandedIndices.has(index)}
      onResolve={onResolve}
      onSkip={onSkip}
      onUnskip={onUnskip}
      onToggleExpand={onToggleExpand}
    />
  );

  return (
    <ImportPreviewStack className={cn(PAGE_WIDTH.capped, "pt-3")}>
      <SectionHeader>
        <SectionHeaderGroup>
          <SectionHeaderTitle>{m.collections_import_preview_title()}</SectionHeaderTitle>
          <SectionHeaderDescription>
            {rowCount === 1
              ? m.collections_import_rows_parsed_one({ count: rowCount })
              : m.collections_import_rows_parsed_other({ count: rowCount })}
            {", "}
            {matchedEntries.length === 1
              ? m.collections_import_unique_printings_one({ count: matchedEntries.length })
              : m.collections_import_unique_printings_other({ count: matchedEntries.length })}
          </SectionHeaderDescription>
        </SectionHeaderGroup>
        <SectionHeaderActions>
          <Button variant="outline" size="sm" onClick={onBack}>
            {m.collections_import_back()}
          </Button>
        </SectionHeaderActions>
      </SectionHeader>

      {problematicEntries.length > 0 && (
        <ImportRowsSection title="Needs review" count={problematicEntries.length}>
          {problematicEntries.map((item) => renderRow(item))}
        </ImportRowsSection>
      )}

      <ImportParseErrorDetails errors={parseErrors} unit="row" />

      <ImportExactMatchesDisclosure count={exactEntries.length}>
        {exactEntries.map((item) => renderRow(item))}
      </ImportExactMatchesDisclosure>

      <Callout className="space-y-4">
        <ImportStatusBadges
          readyCount={readyCount}
          toVerifyCount={toVerifyCount}
          needsAttentionCount={needsAttentionCount}
          skippedCount={skippedCount}
        />

        <ImportToVerifyNote count={toVerifyCount} />

        <ImportTroubleNote needsAttentionCount={needsAttentionCount} />

        <div className="flex flex-wrap items-end gap-3">
          <Select
            value={collectionId}
            onValueChange={(value) => onCollectionChange(value ?? "")}
            items={{
              ...Object.fromEntries(collections.map((col) => [col.id, col.name])),
              __new__: m.collections_import_create_new_collection(),
              ...Object.fromEntries(
                importableLists.map((list) => [`${LIST_TARGET_PREFIX}${list.id}`, list.name]),
              ),
            }}
          >
            <SelectTrigger className="mb-0 w-[240px]">
              <SelectValue placeholder={m.collections_import_destination_placeholder()} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>{m.collections_import_group_collections()}</SelectLabel>
                {collections.map((col) => (
                  <SelectItem key={col.id} value={col.id}>
                    {col.name}
                  </SelectItem>
                ))}
                <SelectItem value="__new__">
                  {m.collections_import_create_new_collection()}
                </SelectItem>
              </SelectGroup>
              {importableLists.length > 0 && (
                <>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>{m.collections_import_group_lists()}</SelectLabel>
                    {importableLists.map((list) => (
                      <SelectItem key={list.id} value={`${LIST_TARGET_PREFIX}${list.id}`}>
                        {list.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </>
              )}
            </SelectContent>
          </Select>

          {collectionId === "__new__" && (
            <div className="flex items-center gap-2">
              <label
                className="text-sm font-medium whitespace-nowrap"
                htmlFor="new-collection-name"
              >
                {m.collections_import_collection_name_label()}
              </label>
              <Input
                id="new-collection-name"
                value={newCollectionName}
                onChange={(event) => onNewCollectionNameChange(event.target.value)}
                placeholder={m.collections_import_collection_name_placeholder()}
                className="w-[240px]"
              />
            </div>
          )}

          <Button
            onClick={() => (promptsForReplace ? setReplaceDialogOpen(true) : onImport())}
            disabled={!canImport || isImporting}
          >
            {isImporting ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                {m.collections_import_importing()}
              </>
            ) : (
              importLabel
            )}
          </Button>
          {needsAttentionCount > 0 && !isImporting && (
            <span className="text-muted-foreground text-sm">
              {m.collections_import_skips_unmatched({ count: needsAttentionCount })}
            </span>
          )}
        </div>

        <p className="text-muted-foreground text-sm">
          {isListTarget ? m.collections_import_note_list() : m.collections_import_note_collection()}
        </p>
      </Callout>

      <AlertDialog open={replaceDialogOpen} onOpenChange={setReplaceDialogOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>
            {targetCopyCount === 1
              ? m.collections_import_replace_title_one({
                  name: targetCollection?.name ?? "",
                  count: targetCopyCount,
                })
              : m.collections_import_replace_title_other({
                  name: targetCollection?.name ?? "",
                  count: targetCopyCount,
                })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {m.collections_import_replace_description()}
          </AlertDialogDescription>
          <div className="flex flex-col justify-end gap-2 pt-2 sm:flex-row">
            <Button variant="ghost" onClick={() => setReplaceDialogOpen(false)}>
              {m.common_cancel()}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setReplaceDialogOpen(false);
                onImport({ replaceExisting: false });
              }}
            >
              {m.collections_import_replace_add()}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setReplaceDialogOpen(false);
                onImport({ replaceExisting: true });
              }}
            >
              {m.collections_import_replace_all({ count: targetCopyCount })}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </ImportPreviewStack>
  );
}
