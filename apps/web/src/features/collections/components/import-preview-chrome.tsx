import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { CheckCircle2Icon, FileUpIcon, UploadIcon } from "lucide-react";
import type { ChangeEvent, ReactNode, RefObject } from "react";
import { useState } from "react";

import { Disclosure } from "@/components/disclosure";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ExpandToggle } from "@/components/ui/expand-toggle";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { SectionHeading } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import { Textarea } from "@/components/ui/textarea";
import { SOCIAL_LINKS } from "@/lib/social-links";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

/** Without `onAction` the primary button submits the surrounding form. */
export function ImportTextInput({
  value,
  onValueChange,
  placeholder,
  fileRef,
  onFileUpload,
  accept = ".csv,text/csv,.txt,text/plain",
  uploadLabel,
  actionLabel,
  onAction,
  actionPending = false,
  errors = [],
  className,
  textareaClassName,
}: {
  value: string;
  onValueChange: (text: string) => void;
  placeholder?: string;
  fileRef: RefObject<HTMLInputElement | null>;
  onFileUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  accept?: string;
  uploadLabel: ReactNode;
  actionLabel: ReactNode;
  onAction?: () => void;
  actionPending?: boolean;
  errors?: string[];
  className?: string;
  textareaClassName?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      <Textarea
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        // text-base below md: iOS Safari zooms the viewport when a focused
        // field is under 16px, and there is no maximum-scale to stop it.
        className={cn("min-h-[200px] font-mono text-base md:text-xs", textareaClassName)}
      />

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
          <FileUpIcon />
          {uploadLabel}
        </Button>
        <Input
          ref={fileRef}
          type="file"
          accept={accept}
          onChange={onFileUpload}
          className="hidden"
        />
        <Button
          type={onAction ? "button" : "submit"}
          onClick={onAction}
          pending={actionPending}
          disabled={value.trim().length === 0}
        >
          <UploadIcon />
          {actionLabel}
        </Button>
      </div>

      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

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
            aria-label={m.collections_import_jump_aria({ count: needsAttentionCount })}
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

  return <ParseErrorAlert summary={parseErrorSummary(errors.length, unit)} errors={errors} />;
}

function ParseErrorAlert({ summary, errors }: { summary: string; errors: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Alert variant="warning">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          render={
            <ExpandToggle
              expanded={open}
              chevronClassName="text-current"
              className="w-full font-medium"
            />
          }
        >
          {summary}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-warning/40 mt-2 border-t pt-2">
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Alert>
  );
}

function parseErrorSummary(count: number, unit: "row" | "line"): string {
  if (unit === "line") {
    return m.collections_import_parse_errors_lines({ count });
  }
  return m.collections_import_parse_errors_rows({ count });
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
    <Disclosure
      title={
        <span className="flex items-center gap-2">
          <CheckCircle2Icon className="text-success size-4" />
          {m.collections_import_matched_exactly({ count })}
        </span>
      }
      contentClassName="divide-border divide-y border-t p-0"
    >
      {children}
    </Disclosure>
  );
}

export function ImportToVerifyNote({ count }: { count: number }) {
  if (count === 0) {
    return null;
  }

  return (
    <p className="text-muted-foreground text-sm">
      <ParaglideMessage
        message={m.collections_import_to_verify_note}
        inputs={{ count }}
        markup={{
          strong: ({ children }) => <span className="text-foreground font-medium">{children}</span>,
        }}
      />
    </p>
  );
}

export function ImportTroubleNote({ needsAttentionCount }: { needsAttentionCount: number }) {
  if (needsAttentionCount === 0) {
    return null;
  }

  return (
    <p className="text-muted-foreground text-sm">
      <ParaglideMessage
        message={m.collections_import_trouble}
        markup={{
          link: ({ children }) => (
            <TextLink
              variant="muted"
              href={SOCIAL_LINKS.githubIssues}
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </TextLink>
          ),
        }}
      />
    </p>
  );
}
