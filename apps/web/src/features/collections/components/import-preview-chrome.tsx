import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { CheckCircle2Icon, ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Pressable } from "@/components/ui/pressable";
import { SectionHeading } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import { SOCIAL_LINKS } from "@/lib/social-links";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function ImportPreviewStack({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("space-y-8", className)}>{children}</div>;
}

// `render` lets a list that needs its own root element (the deck step's Accordion) supply one.
export function ImportRowsSection({
  title,
  count,
  render,
  children,
}: {
  title: ReactNode;
  count?: number;
  render?: useRender.ComponentProps<"div">["render"];
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <SectionHeading count={count}>{title}</SectionHeading>
      <ImportRowList render={render}>{children}</ImportRowList>
    </section>
  );
}

function ImportRowList({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">({ className: cn("divide-border -mx-4 divide-y", className) }, props),
    render,
  });
}

export function ImportStatusBadges({
  readyCount,
  toVerifyCount,
  needsAttentionCount,
  skippedCount,
  onJumpToNeedsAttention,
}: {
  readyCount: number;
  toVerifyCount: number;
  needsAttentionCount: number;
  skippedCount: number;
  onJumpToNeedsAttention?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="success">{m.collections_import_badge_ready({ count: readyCount })}</Badge>
      {toVerifyCount > 0 && (
        <Badge variant="warning">
          {m.collections_import_badge_to_verify({ count: toVerifyCount })}
        </Badge>
      )}
      {needsAttentionCount > 0 &&
        (onJumpToNeedsAttention ? (
          <Badge
            variant="destructive"
            render={<Pressable />}
            // Badge's built-in hover rules only target anchor renders.
            className="hover:bg-destructive/20"
            aria-label={
              needsAttentionCount === 1
                ? m.collections_import_jump_aria_one({ count: needsAttentionCount })
                : m.collections_import_jump_aria_other({ count: needsAttentionCount })
            }
            onClick={onJumpToNeedsAttention}
          >
            {m.collections_import_badge_need_attention({ count: needsAttentionCount })}
          </Badge>
        ) : (
          <Badge variant="destructive">
            {m.collections_import_badge_need_attention({ count: needsAttentionCount })}
          </Badge>
        ))}
      {skippedCount > 0 && (
        <Badge variant="ghost">{m.collections_import_badge_skipped({ count: skippedCount })}</Badge>
      )}
    </div>
  );
}

/** `unit` names what a source record is called on the surface: CSV import reads rows, a plain-text list reads lines. */
export function ImportParseErrorDetails({
  errors,
  unit,
}: {
  errors: string[];
  unit: "row" | "line";
}) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <details className="bg-warning-soft border-warning/40 text-warning rounded-lg border">
      <summary className="cursor-pointer px-3 py-2 font-medium">
        {parseErrorSummary(errors.length, unit)}
      </summary>
      <div className="border-warning/40 border-t px-3 py-2">
        {errors.map((error) => (
          <p key={error}>{error}</p>
        ))}
      </div>
    </details>
  );
}

function parseErrorSummary(count: number, unit: "row" | "line"): string {
  if (unit === "line") {
    return count === 1
      ? m.collections_import_parse_errors_lines_one({ count })
      : m.collections_import_parse_errors_lines_other({ count });
  }
  return count === 1
    ? m.collections_import_parse_errors_rows_one({ count })
    : m.collections_import_parse_errors_rows_other({ count });
}

export function ImportExactMatchesDisclosure({
  count,
  children,
}: {
  count: number;
  children: ReactNode;
}) {
  if (count === 0) {
    return null;
  }

  return (
    <details className="group rounded-lg border">
      <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-2 px-4 py-2.5">
        <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" />
        <CheckCircle2Icon className="text-success size-4" />
        <span>{m.collections_import_matched_exactly({ count })}</span>
      </summary>
      <div className="divide-border divide-y border-t">{children}</div>
    </details>
  );
}

export function ImportToVerifyNote({ count }: { count: number }) {
  if (count === 0) {
    return null;
  }

  return (
    <p className="text-muted-foreground text-sm">
      {count === 1
        ? m.collections_import_to_verify_note_before_one({ count })
        : m.collections_import_to_verify_note_before_other({ count })}{" "}
      <span className="text-foreground font-medium">{m.collections_import_to_verify_label()}</span>
      {m.collections_import_to_verify_note_after()}
    </p>
  );
}

export function ImportTroubleNote({ needsAttentionCount }: { needsAttentionCount: number }) {
  if (needsAttentionCount === 0) {
    return null;
  }

  return (
    <p className="text-muted-foreground text-sm">
      {m.collections_import_trouble_before()}{" "}
      <TextLink variant="muted" href={SOCIAL_LINKS.githubIssues} target="_blank" rel="noreferrer">
        {m.collections_import_trouble_link()}
      </TextLink>{" "}
      {m.collections_import_trouble_after()}
    </p>
  );
}
