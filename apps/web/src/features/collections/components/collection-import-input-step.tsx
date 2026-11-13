import { ParaglideMessage } from "@inlang/paraglide-js-react";

import { PageDescription } from "@/components/layout/page-top-bar";
import { PROSE_MARKUP } from "@/components/message-markup";
import { ImportTextInput } from "@/features/collections/components/import-preview-chrome";
import type { ImportInputStepProps } from "@/features/collections/lib/import-input-step-props";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function CollectionImportInputStep({
  rawText,
  onTextChange,
  onParse,
  onFileUpload,
  fileRef,
  parseErrors,
}: ImportInputStepProps) {
  return (
    <div className={cn(PAGE_WIDTH.capped, "space-y-6")}>
      <PageDescription>
        <ParaglideMessage
          message={m.collections_import_paste_hint}
          markup={{ code: PROSE_MARKUP.code }}
        />
      </PageDescription>

      <ImportTextInput
        value={rawText}
        onValueChange={onTextChange}
        placeholder={m.collections_import_textarea_placeholder()}
        fileRef={fileRef}
        onFileUpload={onFileUpload}
        uploadLabel={m.collections_import_upload_file()}
        actionLabel={m.collections_import_parse()}
        onAction={() => onParse(rawText)}
        errors={parseErrors}
      />
    </div>
  );
}
