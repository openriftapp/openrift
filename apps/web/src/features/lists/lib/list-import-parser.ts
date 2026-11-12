import { normalizeNameForIdentity } from "@openrift/shared/card-name";
import { isUrlLine, parseCardListLine } from "@openrift/shared/deck-codecs/text";
import type { LabelMap } from "@openrift/shared/enum-label";
import { slugForLabel } from "@openrift/shared/enum-label";
import { squashForSearch } from "@openrift/shared/search-fold";
import type { Printing } from "@openrift/shared/types/catalog";
import { WellKnown } from "@openrift/shared/well-known";

import type { ImportEntry } from "@/features/collections/lib/import-parsers";
import { detectImportFormat, parseImportData } from "@/features/collections/lib/import-parsers";
import { isListShareHeader } from "@/features/lists/lib/list-export";

type ListImportIssueCode = "unreadable" | "zeroQuantity" | "missingName";

export interface ListImportIssue {
  line: number;
  code: ListImportIssueCode;
  text: string;
}

export interface ListImportLabels {
  finishes: LabelMap;
  languages: LabelMap;
  isCode: (segment: string) => boolean;
}

export function knownPrintingCode(printings: readonly Printing[]): (segment: string) => boolean {
  const codes = new Set(
    printings.flatMap((printing) => [
      squashForSearch(printing.shortCode),
      squashForSearch(printing.publicCode),
    ]),
  );
  return (segment) => codes.has(squashForSearch(segment));
}

interface ListImportParseResult {
  entries: ImportEntry[];
  errors: string[];
  issues: ListImportIssue[];
  rowCount: number;
}

export function parseListImport(text: string, labels: ListImportLabels): ListImportParseResult {
  if (detectImportFormat(text) !== null) {
    const { entries, errors, rowCount } = parseImportData(text);
    return { entries, errors, issues: [], rowCount };
  }
  return parseCardListText(text, labels);
}

function printingDetails(
  trailing: readonly string[],
  hasCode: boolean,
  labels: ListImportLabels,
): Pick<ImportEntry, "finish" | "language"> {
  let finish: string | undefined;
  let language: string | undefined;
  for (const segment of hasCode ? trailing.slice(1) : trailing) {
    finish ??= slugForLabel(labels.finishes, segment);
    language ??= slugForLabel(labels.languages, segment);
  }
  return {
    finish: (finish ?? WellKnown.finish.NORMAL) as ImportEntry["finish"],
    ...(language === undefined
      ? hasCode
        ? { language: WellKnown.language.EN }
        : {}
      : { language }),
  };
}

export function parseCardListText(text: string, labels: ListImportLabels): ListImportParseResult {
  const issues: ListImportIssue[] = [];
  const aggregated = new Map<string, ImportEntry>();
  let rowCount = 0;
  let seenLine = false;

  for (const [index, rawLine] of text.split(/\r?\n/u).entries()) {
    const line = rawLine.trim();
    if (line.length === 0 || isUrlLine(line)) {
      continue;
    }
    const parsed = parseCardListLine(line, labels.isCode);
    const isFirstLine = !seenLine;
    seenLine = true;
    if (isFirstLine && isListShareHeader(line)) {
      continue;
    }
    rowCount++;

    const lineNumber = index + 1;
    if (parsed.quantity === null) {
      issues.push({ line: lineNumber, code: "unreadable", text: line });
      continue;
    }
    if (parsed.quantity <= 0) {
      issues.push({ line: lineNumber, code: "zeroQuantity", text: line });
      continue;
    }
    if (parsed.name.length === 0) {
      issues.push({ line: lineNumber, code: "missingName", text: line });
      continue;
    }

    const sourceCode = parsed.code ?? "";
    const details = printingDetails(parsed.trailing, parsed.code !== undefined, labels);
    const key = [
      normalizeNameForIdentity(parsed.name),
      sourceCode.toLowerCase(),
      details.finish,
      details.language ?? "",
    ].join("|");
    const existing = aggregated.get(key);
    if (existing) {
      existing.quantity += parsed.quantity;
      continue;
    }
    aggregated.set(key, {
      setPrefix: sourceCode.split("-")[0] ?? "",
      artVariant: WellKnown.artVariant.NORMAL,
      quantity: parsed.quantity,
      cardName: parsed.name,
      ...(parsed.pairedName !== undefined && { pairedCardName: parsed.pairedName }),
      sourceCode,
      rawFields: {},
      ...details,
    });
  }

  return {
    entries: [...aggregated.values()],
    errors: [],
    issues,
    rowCount,
  };
}
