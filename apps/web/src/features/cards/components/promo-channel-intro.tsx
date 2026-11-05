import { formatShortDayYear } from "@openrift/shared/format-date";
import { useEffect, useRef, useState } from "react";

import { MarkdownText } from "@/components/markdown-text";
import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { parsePromoAnnouncement } from "@/features/cards/lib/promo-announcement";
import { DATE_WORDS } from "@/lib/date-words";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

function ClampedQuote({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || expanded) {
      return;
    }
    const measure = () => setClamped(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded]);

  return (
    <blockquote className="border-border border-l-2 pl-3">
      <p ref={ref} className={cn("text-muted-foreground text-sm", !expanded && "line-clamp-2")}>
        {text}
      </p>
      {(clamped || expanded) && (
        <Button
          variant="link-muted"
          className="h-auto p-0 text-xs"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? m.common_show_less() : m.promos_read_more()}
        </Button>
      )}
    </blockquote>
  );
}

export function PromoChannelIntro({ description }: { description: string }) {
  const { date, url, quote, note } = parsePromoAnnouncement(description);
  return (
    <div className="flex flex-col gap-1.5">
      {(date || url) && (
        <p className="text-muted-foreground text-xs">
          {date && m.promos_announced({ date: formatShortDayYear(date, DATE_WORDS) })}
          {date && url && " · "}
          {url && (
            <TextLink variant="muted" href={url} target="_blank" rel="noreferrer">
              {m.promos_announcement_link()}
            </TextLink>
          )}
        </p>
      )}
      {quote && <ClampedQuote text={quote} />}
      {note && <MarkdownText text={note} links="any" className="text-muted-foreground text-sm" />}
    </div>
  );
}
