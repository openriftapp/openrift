import { LinkIcon } from "lucide-react";

import { MarkdownText } from "@/components/markdown-text";
import { OrnamentRule } from "@/components/ui/ornament";
import { m } from "@/paraglide/messages.js";

export function SectionDivider({
  title,
  count,
  description,
  anchorId,
}: {
  title: string;
  count: number;
  description?: string | null;
  anchorId?: string;
}) {
  return (
    <div className="mb-3 flex flex-col gap-1">
      <OrnamentRule fade="tips">
        <div className="flex items-baseline gap-2 text-sm">
          <span className="font-semibold">{title}</span>
          <span className="text-muted-foreground tabular-nums">({count})</span>
          {anchorId && (
            <a
              href={`#${anchorId}`}
              aria-label={m.cards_link_to_aria({ name: title })}
              className="text-muted-foreground/60 hover:text-foreground self-center transition-colors"
            >
              <LinkIcon className="size-3.5" />
            </a>
          )}
        </div>
      </OrnamentRule>
      {description && (
        <MarkdownText
          text={description}
          links="any"
          className="text-muted-foreground max-w-2xl text-sm"
        />
      )}
    </div>
  );
}

export function ParentAnchors({ ids, stickyOffset }: { ids: string[]; stickyOffset: number }) {
  if (ids.length === 0) {
    return null;
  }
  return (
    <>
      {ids.map((id) => (
        <div key={id} id={id} aria-hidden style={{ scrollMarginTop: `${stickyOffset}px` }} />
      ))}
    </>
  );
}
