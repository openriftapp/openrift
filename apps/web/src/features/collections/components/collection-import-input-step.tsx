import { FileUpIcon, UploadIcon } from "lucide-react";

import { PageDescription } from "@/components/layout/page-top-bar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Code } from "@/components/ui/code";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ImportInputStepProps } from "@/features/collections/components/import-input-step-props";
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
        {m.collections_import_paste_hint_before()}{" "}
        <Code>{m.collections_import_paste_hint_code()}</Code>{" "}
        {m.collections_import_paste_hint_after()}
      </PageDescription>

      <div className="space-y-3">
        <Textarea
          value={rawText}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder={m.collections_import_textarea_placeholder()}
          // text-base below md: iOS Safari zooms the viewport when a focused
          // field is under 16px, and there is no maximum-scale to stop it.
          className="min-h-[200px] font-mono text-base md:text-xs"
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => onParse(rawText)} disabled={rawText.trim().length === 0}>
            <UploadIcon className="size-4" />
            {m.collections_import_parse()}
          </Button>

          <div className="text-muted-foreground text-sm">{m.collections_import_or()}</div>

          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <FileUpIcon className="size-4" />
            {m.collections_import_upload_file()}
          </Button>
          <Input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,.txt,text/plain"
            onChange={onFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {parseErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            {parseErrors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
