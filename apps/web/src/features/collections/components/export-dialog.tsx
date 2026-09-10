import type { CopyResponse } from "@openrift/shared/types/api/collection";
import { legendDisplayName } from "@openrift/shared/utils";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { CopyTextPanel } from "@/components/copy-text-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCards } from "@/features/cards/hooks/use-cards";
import { CardmarketWantsBlock } from "@/features/collections/components/cardmarket-wants-block";
import type { CsvExportFormat } from "@/features/collections/lib/csv-export";
import {
  CSV_EXPORT_FORMATS,
  csvExportFilename,
  csvExportLabels,
  downloadCSV,
} from "@/features/collections/lib/csv-export";
import type { StackedEntry } from "@/features/collections/lib/stacked-entry";
import { useEnumOrders } from "@/hooks/use-enums";
import type { CardLine } from "@/lib/export-text";
import { formatCardListAsDeckText } from "@/lib/export-text";

/** `cards` has no printing, so only the text format renders it; `printings` fills copy columns only when `copiesById` is given. */
export type ExportPayload =
  | { mode: "cards"; lines: readonly CardLine[] }
  | {
      mode: "printings";
      stacks: readonly StackedEntry[];
      copiesById?: ReadonlyMap<string, CopyResponse>;
    };

const TEXT_FORMAT = "text";

type ExportFormat = CsvExportFormat | typeof TEXT_FORMAT;

const CSV_FORMAT_KEYS = Object.keys(CSV_EXPORT_FORMATS) as CsvExportFormat[];

type ExportUnit = "card" | "copy";

const UNIT_PLURAL: Record<ExportUnit, string> = { card: "cards", copy: "copies" };

function formatLabel(format: ExportFormat): string {
  return format === TEXT_FORMAT ? "Text list" : CSV_EXPORT_FORMATS[format].label;
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
  const [format, setFormat] = useState<ExportFormat>(cardsOnly ? TEXT_FORMAT : "openrift");
  const { sets } = useCards();
  const { labels } = useEnumOrders();

  const availableFormats: ExportFormat[] = cardsOnly
    ? [TEXT_FORMAT]
    : [...CSV_FORMAT_KEYS, TEXT_FORMAT];

  const lines = payloadLines(payload);
  const count =
    payload.mode === "cards"
      ? payload.lines.reduce((sum, line) => sum + line.quantity, 0)
      : payload.stacks.reduce((sum, stack) => sum + stack.copyIds.length, 0);

  const isText = format === TEXT_FORMAT;
  const text = isText ? formatCardListAsDeckText(lines) : "";

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
            {availableFormats.length > 1 && (
              <Select
                value={format}
                onValueChange={(value) => setFormat((value as ExportFormat) ?? "openrift")}
                items={Object.fromEntries(availableFormats.map((key) => [key, formatLabel(key)]))}
              >
                <SelectTrigger className="w-[220px]" id="export-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableFormats.map((key) => (
                    <SelectItem key={key} value={key}>
                      {formatLabel(key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {isText ? <CopyTextPanel text={text} /> : null}

            {scopeControls}

            {isText ? null : (
              <div className="flex justify-end">
                <Button type="submit" disabled={isLoading || count === 0}>
                  {isLoading ? (
                    <>
                      <Loader2Icon className="size-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <DownloadIcon className="size-4" />
                      Export {count} {count === 1 ? unit : UNIT_PLURAL[unit]}
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogForm>

        <CardmarketWantsBlock lines={lines} />
      </DialogContent>
    </Dialog>
  );
}
