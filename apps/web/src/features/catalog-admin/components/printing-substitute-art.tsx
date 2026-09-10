import type {
  AdminPrintingImageResponse,
  AdminPrintingResponse,
} from "@openrift/shared/types/api/admin";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { findDerivedArtPrinting } from "@/features/admin/components/card-detail-shared";
import { useSetFallbackArt } from "@/features/admin/hooks/use-admin-image-mutations";
import { siblingArtOptions } from "@/features/catalog-admin/lib/printing-images";

export function PrintingSubstituteArt({
  printing,
  printings,
  images,
}: {
  printing: AdminPrintingResponse;
  printings: readonly AdminPrintingResponse[];
  images: readonly AdminPrintingImageResponse[];
}) {
  const setFallbackArt = useSetFallbackArt();
  const siblings = siblingArtOptions(printing.id, printings, images);
  const derived = findDerivedArtPrinting(printing, printings, images);
  const mode = printing.fallbackArtMode;

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-sm">
        This printing has no front image of its own. Choose what the card page shows instead.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          variant="outline"
          spacing={0}
          aria-label="Substitute art"
          value={[mode]}
          onValueChange={([next]) => {
            if (next === "auto" || next === "none") {
              setFallbackArt.mutate({ printingId: printing.id, mode: next });
              return;
            }
            const first = siblings.at(0);
            if (next === "pinned" && first) {
              setFallbackArt.mutate({
                printingId: printing.id,
                mode: "pinned",
                imageFileId: first.imageFileId,
              });
            }
          }}
        >
          <ToggleGroupItem value="auto">
            Auto{derived ? ` (${derived.expectedPrintingId})` : " (no source)"}
          </ToggleGroupItem>
          <ToggleGroupItem value="pinned" disabled={siblings.length === 0}>
            Pick a sibling…
          </ToggleGroupItem>
          <ToggleGroupItem value="none">None</ToggleGroupItem>
        </ToggleGroup>

        {mode === "pinned" && siblings.length > 0 && (
          <Select
            items={siblings.map((sibling) => ({
              value: sibling.imageFileId,
              label: sibling.label,
            }))}
            value={printing.fallbackImageFileId ?? siblings[0]?.imageFileId}
            onValueChange={(imageFileId: string | null) => {
              if (imageFileId !== null) {
                setFallbackArt.mutate({ printingId: printing.id, mode: "pinned", imageFileId });
              }
            }}
          >
            <SelectTrigger className="w-56" aria-label="Sibling printing">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {siblings.map((sibling) => (
                <SelectItem key={sibling.imageFileId} value={sibling.imageFileId}>
                  {sibling.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
