import { useRef, useState } from "react";

import { useCards } from "@/features/cards/hooks/use-cards";
import type { ImportStep } from "@/features/collections/lib/import-flow-shared";
import {
  createImportEntryHandlers,
  deriveImportSummary,
  handleImportFileUpload,
  runImportParse,
  STATUS_SORT_ORDER,
} from "@/features/collections/lib/import-flow-shared";
import type { MatchedEntry } from "@/features/collections/lib/import-matcher";
import { matchEntries, promoteToExact } from "@/features/collections/lib/import-matcher";
import { knownPrintingCode } from "@/features/lists/lib/list-import-parser";
import { useDisplayLanguages } from "@/hooks/use-display-languages";
import { useEnumOrders, useLanguageLabels } from "@/hooks/use-enums";

export function useImportReview({
  promoteSingleCard,
  tieBreak,
}: {
  promoteSingleCard: boolean;
  tieBreak: "sourceCode" | "cardName";
}) {
  const { allPrintings } = useCards();
  const preferredLanguages = useDisplayLanguages();

  const [step, setStep] = useState<ImportStep>("input");
  const [rawText, setRawText] = useState("");
  const [matchedEntries, setMatchedEntries] = useState<MatchedEntry[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [skippedIndices, setSkippedIndices] = useState<Set<number>>(new Set());
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());
  const [rowCount, setRowCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const { labels: enumLabels } = useEnumOrders();
  const languageLabels = useLanguageLabels();
  const importLabels = {
    finishes: enumLabels.finishes,
    languages: languageLabels,
    isCode: knownPrintingCode(allPrintings),
  };

  const reset = () => {
    setStep("input");
    setRawText("");
    setMatchedEntries([]);
    setParseErrors([]);
    setSkippedIndices(new Set());
    setExpandedIndices(new Set());
    setRowCount(0);
  };

  const handleParse = (text: string) => {
    runImportParse(
      text,
      importLabels,
      (entries) => {
        const matched = matchEntries(entries, allPrintings, preferredLanguages[0]).map((entry) =>
          promoteSingleCard ? promoteToExact(entry) : entry,
        );
        return matched.toSorted((entryA, entryB) => {
          const statusDiff = STATUS_SORT_ORDER[entryA.status] - STATUS_SORT_ORDER[entryB.status];
          if (statusDiff !== 0) {
            return statusDiff;
          }
          return entryA.entry[tieBreak].localeCompare(entryB.entry[tieBreak]);
        });
      },
      {
        setRowCount,
        setParseErrors,
        setMatchedEntries,
        setSkippedIndices,
        setExpandedIndices,
        setStep,
      },
    );
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    void handleImportFileUpload(event, fileRef, setRawText, handleParse);
  };

  const { handleResolve, handleSkip, handleUnskip, handleToggleExpand } = createImportEntryHandlers(
    setMatchedEntries,
    setSkippedIndices,
    setExpandedIndices,
  );

  const { importableEntries, summary, skippedCount } = deriveImportSummary(
    matchedEntries,
    skippedIndices,
  );

  return {
    allPrintings,
    step,
    rawText,
    matchedEntries,
    parseErrors,
    skippedIndices,
    expandedIndices,
    rowCount,
    fileRef,
    importableEntries,
    summary,
    skippedCount,
    setStep,
    setRawText,
    reset,
    handleParse,
    handleFileUpload,
    handleResolve,
    handleSkip,
    handleUnskip,
    handleToggleExpand,
  };
}
