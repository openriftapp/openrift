import { formatPrintingVariantLabelParts } from "@openrift/shared/printing-label";
import type { CopyResponse } from "@openrift/shared/types/api/collection";
import { legendDisplayName } from "@openrift/shared/utils";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { CardmarketWantsLink } from "@/components/cardmarket-wants-link";
import { CardtraderWishlistLink } from "@/components/cardtrader-wishlist-link";
import { CopyTextPanel } from "@/components/copy-text-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCards } from "@/features/cards/hooks/use-cards";
import type { CsvExportFormat } from "@/features/collections/lib/csv-export";
import {
  CSV_EXPORT_FORMATS,
  csvExportFilename,
  csvExportLabels,
  downloadCSV,
} from "@/features/collections/lib/csv-export";
import type { StackedEntry } from "@/features/collections/lib/stacked-entry";
import { useEnumOrders } from "@/hooks/use-enums";
import type { EnumLabels } from "@/lib/enum-labels";
import type { CardLine, DetailedCardLine } from "@/lib/export-text";
import {
  formatCardListAsDeckText,
  formatCardListWithDetails,
  formatCardmarketWants,
  formatCardtraderWishlist,
} from "@/lib/export-text";
import { formatCardId } from "@/lib/format";
import { m } from "@/paraglide/messages.js";

/** `cards` has no printing, so only the plain text formats render it; `printings` fills copy columns only when `copiesById` is given. */
export type ExportPayload =
  | { mode: "cards"; lines: readonly CardLine[] }
  | {
      mode: "printings";
      stacks: readonly StackedEntry[];
      copiesById?: ReadonlyMap<string, CopyResponse>;
    };

const TEXT_FORMATS = ["text", "text-details", "cardmarket", "cardtrader"] as const;

type TextFormat = (typeof TEXT_FORMATS)[number];

type ExportFormat = CsvExportFormat | TextFormat;

const CSV_FORMAT_KEYS = Object.keys(CSV_EXPORT_FORMATS) as CsvExportFormat[];

type ExportUnit = "card" | "copy";

function isTextFormat(format: ExportFormat): format is TextFormat {
  return (TEXT_FORMATS as readonly string[]).includes(format);
}

const TEXT_FORMAT_LABELS: Record<TextFormat, () => string> = {
  text: m.collections_export_format_text_list,
  "text-details": m.collections_export_format_text_list_details,
  cardmarket: m.collections_export_format_cardmarket,
  cardtrader: m.collections_export_format_cardtrader,
};

function formatLabel(format: ExportFormat): string {
  return isTextFormat(format) ? TEXT_FORMAT_LABELS[format]() : CSV_EXPORT_FORMATS[format].label;
}

function exportButtonLabel(unit: ExportUnit, count: number): string {
  if (unit === "card") {
    return m.collections_export_cards({ count });
  }
  return m.collections_export_copies({ count });
}

function payloadLines(payload: ExportPayload): CardLine[] {
  if (payload.mode === "cards") {
    return [...payload.lines];
  }
  return payload.stacks.map((stack) => ({
    name: legendDisplayName(stack.printing.card),
    quantity: stack.copyIds.length,
  }));
}

function detailedLines(stacks: readonly StackedEntry[], labels: EnumLabels): DetailedCardLine[] {
  return stacks.map((stack) => {
    const { printing } = stack;
    const { rest } = formatPrintingVariantLabelParts(printing, undefined, labels);
    return {
      name: legendDisplayName(printing.card),
      quantity: stack.copyIds.length,
      details: [formatCardId(printing), printing.language, ...rest],
    };
  });
}

function textForFormat(
  format: TextFormat,
  payload: ExportPayload,
  lines: readonly CardLine[],
  labels: EnumLabels,
): string {
  if (format === "text") {
    return formatCardListAsDeckText(lines);
  }
  if (format === "cardmarket") {
    return formatCardmarketWants(lines);
  }
  if (format === "cardtrader") {
    return formatCardtraderWishlist(lines);
  }
  return payload.mode === "printings"
    ? formatCardListWithDetails(detailedLines(payload.stacks, labels))
    : "";
}

function MarketplaceHint({ description, link }: { description: string; link: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-muted-foreground text-sm">{description}</p>
      {link}
    </div>
  );
}

interface ExportDialogProps {
  title: string;
  /** Slugged into the download filename. */
  filenameBase: string;
  payload: ExportPayload;
  unit: ExportUnit;
  successMessage: string;
  scopeControls?: ReactNode;
  isLoading?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportDialog({
  title,
  filenameBase,
  payload,
  unit,
  successMessage,
  scopeControls,
  isLoading = false,
  open,
  onOpenChange,
}: ExportDialogProps) {
  const cardsOnly = payload.mode === "cards";
  const [format, setFormat] = useState<ExportFormat>("text");
  const { sets } = useCards();
  const { labels } = useEnumOrders();

  const textFormats: TextFormat[] = cardsOnly
    ? ["text", "cardmarket", "cardtrader"]
    : [...TEXT_FORMATS];
  const csvFormats: CsvExportFormat[] = cardsOnly ? [] : CSV_FORMAT_KEYS;
  const availableFormats: ExportFormat[] = [...textFormats, ...csvFormats];

  const lines = payloadLines(payload);
  const count =
    payload.mode === "cards"
      ? payload.lines.reduce((sum, line) => sum + line.quantity, 0)
      : payload.stacks.reduce((sum, stack) => sum + stack.copyIds.length, 0);

  const isText = isTextFormat(format);
  const text = isText ? textForFormat(format, payload, lines, labels) : "";

  const handleDownload = () => {
    if (isText || payload.mode !== "printings") {
      return;
    }
    const csv = CSV_EXPORT_FORMATS[format].generate(
      [...payload.stacks],
      csvExportLabels(sets, labels),
      payload.copiesById,
    );
    downloadCSV(csv, csvExportFilename(format, filenameBase));
    toast.success(successMessage);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogForm onSubmit={handleDownload}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className="flex min-w-0 flex-col gap-3">
            <Select
              value={format}
              onValueChange={(value) => setFormat((value as ExportFormat) ?? "text")}
              items={Object.fromEntries(availableFormats.map((key) => [key, formatLabel(key)]))}
            >
              <SelectTrigger className="w-[220px]" id="export-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>{m.collections_export_format_group_text()}</SelectLabel>
                  {textFormats.map((key) => (
                    <SelectItem key={key} value={key}>
                      {formatLabel(key)}
                    </SelectItem>
                  ))}
                </SelectGroup>
                {csvFormats.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>{m.collections_export_format_group_csv()}</SelectLabel>
                    {csvFormats.map((key) => (
                      <SelectItem key={key} value={key}>
                        {formatLabel(key)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>

            {format === "cardmarket" && (
              <MarketplaceHint
                description={m.collections_export_wants_description()}
                link={<CardmarketWantsLink />}
              />
            )}
            {format === "cardtrader" && (
              <MarketplaceHint
                description={m.collections_export_cardtrader_description()}
                link={<CardtraderWishlistLink />}
              />
            )}

            {isText ? <CopyTextPanel text={text} /> : null}

            {scopeControls}

            {isText ? null : (
              <div className="flex justify-end">
                <Button type="submit" disabled={isLoading || count === 0}>
                  {isLoading ? (
                    <>
                      <Loader2Icon className="size-4 animate-spin" />
                      {m.collections_export_loading()}
                    </>
                  ) : (
                    <>
                      <DownloadIcon className="size-4" />
                      {exportButtonLabel(unit, count)}
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
