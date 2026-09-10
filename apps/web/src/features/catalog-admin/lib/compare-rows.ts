import type {
  AdminCardDetailResponse,
  AdminPrintingImageResponse,
  AdminPrintingResponse,
  CandidatePrintingResponse,
} from "@openrift/shared/types/api/admin";

import type {
  ComparableCardField,
  ComparablePrintingField,
} from "@/features/catalog-admin/lib/catalog-field-labels";
import {
  CARD_FIELD_LABELS,
  COMPARABLE_CARD_FIELDS,
  COMPARABLE_PRINTING_FIELDS,
  DIFFED_FIELDS,
  hasFieldValue,
  PRINTING_FIELD_LABELS,
  sameFieldValue,
} from "@/features/catalog-admin/lib/catalog-field-labels";
import type { CompareColumn } from "@/features/catalog-admin/lib/compare-columns";
import { summarizeCandidatePrinting } from "@/features/catalog-admin/lib/printing-fields";

export type CompareCellState = "empty" | "invalid" | "same" | "different";

export interface CompareCell {
  columnId: string;
  value: unknown;
  state: CompareCellState;
}

export interface CompareFieldRow<TField extends string = string> {
  key: string;
  field: TField;
  label: string;
  siteValue: unknown;
  isText: boolean;
  cells: CompareCell[];
  differences: number;
}

export interface CompareImageCell {
  columnId: string;
  candidatePrintingId: string;
  imageUrl: string;
  isSameFile: boolean;
}

export interface CompareImageRow {
  key: string;
  siteImageUrl: string | null;
  activeImageId: string | null;
  cells: CompareImageCell[];
  differences: number;
}

export interface ComparePrintingBlock {
  printingId: string;
  codeLabel: string;
  title: string;
  rows: CompareFieldRow<ComparablePrintingField>[];
  imageRow: CompareImageRow;
  candidateByColumn: Record<string, string>;
  differences: number;
}

export interface CompareGroupCell {
  columnId: string;
  candidatePrintingId: string;
  summary: string;
  rowCount: number;
}

export interface CompareGroupBlock {
  key: string;
  title: string;
  cells: CompareGroupCell[];
  candidates: CandidatePrintingResponse[];
}

export interface CompareModel {
  cardRows: CompareFieldRow<ComparableCardField>[];
  printingBlocks: ComparePrintingBlock[];
  groupBlocks: CompareGroupBlock[];
  printingsWithoutSources: string[];
  differences: number;
}

export type CompareOptionSets = Readonly<Record<string, readonly string[]>>;

export function isInvalidOption(
  field: string,
  value: unknown,
  optionSets: CompareOptionSets,
): boolean {
  const options = optionSets[field];
  if (options === undefined || options.length === 0) {
    return false;
  }
  if (Array.isArray(value)) {
    return !value.every((entry) => options.includes(String(entry)));
  }
  return !options.includes(String(value));
}

function cellState(
  field: string,
  siteValue: unknown,
  value: unknown,
  optionSets: CompareOptionSets,
): CompareCellState {
  if (!hasFieldValue(value)) {
    return "empty";
  }
  if (isInvalidOption(field, value, optionSets)) {
    return "invalid";
  }
  return sameFieldValue(siteValue, value, field) ? "same" : "different";
}

function buildRow<TField extends string>(
  keyPrefix: string,
  field: TField,
  label: string,
  siteValue: unknown,
  sourceValues: readonly { columnId: string; value: unknown }[],
  optionSets: CompareOptionSets,
): CompareFieldRow<TField> {
  const cells = sourceValues.map(({ columnId, value }) => ({
    columnId,
    value,
    state: cellState(field, siteValue, value, optionSets),
  }));
  return {
    key: `${keyPrefix}:${field}`,
    field,
    label,
    siteValue,
    isText: DIFFED_FIELDS.has(field),
    cells,
    differences: cells.filter((cell) => cell.state === "different").length,
  };
}

function activeImage(
  printingId: string,
  images: readonly AdminPrintingImageResponse[],
): AdminPrintingImageResponse | null {
  return images.find((image) => image.printingId === printingId && image.isActive) ?? null;
}

function printingCodeLabel(printing: AdminPrintingResponse): string {
  return `${printing.shortCode} · ${printing.language.toUpperCase()}`;
}

export function printingBlockTitle(printing: AdminPrintingResponse): string {
  const markers = [printing.finish, ...printing.markerSlugs].filter(Boolean).join(" + ");
  return markers ? `${printingCodeLabel(printing)} · ${markers}` : printingCodeLabel(printing);
}

function buildCardRows(
  detail: AdminCardDetailResponse,
  columns: readonly CompareColumn[],
  optionSets: CompareOptionSets,
): CompareFieldRow<ComparableCardField>[] {
  const sourceById = new Map(detail.sources.map((source) => [source.id, source]));
  const card = detail.card as Record<string, unknown> | null;

  return COMPARABLE_CARD_FIELDS.map((field) =>
    buildRow(
      "card",
      field,
      CARD_FIELD_LABELS[field],
      card?.[field] ?? null,
      columns.map((column) => ({
        columnId: column.id,
        value: (sourceById.get(column.id) as unknown as Record<string, unknown> | undefined)?.[
          field
        ],
      })),
      optionSets,
    ),
  );
}

function buildPrintingBlock(
  printing: AdminPrintingResponse,
  linked: readonly CandidatePrintingResponse[],
  columns: readonly CompareColumn[],
  images: readonly AdminPrintingImageResponse[],
  optionSets: CompareOptionSets,
): ComparePrintingBlock {
  const byColumn = new Map<string, CandidatePrintingResponse>();
  for (const candidate of linked) {
    if (!byColumn.has(candidate.candidateCardId)) {
      byColumn.set(candidate.candidateCardId, candidate);
    }
  }
  const site = printing as unknown as Record<string, unknown>;

  const rows = COMPARABLE_PRINTING_FIELDS.map((field) =>
    buildRow(
      printing.id,
      field,
      PRINTING_FIELD_LABELS[field],
      site[field] ?? null,
      columns.map((column) => ({
        columnId: column.id,
        value: (byColumn.get(column.id) as unknown as Record<string, unknown> | undefined)?.[field],
      })),
      optionSets,
    ),
  );

  const image = activeImage(printing.id, images);
  const imageCells = columns.flatMap((column) => {
    const candidate = byColumn.get(column.id);
    if (!candidate || !hasFieldValue(candidate.imageUrl)) {
      return [];
    }
    const imageUrl = candidate.imageUrl as string;
    return [
      {
        columnId: column.id,
        candidatePrintingId: candidate.id,
        imageUrl,
        isSameFile:
          image !== null && (image.originalUrl === imageUrl || image.rehostedUrl === imageUrl),
      },
    ];
  });

  const imageRow: CompareImageRow = {
    key: `${printing.id}:image`,
    siteImageUrl: image === null ? null : (image.rehostedUrl ?? image.originalUrl),
    activeImageId: image?.id ?? null,
    cells: imageCells,
    differences: imageCells.filter((cell) => !cell.isSameFile).length,
  };

  return {
    printingId: printing.id,
    codeLabel: printingCodeLabel(printing),
    title: printingBlockTitle(printing),
    rows,
    imageRow,
    candidateByColumn: Object.fromEntries(
      [...byColumn].map(([columnId, candidate]) => [columnId, candidate.id]),
    ),
    differences: rows.reduce((total, row) => total + row.differences, 0) + imageRow.differences,
  };
}

function buildGroupBlocks(
  detail: AdminCardDetailResponse,
  columns: readonly CompareColumn[],
): CompareGroupBlock[] {
  const visible = new Set(columns.map((column) => column.id));
  const byId = new Map(detail.candidatePrintings.map((candidate) => [candidate.id, candidate]));

  return detail.candidatePrintingGroups.flatMap((group, index) => {
    const candidates = group.shortCodes
      .flatMap((id) => {
        const candidate = byId.get(id);
        return candidate === undefined ? [] : [candidate];
      })
      .filter(
        (candidate) => candidate.printingId === null && visible.has(candidate.candidateCardId),
      );
    if (candidates.length === 0) {
      return [];
    }
    const byColumn = Map.groupBy(candidates, (candidate) => candidate.candidateCardId);
    const cells = [...byColumn].flatMap(([columnId, rows]) => {
      const first = rows.at(0);
      return first === undefined
        ? []
        : [
            {
              columnId,
              candidatePrintingId: first.id,
              summary: summarizeCandidatePrinting(first),
              rowCount: rows.length,
            },
          ];
    });
    const language = group.language;
    return [
      {
        key: `${group.expectedPrintingId}-${index}`,
        title: language
          ? `${group.mostCommonShortCode} · ${language.toUpperCase()}`
          : group.mostCommonShortCode,
        cells,
        candidates,
      },
    ];
  });
}

export function buildCompareModel(
  detail: AdminCardDetailResponse,
  columns: readonly CompareColumn[],
  optionSets: CompareOptionSets = {},
): CompareModel {
  const linkedByPrinting = Map.groupBy(
    detail.candidatePrintings.filter((candidate) => candidate.printingId !== null),
    (candidate) => candidate.printingId as string,
  );
  const visible = new Set(columns.map((column) => column.id));

  const cardRows = buildCardRows(detail, columns, optionSets);
  const printingBlocks = detail.printings.map((printing) =>
    buildPrintingBlock(
      printing,
      (linkedByPrinting.get(printing.id) ?? []).filter((candidate) =>
        visible.has(candidate.candidateCardId),
      ),
      columns,
      detail.printingImages,
      optionSets,
    ),
  );

  return {
    cardRows,
    printingBlocks,
    groupBlocks: buildGroupBlocks(detail, columns),
    printingsWithoutSources: printingBlocks
      .filter((block) => Object.keys(block.candidateByColumn).length === 0)
      .map((block) => block.codeLabel),
    differences:
      cardRows.reduce((total, row) => total + row.differences, 0) +
      printingBlocks.reduce((total, block) => total + block.differences, 0),
  };
}

export function visibleRows<TField extends string>(
  rows: readonly CompareFieldRow<TField>[],
  differencesOnly: boolean,
): CompareFieldRow<TField>[] {
  return differencesOnly ? rows.filter((row) => row.differences > 0) : [...rows];
}
