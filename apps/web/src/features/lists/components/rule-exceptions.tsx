import { legendDisplayName } from "@openrift/shared/card-name";
import type { ListKind } from "@openrift/shared/types/api/list";
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { ChipRemoveButton } from "@/components/ui/chip-remove-button";
import { CatalogPrintingVariantLine } from "@/features/cards/components/printing-row";
import { useCards } from "@/features/cards/hooks/use-cards";
import { printingDisplayName } from "@/features/cards/lib/card-meta";
import { useCollections } from "@/features/collections/hooks/use-collections";
import { useCopies } from "@/features/collections/hooks/use-copies";
import type { CopyPinWording } from "@/features/rules/lib/rule-wording";
import { useRuleEditorStore } from "@/features/rules/stores/rule-editor-store";
import { formatCardId } from "@/lib/format";
import { m } from "@/paraglide/messages.js";

function ExclusionChip({
  label,
  detail,
  onRemove,
}: {
  label: string;
  detail?: ReactNode;
  onRemove: () => void;
}) {
  return (
    <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-md py-0.5 pr-0.5 pl-2 text-sm">
      {label}
      {detail && <span className="text-xs">{detail}</span>}
      <ChipRemoveButton
        aria-label={m.lists_rule_stop_excluding({ label })}
        className="hover:bg-background/60 ml-0 p-0.5"
        onClick={onRemove}
      >
        <XIcon className="size-3.5" aria-hidden />
      </ChipRemoveButton>
    </span>
  );
}

export function RuleExceptions({
  index,
  kind,
  isCopy,
  excludeIds,
  keepCopyIds,
  pinWording,
}: {
  index: number;
  kind: ListKind;
  isCopy: boolean;
  excludeIds: string[];
  keepCopyIds: string[];
  pinWording: CopyPinWording;
}) {
  const { printingsById, printingsByCardId } = useCards();
  const toggleExcludeId = useRuleEditorStore((state) => state.toggleExcludeId);

  if (isCopy) {
    if (keepCopyIds.length === 0) {
      return null;
    }
    return <KeptCopies index={index} copyIds={keepCopyIds} wording={pinWording} />;
  }

  if (excludeIds.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-sm">{m.lists_rule_excluded()}</span>
      <div className="flex flex-wrap gap-1.5">
        {excludeIds.map((id) => {
          const printing = kind === "card" ? undefined : printingsById[id];
          const card = kind === "card" ? printingsByCardId.get(id)?.[0]?.card : undefined;
          const label = printing
            ? printingDisplayName(printing)
            : card
              ? legendDisplayName(card)
              : m.lists_rule_removed_card();
          return (
            <ExclusionChip
              key={id}
              label={label}
              detail={printing && <CatalogPrintingVariantLine printing={printing} />}
              onRemove={() => toggleExcludeId(index, id)}
            />
          );
        })}
      </div>
    </div>
  );
}

function KeptCopies({
  index,
  copyIds,
  wording,
}: {
  index: number;
  copyIds: string[];
  wording: CopyPinWording;
}) {
  const { data: copies, isReady } = useCopies();
  const { data: collections } = useCollections();
  const { printingsById } = useCards();
  const toggleKeepCopyId = useRuleEditorStore((state) => state.toggleKeepCopyId);
  if (!isReady) {
    return null;
  }

  const copyById = new Map(copies.map((copy) => [copy.id, copy]));
  const collectionName = new Map(collections.map((collection) => [collection.id, collection.name]));

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-sm">{wording.pinnedHeading}</span>
      <ul className="flex flex-col gap-1">
        {copyIds.map((copyId) => {
          const copy = copyById.get(copyId);
          const printing = copy ? printingsById[copy.printingId] : undefined;
          const label = printing
            ? `${printingDisplayName(printing)} ${formatCardId(printing)}`
            : m.lists_rule_removed_copy();
          return (
            <li
              key={copyId}
              className="bg-muted flex items-center justify-between gap-2 rounded-md py-0.5 pr-0.5 pl-2"
            >
              {printing && copy ? (
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                  <span className="truncate">{printingDisplayName(printing)}</span>
                  <span className="text-xs">
                    <CatalogPrintingVariantLine printing={printing} />
                  </span>
                  <span className="text-muted-foreground truncate">
                    {collectionName.get(copy.collectionId)}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground text-sm">{label}</span>
              )}
              <ChipRemoveButton
                aria-label={wording.unpin(label)}
                className="hover:bg-background/60 ml-0 shrink-0 p-0.5"
                onClick={() => toggleKeepCopyId(index, copyId)}
              >
                <XIcon className="size-3.5" aria-hidden />
              </ChipRemoveButton>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
