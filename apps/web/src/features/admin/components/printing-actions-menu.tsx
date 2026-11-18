import type { DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";
import { Link } from "@tanstack/react-router";
import { CopyIcon, EllipsisVerticalIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeletePrinting } from "@/features/admin/hooks/use-admin-card-mutations";
import { deskPrintingName } from "@/features/admin/lib/desk-face-options";
import type { RunWrite } from "@/features/admin/lib/run-write";
import { runWriteDirectly } from "@/features/admin/lib/run-write";

export function PrintingActionsMenu({
  printing,
  invalidates,
  onDeleted,
  runWrite = runWriteDirectly,
  inWorkspace = false,
}: {
  printing: DeskPrintingRow;
  invalidates: Parameters<typeof useDeletePrinting>[0];
  onDeleted: () => void;
  runWrite?: RunWrite;
  inWorkspace?: boolean;
}) {
  const deletePrinting = useDeletePrinting(invalidates);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function confirmDelete() {
    const { printingId } = printing;
    if (await runWrite((signal) => deletePrinting.mutateAsync(printingId, { signal }))) {
      setDeleteOpen(false);
      onDeleted();
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <EllipsisVerticalIcon />
          <span className="sr-only">Printing actions</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            render={
              inWorkspace ? (
                <Link
                  to="/admin/workspace/printings/create"
                  search={{ card: printing.cardSlug, duplicateFrom: printing.printingId }}
                />
              ) : (
                <Link
                  to="/admin/cards/$cardSlug/printings/create"
                  params={{ cardSlug: printing.cardSlug }}
                  search={{ duplicateFrom: printing.printingId }}
                />
              )
            }
          >
            <CopyIcon />
            Duplicate printing
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={deletePrinting.isPending}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete printing "${deskPrintingName(printing)}"?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        isPending={deletePrinting.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
