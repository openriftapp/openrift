import { linkHostLabel } from "@openrift/shared/link-hosts";
import type { DeckFormatConfig } from "@openrift/shared/types/api/deck";
import type { Printing } from "@openrift/shared/types/catalog";
import type { DeckFormat, DeckZone } from "@openrift/shared/types/enums";
import { ArrowLeftIcon, ExternalLinkIcon, Loader2Icon } from "lucide-react";

import {
  PageDescription,
  PageTopBar,
  PageTopBarIconButton,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { Accordion } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { ChipRemoveButton } from "@/components/ui/chip-remove-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeckImportEntryRow } from "@/features/collections/components/deck-import-entry-row";
import {
  ImportPreviewStack,
  ImportRowsSection,
  ImportStatusBadges,
  ImportToVerifyNote,
  ImportTroubleNote,
} from "@/features/collections/components/import-preview-chrome";
import { classifyBucket } from "@/features/collections/lib/import-summary";
import { DeckImportSummary } from "@/features/decks/components/deck-import-summary";
import type { ImportedDeckCard } from "@/features/decks/lib/deck-import-cards";
import { defaultImportDeckName } from "@/features/decks/lib/deck-import-cards";
import type { DeckMatchedEntry, ResolvedCard } from "@/features/decks/lib/deck-import-matcher";
import { deckImportRowId } from "@/features/decks/lib/deck-import-preview";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function DeckImportPreviewStep({
  matchedEntries,
  allPrintings,
  parseWarnings,
  sourceNote,
  skippedIndices,
  expandedValues,
  deckName,
  deckFormat,
  deckFormats,
  deckFormatLabels,
  zoneOrder,
  zoneLabels,
  readyCount,
  toVerifyCount,
  needsAttentionCount,
  importableCount,
  skippedCount,
  totalCards,
  importCards,
  summaryFormat,
  summaryFormatConfig,
  isLoggedIn,
  isImporting,
  replaceDeckName,
  sourceLink,
  onDropSourceLink,
  onResolve,
  onZoneChange,
  onSkip,
  onUnskip,
  onExpandedValuesChange,
  onDeckNameChange,
  onDeckFormatChange,
  onImport,
  onBack,
}: {
  matchedEntries: DeckMatchedEntry[];
  allPrintings: Printing[];
  parseWarnings: string[];
  sourceNote: string | null;
  skippedIndices: Set<number>;
  expandedValues: string[];
  deckName: string;
  deckFormat: DeckFormat;
  deckFormats: { slug: string; label: string }[];
  deckFormatLabels: Record<string, string>;
  zoneOrder: DeckZone[];
  zoneLabels: Record<DeckZone, string>;
  readyCount: number;
  toVerifyCount: number;
  needsAttentionCount: number;
  importableCount: number;
  skippedCount: number;
  totalCards: number;
  importCards: ImportedDeckCard[];
  summaryFormat: DeckFormat;
  summaryFormatConfig: DeckFormatConfig | null;
  isLoggedIn: boolean;
  isImporting: boolean;
  replaceDeckName?: string;
  sourceLink?: string;
  onDropSourceLink: () => void;
  onResolve: (index: number, card: ResolvedCard) => void;
  onZoneChange: (index: number, zone: DeckZone) => void;
  onSkip: (index: number) => void;
  onUnskip: (index: number) => void;
  onExpandedValuesChange: (values: string[]) => void;
  onDeckNameChange: (name: string) => void;
  onDeckFormatChange: (format: DeckFormat) => void;
  onImport: () => void;
  onBack: () => void;
}) {
  const isReplaceMode = replaceDeckName !== undefined;
  const canImport = importableCount > 0;
  const isMobile = useIsMobile();

  const jumpToFirstNeedsAttention = () => {
    const index = matchedEntries.findIndex(
      (entry, entryIndex) =>
        !skippedIndices.has(entryIndex) &&
        classifyBucket(entry.status, entry.resolvedCard !== null) === "need-attention",
    );
    if (index === -1) {
      return;
    }
    document
      .querySelector(`#${deckImportRowId(index)}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const importButton = (
    <Button
      variant={isReplaceMode ? "destructive" : "default"}
      onClick={onImport}
      disabled={!canImport || isImporting}
      className="w-full sm:w-auto"
    >
      {isImporting ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          {isReplaceMode ? m.collections_import_deck_replacing() : m.collections_import_importing()}
        </>
      ) : isReplaceMode ? (
        totalCards === 1 ? (
          m.collections_import_deck_replace_button_one({ count: totalCards })
        ) : (
          m.collections_import_deck_replace_button_other({ count: totalCards })
        )
      ) : totalCards === 1 ? (
        m.collections_import_deck_import_button_one({ count: totalCards })
      ) : (
        m.collections_import_deck_import_button_other({ count: totalCards })
      )}
    </Button>
  );

  return (
    <>
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarIconButton
            aria-label={m.collections_import_back()}
            className="mr-1 -ml-2"
            onClick={onBack}
          >
            <ArrowLeftIcon />
          </PageTopBarIconButton>
          <PageTopBarTitle>
            {isReplaceMode
              ? m.collections_import_deck_replace_preview_title()
              : m.collections_import_preview_title()}
          </PageTopBarTitle>
        </PageTopBar>
      </PageTopBarSticky>
      <ImportPreviewStack className={cn(PAGE_WIDTH.capped, "pt-3", PAGE_PADDING_NO_TOP)}>
        <PageDescription>
          {matchedEntries.length === 1
            ? m.collections_import_deck_cards_parsed_one({ count: matchedEntries.length })
            : m.collections_import_deck_cards_parsed_other({ count: matchedEntries.length })}
          {sourceNote ? ` (${sourceNote})` : null}
        </PageDescription>

        <DeckImportSummary
          cards={importCards}
          format={summaryFormat}
          formatConfig={summaryFormatConfig}
          deckName={replaceDeckName || deckName.trim() || defaultImportDeckName()}
          isLoggedIn={isLoggedIn}
        />

        <ImportRowsSection
          title={m.collections_deck_import_cards_section()}
          count={matchedEntries.length}
          render={
            <Accordion
              multiple
              value={expandedValues}
              onValueChange={(value) => onExpandedValuesChange(value as string[])}
            />
          }
        >
          {matchedEntries.map((entry, index) => (
            <DeckImportEntryRow
              key={`${entry.entry.shortCode ?? entry.entry.cardName ?? ""}-${entry.zone}-${index}`}
              entry={entry}
              allPrintings={allPrintings}
              index={index}
              zoneOrder={zoneOrder}
              zoneLabels={zoneLabels}
              isSkipped={skippedIndices.has(index)}
              onResolve={onResolve}
              onZoneChange={onZoneChange}
              onSkip={onSkip}
              onUnskip={onUnskip}
            />
          ))}
        </ImportRowsSection>

        {parseWarnings.length > 0 && (
          <Alert variant="warning">
            <AlertTitle>
              {parseWarnings.length === 1
                ? m.collections_import_deck_warnings_one({ count: parseWarnings.length })
                : m.collections_import_deck_warnings_other({ count: parseWarnings.length })}
            </AlertTitle>
            <AlertDescription>
              {parseWarnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </AlertDescription>
          </Alert>
        )}

        <Callout className="space-y-4">
          <ImportStatusBadges
            readyCount={readyCount}
            toVerifyCount={toVerifyCount}
            needsAttentionCount={needsAttentionCount}
            skippedCount={skippedCount}
            onJumpToNeedsAttention={jumpToFirstNeedsAttention}
          />

          <ImportToVerifyNote count={toVerifyCount} />

          <ImportTroubleNote needsAttentionCount={needsAttentionCount} />

          {sourceLink !== undefined && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">{m.collections_import_deck_save_link()}</span>
              <Badge variant="outline" title={sourceLink}>
                <ExternalLinkIcon className="size-3" />
                {linkHostLabel(sourceLink) ?? sourceLink}
                <ChipRemoveButton
                  aria-label={m.collections_import_deck_drop_link()}
                  onClick={onDropSourceLink}
                />
              </Badge>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            {!isReplaceMode && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="preview-deck-name">
                    {m.collections_import_deck_name_label()}
                  </Label>
                  <Input
                    id="preview-deck-name"
                    value={deckName}
                    onChange={(event) => onDeckNameChange(event.target.value)}
                    placeholder={defaultImportDeckName()}
                    className="w-full sm:w-[200px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="preview-deck-format">
                    {m.collections_import_deck_format_label()}
                  </Label>
                  <Select
                    value={deckFormat}
                    onValueChange={(value) => {
                      if (value !== null) {
                        onDeckFormatChange(value);
                      }
                    }}
                  >
                    <SelectTrigger id="preview-deck-format" className="mb-0 w-full sm:w-[140px]">
                      <SelectValue>
                        {(value: string) => deckFormatLabels[value] ?? value}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {deckFormats.map((entry) => (
                        <SelectItem key={entry.slug} value={entry.slug}>
                          {entry.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {!isMobile && importButton}
            {needsAttentionCount > 0 && !isImporting && (
              <span className="text-muted-foreground text-sm">
                {m.collections_import_skips_unmatched({ count: needsAttentionCount })}
              </span>
            )}
          </div>
        </Callout>

        {isMobile && (
          <div className="bg-background/80 mx-safe-neg px-safe pb-safe sticky bottom-0 z-20 pt-2 backdrop-blur-lg">
            {importButton}
          </div>
        )}
      </ImportPreviewStack>
    </>
  );
}
