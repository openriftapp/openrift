import { pluralize } from "@openrift/shared/strings";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function SourceStrip({
  sources,
  onCompare,
}: {
  sources: { key: string; label: string; differences: number; trusted?: boolean }[];
  onCompare?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 pb-2">
      <span className="text-muted-foreground text-xs">Sources</span>
      {sources.length === 0 && <span className="text-muted-foreground text-xs">None</span>}
      {sources.map((source) => (
        <span
          key={source.key}
          className="inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium"
        >
          {source.label}
          {source.trusted === true && <Badge variant="info">Trusted</Badge>}
          {source.differences === 0 ? (
            <span className="text-success">matches</span>
          ) : (
            <span className="text-muted-foreground">
              {source.differences} {pluralize(source.differences, "difference")}
            </span>
          )}
        </span>
      ))}
      {onCompare !== undefined && (
        <Button variant="outline" size="sm" className="ml-auto" onClick={onCompare}>
          Compare all sources
        </Button>
      )}
    </div>
  );
}
