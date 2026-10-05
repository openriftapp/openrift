import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { useNavigate } from "@tanstack/react-router";
import type { ChangeEvent } from "react";
import { useRef, useState } from "react";

import { Code } from "@/components/ui/code";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { ImportTextInput } from "@/features/collections/components/import-preview-chrome";
import { handleImportFileUpload } from "@/features/collections/lib/import-flow-shared";
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
              <ParaglideMessage
                message={m.collections_import_paste_hint}
                markup={{
                  code: ({ children }) => <Code>{children}</Code>,
                }}
              />
            </DialogDescription>
          </DialogHeader>

          <ImportTextInput
            value={rawText}
            onValueChange={setRawText}
            placeholder={m.collections_import_textarea_placeholder()}
            fileRef={fileRef}
            onFileUpload={handleFileUpload}
            uploadLabel={m.collections_import_upload_file()}
            actionLabel={m.collections_import_continue()}
          />
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
