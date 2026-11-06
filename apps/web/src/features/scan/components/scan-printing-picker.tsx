import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";

import { Pressable } from "@/components/ui/pressable";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { PrintingLanguageTabs } from "@/features/cards/components/printing-language-tabs";
import { PrintingRowContent } from "@/features/cards/components/printing-row";
import { printingDisplayName } from "@/features/cards/lib/card-meta";
import type { PickerRequest } from "@/features/scan/lib/scan-resolve";
import { useScanPrefsStore } from "@/features/scan/stores/scan-prefs-store";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

interface ScanPrintingPickerProps {
  request: PickerRequest | null;
  onPick: (printing: Printing) => void;
  onDismiss: () => void;
  title?: string;
  description?: string;
}

export function ScanPrintingPicker({
  request,
  onPick,
  onDismiss,
  title,
  description,
}: ScanPrintingPickerProps) {
  const resolvedTitle = title ?? m.scan_picker_title();
  const cardLanguage = useScanPrefsStore((state) => state.cardLanguage);
  const open = request !== null;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onDismiss();
    }
  };

  const candidates = request?.candidates ?? [];
  const languages = candidates.map((candidate) => candidate.language);
  // EN is the fallback default: most stacks are in it.
  const statedLanguage =
    cardLanguage !== null && languages.includes(cardLanguage) ? cardLanguage : null;
  const defaultLanguage = statedLanguage ?? (languages.includes("EN") ? "EN" : languages[0]);

  const renderList = (items: Printing[]) => (
    <div className="flex min-h-0 flex-col gap-1 overflow-y-auto">
      {items.map((candidate) => {
        const isCurrent = candidate.printingId === request?.currentId;
        return (
          <Pressable
            key={sideKey(candidate)}
            aria-current={isCurrent ? "true" : undefined}
            className={cn(
              "hover:bg-muted flex w-full items-center rounded-md px-2 py-1.5",
              isCurrent && "bg-muted",
            )}
            onClick={() => onPick(candidate)}
          >
            <PrintingRowContent
              printing={candidate}
              // Full candidate set, not the tab's: the variant label needs every sibling.
              siblings={candidates}
              name={printingDisplayName(candidate)}
              right={
                isCurrent ? (
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {m.scan_picker_current()}
                  </span>
                ) : null
              }
            />
          </Pressable>
        );
      })}
    </div>
  );

  const body =
    request === null ? null : (
      // Keyed on the request so a new one re-derives its default tab.
      // Candidates arrive sorted language-first; no order is passed separately.
      <PrintingLanguageTabs
        key={`${request.label}:${candidates[0]?.printingId}`}
        printings={candidates}
        defaultLanguage={defaultLanguage}
        className="min-h-0"
        contentClassName="flex min-h-0 flex-col"
      >
        {renderList}
      </PrintingLanguageTabs>
    );

  const resolvedDescription =
    description ??
    (request ? m.scan_picker_description({ name: request.label.split(" (")[0] ?? "" }) : "");

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent dialogClassName="max-w-md" drawerClassName="gap-3">
        <ResponsiveDialogTitle>{resolvedTitle}</ResponsiveDialogTitle>
        <ResponsiveDialogDescription>{resolvedDescription}</ResponsiveDialogDescription>
        <div className="flex min-h-0 flex-col md:max-h-96">{body}</div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
