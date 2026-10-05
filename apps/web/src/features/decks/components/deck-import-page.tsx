import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { DeckImportInputStep } from "@/features/decks/components/deck-import-input-step";
import { DeckImportPreviewStep } from "@/features/decks/components/deck-import-preview-step";
import { useDeckImportFlow } from "@/features/decks/hooks/use-deck-import-flow";
import { m } from "@/paraglide/messages.js";

export function DeckImportPage() {
  const flow = useDeckImportFlow();
  const replaceDeckName = flow.isReplaceMode ? (flow.replaceDeckName ?? "") : undefined;

  if (flow.step === "input") {
    return (
      <DeckImportInputStep
        rawText={flow.rawText}
        onTextChange={flow.handleRawTextChange}
        importMode={flow.importMode}
        onImportModeChange={flow.handleImportModeChange}
        onParse={(text) => void flow.handleParse(text)}
        onFileUpload={flow.handleFileUpload}
        fileRef={flow.fileRef}
        isParsing={flow.isResolvingLink}
        parseWarnings={flow.parseWarnings}
        replaceDeckName={replaceDeckName}
      />
    );
  }

  return (
    <>
      <DeckImportPreviewStep
        matchedEntries={flow.matchedEntries}
        allPrintings={flow.allPrintings}
        parseWarnings={flow.parseWarnings}
        sourceNote={flow.sourceNote}
        skippedIndices={flow.skippedIndices}
        expandedValues={flow.expandedValues}
        deckName={flow.deckName}
        deckFormat={flow.deckFormat}
        deckFormats={flow.deckFormats}
        deckFormatLabels={flow.deckFormatLabels}
        zoneOrder={flow.zoneOrder}
        zoneLabels={flow.zoneLabels}
        readyCount={flow.readyCount}
        toVerifyCount={flow.toVerifyCount}
        needsAttentionCount={flow.needsAttentionCount}
        importableCount={flow.importableCount}
        skippedCount={flow.skippedCount}
        totalCards={flow.totalCards}
        importCards={flow.importCards}
        summaryFormat={flow.summaryFormat}
        summaryFormatConfig={flow.summaryFormatConfig}
        isLoggedIn={flow.isLoggedIn}
        isImporting={flow.isImporting}
        replaceDeckName={replaceDeckName}
        sourceLink={flow.sourceLink}
        onDropSourceLink={flow.handleDropSourceLink}
        onResolve={flow.handleResolve}
        onZoneChange={flow.handleZoneChange}
        onSkip={flow.handleSkip}
        onUnskip={flow.handleUnskip}
        onExpandedValuesChange={flow.handleExpandedValuesChange}
        onDeckNameChange={flow.handleDeckNameChange}
        onDeckFormatChange={flow.handleDeckFormatChange}
        onImport={flow.handleImport}
        onBack={flow.handleBack}
      />
      <ConfirmActionDialog
        open={flow.confirmReplaceOpen}
        onOpenChange={flow.handleConfirmReplaceOpenChange}
        onConfirm={() => {
          flow.handleConfirmReplaceOpenChange(false);
          flow.executeReplace();
        }}
        title={m.collections_import_deck_replace_confirm_title()}
        description={m.collections_import_deck_replace_confirm_body({
          name: flow.replaceDeckName ?? m.collections_import_deck_replace_this_deck(),
          count: flow.totalCards,
        })}
        confirmLabel={m.collections_import_deck_replace_action()}
      />
    </>
  );
}
