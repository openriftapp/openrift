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
import { runReportedMutation } from "@/lib/run-reported-mutation";

export function PrintingActionsMenu({
  printing,
  invalidates,
  onDeleted,
}: {
  printing: DeskPrintingRow;
  invalidates: Parameters<typeof useDeletePrinting>[0];
  onDeleted: () => void;
}) {
  const deletePrinting = useDeletePrinting(invalidates);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function confirmDelete() {
    if (await runReportedMutation(() => deletePrinting.mutateAsync(printing.printingId))) {
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
              <Link
                to="/admin/cards/$cardSlug/printings/create"
                params={{ cardSlug: printing.cardSlug }}
                search={{ duplicateFrom: printing.printingId }}
              />
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
