import { Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";

import { ConfirmActionButton } from "@/components/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { runReportedMutation } from "@/lib/run-reported-mutation";

export interface AdminDeleteConfig<TData> {
  onDelete: (row: TData) => Promise<unknown>;
  confirm?: (row: TData) => { title: string; description: ReactNode };
  canDelete?: (row: TData) => boolean;
}

export function DeleteButton<TData>({
  row,
  config,
}: {
  row: TData;
  config: AdminDeleteConfig<TData>;
}) {
  if (config.confirm) {
    const { title, description } = config.confirm(row);
    return (
      <ConfirmActionButton
        title={title}
        description={description}
        confirmLabel="Delete"
        onConfirm={() => config.onDelete(row)}
        trigger={<Button variant="ghost" size="icon" className="text-destructive" />}
      >
        <Trash2Icon className="size-4" />
        <span className="sr-only">Delete</span>
      </ConfirmActionButton>
    );
  }

  async function handleDelete() {
    await runReportedMutation(() => config.onDelete(row));
  }

  return (
    <Button
      variant="ghost"
      className="text-destructive hover:text-destructive"
      onClick={() => void handleDelete()}
    >
      Delete
    </Button>
  );
}
