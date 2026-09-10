import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PrintingFieldOverrides } from "@/features/catalog-admin/lib/compare-actions";
import type { RequiredPrintingField } from "@/features/catalog-admin/lib/printing-fields";
import { REQUIRED_PRINTING_FIELD_LABELS } from "@/features/catalog-admin/lib/printing-fields";

export function CompareMissingFieldsDialog({
  open,
  onOpenChange,
  sourceLabel,
  missing,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceLabel: string;
  missing: readonly RequiredPrintingField[];
  onConfirm: (overrides: PrintingFieldOverrides) => void;
}) {
  const fieldId = useId();
  const [values, setValues] = useState<PrintingFieldOverrides>({});

  const complete = missing.every((field) => (values[field] ?? "").trim() !== "");

  function submit() {
    onOpenChange(false);
    setValues({});
    onConfirm(
      Object.fromEntries(
        missing.map((field) => [field, (values[field] ?? "").trim()]),
      ) as PrintingFieldOverrides,
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setValues({});
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogForm onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Add the printing from {sourceLabel}</DialogTitle>
            <DialogDescription>
              This row is missing values a printing cannot be created without. Fill them in and the
              rest comes from the row.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {missing.map((field) => (
              <div key={field} className="flex flex-col gap-1.5">
                <Label htmlFor={`${fieldId}-${field}`}>
                  {REQUIRED_PRINTING_FIELD_LABELS[field]}
                </Label>
                <Input
                  id={`${fieldId}-${field}`}
                  value={values[field] ?? ""}
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, [field]: event.target.value }))
                  }
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="ghost" type="button" />}>Cancel</DialogClose>
            <Button type="submit" disabled={!complete}>
              Add printing
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
