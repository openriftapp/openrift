import { CardmarketWantsLink } from "@/components/cardmarket-wants-link";
import { CopyTextButton } from "@/components/copy-text-button";
import { Textarea } from "@/components/ui/textarea";
import type { CardLine } from "@/lib/export-text";
import { formatCardmarketWants } from "@/lib/export-text";
import { m } from "@/paraglide/messages.js";

interface CardmarketWantsBlockProps {
  lines: readonly CardLine[];
}

// Cardmarket's shopping wizard matches lines by card name; any extra text
// (short codes, prices, CSV columns) breaks the match.
export function CardmarketWantsBlock({ lines }: CardmarketWantsBlockProps) {
  const text = formatCardmarketWants(lines);

  if (text.length === 0) {
    return null;
  }

  const lineCount = text.split("\n").length;

  return (
    <div className="flex min-w-0 flex-col gap-3 pt-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">{m.collections_export_wants_title()}</h3>
        <div className="flex items-center gap-1.5">
          <CardmarketWantsLink />
          <CopyTextButton label={m.common_copy()} getText={() => text} size="sm" />
        </div>
      </div>
      <p className="text-muted-foreground text-sm">{m.collections_export_wants_description()}</p>
      <Textarea
        readOnly
        value={text}
        className="field-sizing-fixed font-mono text-xs"
        rows={Math.min(Math.max(lineCount, 2), 8)}
        onClick={(event) => (event.target as HTMLTextAreaElement).select()}
      />
    </div>
  );
}
