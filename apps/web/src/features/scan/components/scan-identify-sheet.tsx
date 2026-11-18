import type { Printing } from "@openrift/shared/types/catalog";

import { Pressable } from "@/components/ui/pressable";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Spinner } from "@/components/ui/spinner";
import { CardMiniRow } from "@/features/cards/components/card-mini-row";
import { ScanIdentifySearch } from "@/features/scan/components/scan-identify-search";
import type { IdentifyCandidate } from "@/features/scan/lib/scan-identify";
import { m } from "@/paraglide/messages.js";

interface ScanIdentifySheetProps {
  open: boolean;
  snapshot: string | null;
  pending: boolean;
  failed: boolean;
  candidates: IdentifyCandidate[];
  allPrintings: Printing[];
  onPick: (candidate: IdentifyCandidate) => void;
  onPickPrinting: (printing: Printing) => void;
  onDismiss: () => void;
}

/** Manual pick when the scanner will not lock: the captured frame and its best matches as thumbnails. */
export function ScanIdentifySheet({
  open,
  snapshot,
  pending,
  failed,
  candidates,
  allPrintings,
  onPick,
  onPickPrinting,
  onDismiss,
}: ScanIdentifySheetProps) {
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onDismiss();
    }
  };

  const list = (
    <div className="flex flex-col gap-1">
      {candidates.map((candidate) => (
        <Pressable
          key={candidate.key}
          className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5"
          onClick={() => onPick(candidate)}
        >
          {/* The bank knows the artwork, not the printing: no rarity, no
              domains, so the lead is the art strip alone. */}
          <CardMiniRow
            imageId={candidate.key}
            landscape={candidate.landscape}
            artClassName="h-10"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{candidate.name ?? candidate.detail}</span>
            {candidate.name !== null && (
              <span className="text-muted-foreground block truncate font-mono text-xs">
                {candidate.detail}
              </span>
            )}
          </span>
        </Pressable>
      ))}
    </div>
  );

  const body = (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex gap-3">
        {/* The guide is an upright card outline whatever the card's orientation,
          so the snapshot always has the same shape. */}
        {snapshot !== null && (
          <img
            src={snapshot}
            alt=""
            className="bg-muted rounded-card h-32 w-24 shrink-0 object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          {pending && (
            <p className="text-muted-foreground flex items-center gap-2">
              <Spinner aria-hidden="true" />
              {m.scan_identify_recognising()}
            </p>
          )}
          {!pending && failed && (
            <p className="text-muted-foreground">{m.scan_identify_failed()}</p>
          )}
          {!pending && !failed && candidates.length === 0 && (
            <p className="text-muted-foreground">{m.scan_identify_empty()}</p>
          )}
          {!pending && candidates.length > 0 && list}
        </div>
      </div>
      {!pending && <ScanIdentifySearch allPrintings={allPrintings} onPick={onPickPrinting} />}
    </div>
  );

  const title = m.scan_identify_title();
  const description = pending ? m.scan_identify_pending_description() : null;

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent dialogClassName="max-w-md" drawerClassName="gap-3">
        <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
        {description && <ResponsiveDialogDescription>{description}</ResponsiveDialogDescription>}
        <div className="min-h-0 overflow-y-auto md:max-h-96">{body}</div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
