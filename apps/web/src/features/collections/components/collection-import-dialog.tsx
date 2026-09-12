import { useNavigate } from "@tanstack/react-router";
import { FileUpIcon, UploadIcon } from "lucide-react";
import type { ChangeEvent } from "react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { handleImportFileUpload } from "@/features/collections/hooks/import-flow-shared";
import { useImportHandoffStore } from "@/features/collections/stores/import-handoff-store";
import { m } from "@/paraglide/messages.js";

interface CollectionImportDialogProps {
  collectionId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CollectionImportDialog({
  collectionId,
  open,
  onOpenChange,
}: CollectionImportDialogProps) {
  const navigate = useNavigate();
  const [rawText, setRawText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // BaseUI's Dialog stays mounted after closing, so reset the draft here
  // rather than in an effect: this runs during the render that flips `open`.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      setRawText("");
    }
  }

  const handleContinue = (text: string) => {
    useImportHandoffStore.getState().setHandoff({ rawText: text, collectionId });
    onOpenChange(false);
    void navigate({ to: "/collections/import" });
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    void handleImportFileUpload(event, fileRef, setRawText, handleContinue);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogForm onSubmit={() => handleContinue(rawText)}>
          <DialogHeader>
            <DialogTitle>{m.collections_import_dialog_title()}</DialogTitle>
            <DialogDescription>
              {m.collections_import_paste_hint_before()}{" "}
              <code className="text-foreground">{m.collections_import_paste_hint_code()}</code>{" "}
              {m.collections_import_paste_hint_after()}
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-w-0 flex-col gap-3">
            <Textarea
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              placeholder={m.collections_import_textarea_placeholder()}
              // text-base below md: iOS Safari zooms the viewport when a focused
              // field is under 16px, and there is no maximum-scale to stop it.
              className="min-h-[200px] font-mono text-base md:text-xs"
            />

            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                <FileUpIcon className="size-4" />
                {m.collections_import_upload_file()}
              </Button>
              <Input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,.txt,text/plain"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button type="submit" disabled={rawText.trim().length === 0}>
                <UploadIcon className="size-4" />
                {m.collections_import_continue()}
              </Button>
            </div>
          </div>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
