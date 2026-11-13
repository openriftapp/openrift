import { sideKey, uniquePrintings } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";
import type { MouseEvent, PointerEvent, ReactNode, RefObject } from "react";
import { useRef } from "react";

import { ContextMenuGroup, ContextMenuItem, ContextMenuLabel } from "@/components/ui/context-menu";
import { OwnedCountBadge } from "@/features/cards/components/owned-count-badge";
import { PrintingHoverPreview } from "@/features/cards/components/printing-hover-preview";
import { PrintingRowContent } from "@/features/cards/components/printing-row";
import { usePrintingHover } from "@/features/cards/hooks/use-printing-hover";
import { useOwnedCountsForPrintings } from "@/features/collections/hooks/use-owned-count";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

/**
 * Host must spread `popupRef` on its popup and render {@link PrintingChoicePreview}
 * outside it, or the popup's overflow clips the preview; call `reset` from `onOpenChange`, not unmount.
 */
export function usePrintingChoiceHover(clearDelayMs?: number) {
  const { hoveredId, onEnter, onLeave, reset } = usePrintingHover(clearDelayMs);
  const popupRef = useRef<HTMLDivElement>(null);

  // Touch and pen also fire pointerenter; only mouse should trigger a hover preview.
  const hoverProps = (printingId: string) => ({
    onPointerEnter: (event: PointerEvent) => {
      if (event.pointerType === "mouse") {
        onEnter(printingId);
      }
    },
    onPointerLeave: (event: PointerEvent) => {
      if (event.pointerType === "mouse") {
        onLeave();
      }
    },
  });

  return { hoveredId, popupRef, hoverProps, reset };
}

export function PrintingChoicePreview({
  hoveredId,
  printings,
  anchorRef,
}: {
  hoveredId: string | null;
  printings: readonly Printing[];
  anchorRef: RefObject<HTMLElement | null>;
}) {
  const hovered =
    hoveredId === null ? undefined : printings.find((p) => p.printingId === hoveredId);
  if (!hovered) {
    return null;
  }
  // Remount per printing: an imageless entry unmounts the preview, and without
  // a fresh key the position effect won't re-run for the next hover.
  return <PrintingHoverPreview key={sideKey(hovered)} printing={hovered} anchorRef={anchorRef} />;
}

/**
 * Shared by the deck builder's row menu and the tier list's tile menu, which
 * differ only in what a pick means, not in how the list looks.
 */
export function PrintingChoiceMenuSection({
  printings,
  activePrintingId,
  hoverProps,
  hint,
  onSelect,
  onSelectDefault,
}: {
  printings: readonly Printing[];
  activePrintingId: string | null;
  hoverProps: (printingId: string) => {
    onPointerEnter: (event: PointerEvent) => void;
    onPointerLeave: (event: PointerEvent) => void;
  };
  hint?: ReactNode;
  onSelect: (printing: Printing, event: MouseEvent) => void;
  onSelectDefault?: (event: MouseEvent) => void;
}) {
  const choices = uniquePrintings(printings);
  const { data: session } = useSession();
  const { data: owned } = useOwnedCountsForPrintings(
    choices.map((printing) => printing.printingId),
    Boolean(session?.user),
  );
  if (choices.length === 0) {
    return null;
  }
  return (
    <ContextMenuGroup>
      <ContextMenuLabel>
        {m.cards_printing_menu_change_printing()}
        {hint}
      </ContextMenuLabel>
      <div className="flex flex-col gap-0.5">
        {activePrintingId !== null && onSelectDefault && (
          <ContextMenuItem
            onClick={(event) => {
              event.stopPropagation();
              onSelectDefault(event);
            }}
          >
            {m.cards_printing_menu_use_default()}
          </ContextMenuItem>
        )}
        {choices.map((printing) => {
          const ownedCount = owned?.totals[printing.printingId] ?? 0;
          return (
            <ContextMenuItem
              key={sideKey(printing)}
              className={cn(
                printing.printingId === activePrintingId && "bg-muted ring-border ring-1",
              )}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(printing, event);
              }}
              {...hoverProps(printing.printingId)}
            >
              <PrintingRowContent
                printing={printing}
                siblings={printings}
                thumbBadge={ownedCount > 0 && <OwnedCountBadge count={ownedCount} />}
              />
            </ContextMenuItem>
          );
        })}
      </div>
    </ContextMenuGroup>
  );
}
