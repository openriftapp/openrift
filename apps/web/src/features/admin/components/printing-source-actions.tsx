import type {
  CandidateCardResponse,
  CandidatePrintingResponse,
} from "@openrift/shared/types/api/admin";
import { BanIcon, CopyCheckIcon, CopyIcon, MoveIcon, Trash2Icon, XIcon } from "lucide-react";

import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";

interface PrintingTarget {
  id: string;
  label: string;
}

interface PrintingSourceActionsProps {
  targets: PrintingTarget[];
  onAssign?: (printingId: string) => void;
  onCopy?: (printingId: string) => void;
  onAcceptAll?: () => void;
  onUnassign?: () => void;
  /** Omitted for card-review grant holders; triage is full-admin. */
  onIgnore?: () => void;
  /** Omitted for card-review grant holders. */
  onDelete?: () => void;
}

export function PrintingSourceActions({
  targets,
  onAssign,
  onCopy,
  onAcceptAll,
  onUnassign,
  onIgnore,
  onDelete,
}: PrintingSourceActionsProps) {
  return (
    <>
      {targets.length > 0 && onAssign && (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <MoveIcon className="size-3.5" />
            Link to existing…
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {targets.map((p) => (
              <DropdownMenuItem key={`assign-${p.id}`} onClick={() => onAssign(p.id)}>
                {p.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )}
      {targets.length > 0 && onCopy && (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <CopyIcon className="size-3.5" />
            Copy to…
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {targets.map((p) => (
              <DropdownMenuItem key={`copy-${p.id}`} onClick={() => onCopy(p.id)}>
                {p.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )}
      {onAcceptAll && (
        <DropdownMenuItem onClick={onAcceptAll}>
          <CopyCheckIcon className="size-3.5" />
          Accept all fields
        </DropdownMenuItem>
      )}
      {onUnassign && (
        <DropdownMenuItem onClick={onUnassign}>
          <XIcon className="size-3.5" />
          Unlink
        </DropdownMenuItem>
      )}
      {onIgnore && (
        <DropdownMenuItem onClick={onIgnore}>
          <BanIcon className="size-3.5" />
          Ignore permanently
        </DropdownMenuItem>
      )}
      {onDelete && (
        <DropdownMenuItem onClick={onDelete}>
          <Trash2Icon className="size-3.5" />
          Delete
        </DropdownMenuItem>
      )}
    </>
  );
}

interface PrintingSourceColumnActionsProps {
  row?: CandidateCardResponse | CandidatePrintingResponse;
  targets: { id: string; label: string }[];
  sourceLabels: Record<string, string>;
  onAssign: (input: { candidatePrintingIds: string[]; printingId: string | null }) => void;
  onCopy: (input: { id: string; printingId: string }) => void;
  onIgnore: (input: { provider: string; externalId: string; finish: string | null }) => void;
  onDelete: (id: string) => void;
}

export function PrintingSourceColumnActions({
  row,
  targets,
  sourceLabels,
  onAssign,
  onCopy,
  onIgnore,
  onDelete,
}: PrintingSourceColumnActionsProps) {
  if (!row) {
    return null;
  }
  const printingRow = row as CandidatePrintingResponse;
  return (
    <PrintingSourceActions
      targets={targets.filter((target) => target.id !== printingRow.printingId)}
      onAssign={(pid) => onAssign({ candidatePrintingIds: [row.id], printingId: pid })}
      onCopy={(pid) => onCopy({ id: row.id, printingId: pid })}
      onUnassign={() => onAssign({ candidatePrintingIds: [row.id], printingId: null })}
      onIgnore={() =>
        onIgnore({
          provider: sourceLabels[printingRow.candidateCardId] ?? "",
          externalId: row.externalId,
          finish: printingRow.finish,
        })
      }
      onDelete={() => onDelete(row.id)}
    />
  );
}
