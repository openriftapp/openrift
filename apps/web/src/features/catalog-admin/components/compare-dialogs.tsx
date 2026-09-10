import { useId, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ComparePrintingTarget } from "@/features/catalog-admin/lib/compare-actions";

export interface CompareDialogCopy {
  title: string;
  description: string;
  confirmLabel: string;
}

export function CompareConfirmDialog({
  open,
  onOpenChange,
  copy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  copy: CompareDialogCopy;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            {copy.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ComparePrintingPicker({
  open,
  onOpenChange,
  copy,
  targets,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  copy: CompareDialogCopy;
  targets: readonly ComparePrintingTarget[];
  onConfirm: (printingId: string) => void;
}) {
  const fieldId = useId();
  const [selected, setSelected] = useState("");
  const items = targets.map((target) => ({ value: target.id, label: target.label }));

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setSelected("");
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor={fieldId}>Printing</Label>
          <Select items={items} value={selected} onValueChange={(next) => setSelected(next ?? "")}>
            <SelectTrigger id={fieldId} className="w-full">
              <SelectValue placeholder="Pick a printing" />
            </SelectTrigger>
            <SelectContent>
              {targets.map((target) => (
                <SelectItem key={target.id} value={target.id}>
                  {target.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            disabled={selected === ""}
            onClick={() => {
              onOpenChange(false);
              onConfirm(selected);
            }}
          >
            {copy.confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
