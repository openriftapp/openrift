import { FileJsonIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Dropzone } from "@/components/ui/dropzone";
import type { JsonFileInput } from "@/features/admin/hooks/use-json-file-input";

export function JsonFileField<T>({
  input,
  onFile,
  summary,
  disabled,
}: {
  input: JsonFileInput<T>;
  onFile?: (file: File) => void;
  summary?: (value: T, fileName: string) => ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Dropzone
        accept=".json,application/json"
        label="Choose a JSON file"
        hint="or drop it here"
        icon={<FileJsonIcon className="text-muted-foreground size-6" />}
        disabled={disabled}
        onFiles={([file]) => {
          if (file) {
            onFile?.(file);
            void input.load(file);
          }
        }}
      />
      {summary && input.value !== null && input.fileName !== null && (
        <p className="text-muted-foreground text-sm">{summary(input.value, input.fileName)}</p>
      )}
      {input.error && (
        <p className="text-muted-foreground flex items-center gap-1 text-sm">
          <XIcon className="text-destructive size-4 shrink-0" />
          {input.error}
        </p>
      )}
    </div>
  );
}
