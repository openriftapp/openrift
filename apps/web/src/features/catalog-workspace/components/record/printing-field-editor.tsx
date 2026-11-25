import type {
  DeskPrintingRow,
  DeskReleasePrecision,
  DeskUpdateInput,
} from "@openrift/shared/contracts/admin/printing-desk";
import { enumLabel } from "@openrift/shared/enum-label";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { DatePrecisionControl } from "@/features/admin/components/date-precision-control";
import { PrintingDeskChannelPicker } from "@/features/admin/components/printing-desk-channel-picker";
import { useUpdateDeskPrinting } from "@/features/admin/hooks/use-printing-desk";
import { normalizedRelease } from "@/features/admin/lib/desk-printing-fields";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import { useEnumOrders } from "@/hooks/use-enums";
import { errorText } from "@/lib/error-text";

export type PrintingField = "channel" | "size" | "announced" | "release" | "comment";
type DeskPatch = Omit<DeskUpdateInput, "printingId" | "side">;

export function PrintingFieldEditor({
  printing,
  field,
  onDone,
}: {
  printing: DeskPrintingRow;
  field: PrintingField;
  onDone: () => void;
}) {
  const queueWrite = useQueueWorkspaceWrite();
  const update = useUpdateDeskPrinting({ inlineError: true });
  const { orders, labels } = useEnumOrders();
  const [channels, setChannels] = useState<string[]>([...printing.distributionChannelSlugs]);
  const [size, setSize] = useState(printing.size);
  const [announcedAt, setAnnouncedAt] = useState(printing.announcedAt);
  const [releasedAt, setReleasedAt] = useState(printing.releasedAt);
  const [precision, setPrecision] = useState<DeskReleasePrecision>(
    printing.releasePrecision ?? "day",
  );
  const [comment, setComment] = useState(printing.comment ?? "");

  function patch(): DeskPatch {
    switch (field) {
      case "channel": {
        return { distributionChannelSlugs: channels };
      }
      case "size": {
        return { size };
      }
      case "announced": {
        return { announcedAt };
      }
      case "release": {
        const release = normalizedRelease(releasedAt, precision);
        return { releasedAt: release.releasedAt, releasePrecision: release.precision };
      }
      case "comment": {
        const trimmed = comment.trim();
        return { comment: trimmed.length > 0 ? trimmed : null };
      }
    }
  }

  async function save() {
    const input = { printingId: printing.printingId, ...patch() };
    if (await queueWrite((signal) => update.mutateAsync(input, { signal }))) {
      onDone();
    }
  }

  return (
    <div className="space-y-2">
      {field === "channel" && (
        <Suspense fallback={<Skeleton className="h-9 w-full" />}>
          <PrintingDeskChannelPicker value={channels} onChange={setChannels} />
        </Suspense>
      )}
      {field === "size" && (
        <SimpleSelect
          items={orders.cardSizes.map((slug) => ({
            value: slug,
            label: enumLabel(labels.cardSizes, slug),
          }))}
          value={size}
          onChange={setSize}
          label="Size"
          className="w-full sm:w-56"
        />
      )}
      {field === "announced" && (
        <DatePicker
          aria-label="Announced on"
          className="w-44"
          value={announcedAt}
          onValueChange={setAnnouncedAt}
          onClear={() => setAnnouncedAt(null)}
        />
      )}
      {field === "release" && (
        <div className="flex flex-wrap items-center gap-2">
          <DatePicker
            aria-label="Available from"
            className="w-44"
            value={releasedAt}
            onValueChange={setReleasedAt}
            onClear={() => setReleasedAt(null)}
          />
          <DatePrecisionControl
            includeQuarter={printing.releasePrecision === "quarter"}
            value={precision}
            onChange={setPrecision}
          />
        </div>
      )}
      {field === "comment" && (
        <Textarea
          aria-label="Comment"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" pending={update.isPending} onClick={() => void save()}>
          Save
        </Button>
        <Button variant="ghost" size="sm" disabled={update.isPending} onClick={onDone}>
          Cancel
        </Button>
      </div>
      {update.error !== null && (
        <p className="text-destructive text-sm">
          {errorText(update.error, "Could not save the field.")}
        </p>
      )}
    </div>
  );
}
