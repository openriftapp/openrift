import type { CandidatePrintingResponse } from "@openrift/shared/types/api/admin";

import type { ComparableCardField } from "@/features/catalog-admin/lib/catalog-field-labels";
import type { CompareColumn } from "@/features/catalog-admin/lib/compare-columns";
import type {
  CompareFieldRow,
  ComparePrintingBlock,
} from "@/features/catalog-admin/lib/compare-rows";
import type { RequiredPrintingField } from "@/features/catalog-admin/lib/printing-fields";

export interface ComparePrintingTarget {
  id: string;
  label: string;
}

export type PrintingFieldOverrides = Partial<Record<RequiredPrintingField, string>>;

export interface CompareActions {
  applyCardValue: (
    row: CompareFieldRow<ComparableCardField>,
    columnId: string,
    sourceLabel: string,
  ) => void;
  applyPrintingValue: (
    block: ComparePrintingBlock,
    rowKey: string,
    columnId: string,
    sourceLabel: string,
  ) => void;
  applyAllFromColumn: (columnId: string) => void;
  applyAllFromBlock: (block: ComparePrintingBlock, columnId: string) => void;
  applySourceImage: (candidatePrintingId: string, activeImageId: string | null) => void;
  markColumnChecked: (column: CompareColumn) => void;
  markRowChecked: (candidatePrintingId: string) => void;
  ignoreColumn: (column: CompareColumn) => void;
  ignoreRow: (candidatePrintingId: string) => void;
  ignoreRows: (candidates: readonly CandidatePrintingResponse[]) => void;
  moveRow: (candidatePrintingId: string, printingId: string) => void;
  copyRow: (candidatePrintingId: string, printingId: string) => void;
  unlinkRow: (candidatePrintingId: string) => void;
  addPrinting: (
    candidate: CandidatePrintingResponse,
    groupCandidates: readonly CandidatePrintingResponse[],
    overrides?: PrintingFieldOverrides,
  ) => void;
  linkGroup: (candidates: readonly CandidatePrintingResponse[], printingId: string) => void;
}

export interface CompareContext {
  columns: readonly CompareColumn[];
  printingTargets: readonly ComparePrintingTarget[];
  differencesOnly: boolean;
  expandedPrintingIds: ReadonlySet<string>;
  toggleExpanded: (printingId: string) => void;
  hideColumn: (columnId: string) => void;
}
