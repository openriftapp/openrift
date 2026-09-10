import { Loader2Icon } from "lucide-react";
import type { ReactNode } from "react";

import { CopyTextButton } from "@/components/copy-text-button";
import { Textarea } from "@/components/ui/textarea";

interface CopyTextPanelProps {
  text: string;
  label?: string;
  rows?: number;
  isLoading?: boolean;
  emptyNote?: ReactNode;
}

/** A read-only text field beside a Copy button; hides itself while loading or empty. */
export function CopyTextPanel({
  text,
  label = "Copy",
  rows = 12,
  isLoading = false,
  emptyNote,
}: CopyTextPanelProps) {
  if (isLoading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2Icon className="size-4 animate-spin" />
        Preparing…
      </div>
    );
  }

  if (text.length === 0) {
    return emptyNote === undefined ? null : (
      <p className="text-muted-foreground text-sm">{emptyNote}</p>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Textarea
        readOnly
        value={text}
        className="field-sizing-fixed font-mono text-xs"
        rows={rows}
        onClick={(event) => (event.target as HTMLTextAreaElement).select()}
      />
      <div className="flex justify-end">
        <CopyTextButton label={label} getText={() => text} />
      </div>
    </div>
  );
}
