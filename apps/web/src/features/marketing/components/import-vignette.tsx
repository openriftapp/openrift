import { ChevronRightIcon, FileUpIcon, UploadIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { ImportRowShell } from "@/features/collections/components/import-row-shell";
import { IMPORT_BUCKET_ICONS } from "@/features/collections/lib/import-bucket-icons";
import { importSpecialties } from "@/features/collections/lib/import-specialties";
import {
  FIXTURE_LABELS,
  IMPORT_SAMPLE_LINES,
  IMPORT_SAMPLE_MATCHES,
} from "@/features/marketing/lib/vignette-fixtures";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { FAKE_CONTROL, Swap, Vignette } from "./vignette-parts";

const { icon: ReadyIcon, className: READY_CLASS } = IMPORT_BUCKET_ICONS.ready;

export function ImportVignette() {
  return (
    <Vignette>
      <div
        className={cn(
          FAKE_CONTROL,
          "h-auto min-h-24 items-start overflow-hidden py-2 font-mono text-xs md:text-xs",
        )}
      >
        <Swap
          className="w-full"
          was={
            <span className="text-muted-foreground">
              {m.collections_import_textarea_placeholder()}
            </span>
          }
          now={
            <span className="flex flex-col">
              {IMPORT_SAMPLE_LINES.map((line, index) => (
                <span
                  key={line}
                  className={cn("whitespace-nowrap", index === 0 && "text-muted-foreground")}
                >
                  {line}
                </span>
              ))}
              <span className="text-muted-foreground">...</span>
            </span>
          }
        />
      </div>
      <div className="flex items-center gap-3">
        <span className={buttonVariants()}>
          <UploadIcon className="size-4" aria-hidden="true" />
          {m.collections_import_parse()}
        </span>
        <span className="text-muted-foreground text-sm">{m.collections_import_or()}</span>
        <span className={buttonVariants({ variant: "outline" })}>
          <FileUpIcon className="size-4" aria-hidden="true" />
          {m.collections_import_upload_file()}
        </span>
      </div>
      <div className="motion-safe:animate-vignette-now flex flex-col gap-3">
        <span className="font-heading font-medium">{m.collections_import_preview_title()}</span>
        <div className="-mx-4 flex flex-col">
          {IMPORT_SAMPLE_MATCHES.map(({ quantity, card }) => (
            <ImportRowShell
              key={card.shortCode}
              chevron={
                <ChevronRightIcon
                  className="text-muted-foreground size-4 shrink-0 opacity-40"
                  aria-hidden="true"
                />
              }
              statusIcon={
                <ReadyIcon className={cn("size-4 shrink-0", READY_CLASS)} aria-hidden="true" />
              }
              quantity={quantity}
              code={card.shortCode}
              name={card.name}
              nameSuffix={importSpecialties(
                card,
                FIXTURE_LABELS.finishes,
                FIXTURE_LABELS.artVariants,
              )}
            />
          ))}
          <span className="text-muted-foreground px-4 py-1 text-xs">
            {m.decks_overview_zone_more({ count: 219 })}
          </span>
        </div>
        <span className={cn(buttonVariants(), "w-fit")}>
          {m.collections_import_button_import_copies({ count: 412 })}
        </span>
      </div>
    </Vignette>
  );
}
