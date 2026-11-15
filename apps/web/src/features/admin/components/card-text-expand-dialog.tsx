import { Maximize2Icon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { CardTextInput } from "@/features/contribute/components/card-text-input";
import type { CardTextVariant } from "@/features/contribute/components/card-text-input";

interface CardTextExpandDialogProps {
  label: string;
  value: string;
  imageUrl?: string | null;
  /** Commit the edited text (empty string clears the field). Return false to keep the dialog open. */
  onSave: (next: string) => boolean | void;
  requiredError?: string;
  variant?: CardTextVariant;
  reformat?: (value: string) => string;
  triggerClassName?: string;
}

export function CardTextExpandDialog({
  label,
  value,
  imageUrl,
  onSave,
  requiredError,
  variant,
  reformat,
  triggerClassName,
}: CardTextExpandDialogProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [rejected, setRejected] = useState(false);

  function save(next: string) {
    if (onSave(next) === false) {
      setRejected(true);
      return;
    }
    setOpen(false);
  }

  const noImage = (
    <div className="text-muted-foreground border-input flex h-40 items-center justify-center rounded-md border border-dashed px-3 text-center">
      No image available for this printing.
    </div>
  );

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`Expand ${label} editor`}
        title={`Expand ${label} editor`}
        className={triggerClassName}
        onClick={() => {
          setDraft(value);
          setRejected(false);
          setOpen(true);
        }}
      >
        <Maximize2Icon className="size-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogForm onSubmit={() => save(draft)}>
            <DialogHeader>
              <DialogTitle>Edit {label}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,20rem)_1fr]">
              <div className="self-start sm:sticky sm:top-0">
                {imageUrl ? (
                  <ImgWithFallback
                    src={imageUrl}
                    alt="Card reference"
                    className="max-h-[70vh] w-full rounded-md object-contain"
                    fallback={noImage}
                  />
                ) : (
                  noImage
                )}
              </div>
              <CardTextInput
                label={label}
                value={draft}
                onChange={setDraft}
                rows={6}
                variant={variant}
                reformat={reformat}
              />
            </div>
            {rejected && requiredError && (
              <p role="alert" className="text-destructive text-xs">
                {requiredError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                className="text-destructive sm:mr-auto"
                onClick={() => save("")}
              >
                Clear
              </Button>
              <DialogCancel />
              <Button type="submit">Save</Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </>
  );
}
