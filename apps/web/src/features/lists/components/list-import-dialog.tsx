import { ParaglideMessage } from "@inlang/paraglide-js-react";
import type { Printing } from "@openrift/shared/types/catalog";
import { useEffect } from "react";

import { PROSE_MARKUP } from "@/components/message-markup";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { ImportEntryRow } from "@/features/collections/components/import-entry-row";
import {
  ImportExactMatchesDisclosure,
  ImportParseErrorDetails,
  ImportPreviewStack,
  ImportRowsSection,
  ImportStatusBadges,
  ImportTextInput,
} from "@/features/collections/components/import-preview-chrome";
import type { ImportInputStepProps } from "@/features/collections/lib/import-input-step-props";
import type { MatchedEntry } from "@/features/collections/lib/import-matcher";
import { partitionMatchedEntries } from "@/features/collections/lib/import-summary";
import type { ImportableListKind } from "@/features/lists/hooks/use-list-import-flow";
import { useListImportFlow } from "@/features/lists/hooks/use-list-import-flow";
import { m } from "@/paraglide/messages.js";

interface ListImportDialogProps {
  listId: string;
  listKind: ImportableListKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ListImportDialog({ listId, listKind, open, onOpenChange }: ListImportDialogProps) {
  const flow = useListImportFlow(listId, listKind, () => onOpenChange(false));

  useEffect(() => {
    if (!open) {
      flow.reset();
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- reacting to flow.reset would clobber an active session
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{m.lists_import_title()}</DialogTitle>
          <DialogDescription>
            <ParaglideMessage message={m.lists_import_paste} markup={PROSE_MARKUP} />{" "}
            {listKind === "printing" ? m.lists_import_hint_printing() : m.lists_import_hint_card()}
          </DialogDescription>
        </DialogHeader>

        {flow.step === "input" ? (
          <InputStep
            rawText={flow.rawText}
            onTextChange={flow.handleRawTextChange}
            onParse={flow.handleParse}
            onFileUpload={flow.handleFileUpload}
            fileRef={flow.fileRef}
            parseErrors={flow.parseErrors}
          />
        ) : (
          <PreviewStep
            matchedEntries={flow.matchedEntries}
            allPrintings={flow.allPrintings}
            rowCount={flow.rowCount}
            parseErrors={flow.parseErrors}
            skippedIndices={flow.skippedIndices}
            expandedIndices={flow.expandedIndices}
            readyCount={flow.readyCount}
            toVerifyCount={flow.toVerifyCount}
            needsAttentionCount={flow.needsAttentionCount}
            importableCount={flow.importableCount}
            skippedCount={flow.skippedCount}
            totalCards={flow.totalCards}
            isImporting={flow.isImporting}
            onResolve={flow.handleResolve}
            onSkip={flow.handleSkip}
            onUnskip={flow.handleUnskip}
            onToggleExpand={flow.handleToggleExpand}
            onImport={() => void flow.handleImport()}
            onBack={flow.handleBack}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function InputStep({
  rawText,
  onTextChange,
  onParse,
  onFileUpload,
  fileRef,
  parseErrors,
}: ImportInputStepProps) {
  return (
    <DialogForm onSubmit={() => onParse(rawText)}>
      <ImportTextInput
        value={rawText}
        onValueChange={onTextChange}
        placeholder={"1 Teemo, Scout\n3 Jinx, Rebel"}
        fileRef={fileRef}
        onFileUpload={onFileUpload}
        accept=".txt,.csv,text/plain,text/csv"
        uploadLabel={m.lists_import_upload_file()}
        actionLabel={m.lists_import_parse()}
        errors={parseErrors}
      />
    </DialogForm>
  );
}

function PreviewStep({
  matchedEntries,
  allPrintings,
  rowCount,
  parseErrors,
  skippedIndices,
  expandedIndices,
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
  onImport,
  onBack,
}: {
  matchedEntries: MatchedEntry[];
  allPrintings: Printing[];
  rowCount: number;
  parseErrors: string[];
  skippedIndices: Set<number>;
  expandedIndices: Set<number>;
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
  onImport: () => void;
  onBack: () => void;
}) {
  const { problematicEntries, exactEntries } = partitionMatchedEntries(matchedEntries);

  const renderRow = ({ entry, index }: { entry: MatchedEntry; index: number }) => (
    <ImportEntryRow
      key={`${entry.entry.cardName}-${index}`}
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
    <DialogForm onSubmit={onImport}>
      <ImportPreviewStack className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground">
            {m.lists_import_lines({ count: rowCount })}
            {", "}
            {m.lists_import_cards({ count: matchedEntries.length })}
          </p>
          <Button variant="outline" size="sm" onClick={onBack}>
            {m.lists_import_back()}
          </Button>
        </div>

        {problematicEntries.length > 0 && (
          <ImportRowsSection
            title={m.lists_import_needs_review()}
            count={problematicEntries.length}
          >
            {problematicEntries.map((item) => renderRow(item))}
          </ImportRowsSection>
        )}

        <ImportParseErrorDetails errors={parseErrors} unit="line" />

        <ImportExactMatchesDisclosure count={exactEntries.length}>
          {exactEntries.map((item) => renderRow(item))}
        </ImportExactMatchesDisclosure>

        <Callout variant="inset" className="flex flex-wrap items-center justify-between gap-3">
          <ImportStatusBadges
            readyCount={readyCount}
            toVerifyCount={toVerifyCount}
            needsAttentionCount={needsAttentionCount}
            skippedCount={skippedCount}
          />

          <Button type="submit" disabled={importableCount === 0} pending={isImporting}>
            {isImporting ? m.lists_import_importing() : m.lists_import_add({ count: totalCards })}
          </Button>
        </Callout>
      </ImportPreviewStack>
    </DialogForm>
  );
}
