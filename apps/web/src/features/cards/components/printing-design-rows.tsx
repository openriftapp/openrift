import { enumLabel } from "@openrift/shared/enum-label";
import type { Printing } from "@openrift/shared/types/catalog";
import type { ReactNode } from "react";

import { LanguageChip } from "@/components/language-chip";
import { Pressable } from "@/components/ui/pressable";
import { PrintingThumbnail } from "@/features/cards/components/printing-option-content";
import { PrintingVariantLine } from "@/features/cards/components/printing-row";
import type { PrintingDesign } from "@/features/cards/lib/printing-designs";
import { isSelectedSide } from "@/features/cards/lib/printing-designs";
import { useLanguageLabels } from "@/hooks/use-enums";
import { cn } from "@/lib/utils";

interface RowProps {
  selectedSideKey: string;
  onSelect: (printing: Printing) => void;
  right?: (printing: Printing) => ReactNode;
  details?: (design: PrintingDesign) => ReactNode;
}

export function PrintingDesignRows({
  designs,
  className,
  ...rowProps
}: RowProps & { designs: PrintingDesign[]; className?: string }) {
  const leads = designs.map((design) => design.lead);
  return (
    <div className={cn("space-y-1", className)}>
      {designs.map((design) => (
        <DesignRow key={design.key} design={design} leads={leads} {...rowProps} />
      ))}
    </div>
  );
}

function DesignRow({
  design,
  leads,
  selectedSideKey,
  onSelect,
  right,
  details,
}: RowProps & { design: PrintingDesign; leads: Printing[] }) {
  const languageLabels = useLanguageLabels();
  const members = [...design.byLanguage.values()];
  const selected = members.find((member) => isSelectedSide(member, selectedSideKey));
  const shown = selected ?? design.lead;

  return (
    <div
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- can't use <button>; the row holds the language pills and the caller's controls, and nested buttons are invalid HTML
      role="button"
      tabIndex={0}
      aria-pressed={selected !== undefined}
      data-printing-id={shown.printingId}
      onClick={() => onSelect(shown)}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onSelect(shown);
        }
      }}
      className={cn(
        "-mx-2.5 flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors",
        selected ? "bg-muted ring-border ring-1" : "hover:bg-muted/50",
      )}
    >
      <PrintingThumbnail printing={shown} className="h-10" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="min-w-0 text-xs">
          <PrintingVariantLine printing={shown} siblings={leads} hideLanguage />
        </span>
        <span className="flex flex-wrap gap-1">
          {members.map((member) => (
            <Pressable
              key={member.language}
              aria-pressed={member === shown}
              aria-label={enumLabel(languageLabels, member.language)}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(member);
              }}
              className="rounded-full"
            >
              <LanguageChip
                code={member.language}
                className={cn(member !== shown && "opacity-60")}
              />
            </Pressable>
          ))}
        </span>
        {details?.(design)}
      </span>
      {right?.(shown)}
    </div>
  );
}
